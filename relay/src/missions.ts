import crypto from "node:crypto"

import { eq, inArray } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import * as schema from "./db/schema.js"
import { githubWebhookEvents, missions, missionSignals } from "./db/schema.js"

type DB = BetterSQLite3Database<typeof schema>

type MissionPlanStep = {
  step: number
  description: string
  tool: string
  estimate: string
  reversibility: "reversible" | "auto" | "attention"
  /**
   * Optional freeform label shown next to the reversibility dot. Falls back to
   * a default label derived from `reversibility` ("reversible" / "automatic" /
   * "attention needed") when absent.
   */
  reversibilityLabel?: string
}

type MissionArtifactKind = "markdown" | "email" | "github_comment" | "slack_message"

type MissionArtifact = {
  kind: MissionArtifactKind
  title?: string
  body: string
  recipient?: string
}

type MissionAction = {
  key: string
  label: string
  hotkey: string
  actionPrompt: string
  artifact?: MissionArtifact
}

type MissionCandidate = {
  /** Generator-assigned id, used to match critic verdicts back to candidates. */
  id: string
  title: string
  urgent: boolean
  priority: "low" | "normal" | "high"
  recommendation: string
  analysisMarkdown: string
  confidence: number
  confidenceLabel: string
  sourceProvider: string
  sourceEventType: string
  plan: MissionPlanStep[]
  actions: MissionAction[]
  citedEventIds: number[]
}

type Verdict = {
  id: string
  verdict: "surface" | "suppress"
  reason: string
}

type EventGroup = {
  provider: string
  eventType: string
  count: number
  sampleTitles: string[]
  ids: number[]
}

type RecentDecision = {
  kind: string
  actionKey: string | null
  missionTitle: string | null
  createdAt: string
}

// ── Validators / normalizers ──────────────────────────────────────────────

function normalizePlan(plan: unknown): MissionPlanStep[] {
  if (!Array.isArray(plan)) return []
  const result: MissionPlanStep[] = []
  for (const [index, raw] of plan.entries()) {
    if (!raw || typeof raw !== "object") continue
    const step = raw as Partial<MissionPlanStep>
    const description = String(step.description ?? "").trim()
    if (!description) continue
    const reversibility =
      step.reversibility === "auto" || step.reversibility === "attention" ? step.reversibility : "reversible"
    const normalized: MissionPlanStep = {
      step: typeof step.step === "number" ? step.step : index + 1,
      description,
      tool: String(step.tool ?? "").trim(),
      estimate: String(step.estimate ?? "").trim(),
      reversibility,
    }
    if (typeof step.reversibilityLabel === "string" && step.reversibilityLabel.trim()) {
      normalized.reversibilityLabel = step.reversibilityLabel.trim()
    }
    result.push(normalized)
  }
  return result
}

const ARTIFACT_KINDS = new Set<MissionArtifactKind>(["markdown", "email", "github_comment", "slack_message"])

function normalizeArtifact(value: unknown): MissionArtifact | undefined {
  if (!value || typeof value !== "object") return undefined
  const obj = value as Partial<MissionArtifact>
  const kind =
    typeof obj.kind === "string" && ARTIFACT_KINDS.has(obj.kind as MissionArtifactKind)
      ? (obj.kind as MissionArtifactKind)
      : "markdown"
  const body = typeof obj.body === "string" ? obj.body.trim() : ""
  if (!body) return undefined
  const artifact: MissionArtifact = { kind, body }
  if (typeof obj.title === "string" && obj.title.trim()) artifact.title = obj.title.trim()
  if (typeof obj.recipient === "string" && obj.recipient.trim()) artifact.recipient = obj.recipient.trim()
  return artifact
}

function normalizeActions(actions: unknown): MissionAction[] {
  if (!Array.isArray(actions)) return []
  const result: MissionAction[] = []
  for (const [index, raw] of actions.entries()) {
    if (!raw || typeof raw !== "object") continue
    const action = raw as Partial<MissionAction>
    const label = String(action.label ?? "").trim()
    if (!label) continue
    const normalized: MissionAction = {
      key: String(action.key ?? `action_${index + 1}`).trim(),
      label,
      hotkey: String(action.hotkey ?? String(index + 1)).trim(),
      actionPrompt: String(action.actionPrompt ?? "").trim(),
    }
    const artifact = normalizeArtifact(action.artifact)
    if (artifact) normalized.artifact = artifact
    result.push(normalized)
  }
  return result
}

function isMissionCandidate(value: unknown): value is MissionCandidate {
  if (!value || typeof value !== "object") return false
  const c = value as Partial<MissionCandidate>
  return (
    typeof c.title === "string" &&
    typeof c.recommendation === "string" &&
    typeof c.analysisMarkdown === "string" &&
    typeof c.confidence === "number" &&
    Array.isArray(c.plan) &&
    Array.isArray(c.actions)
  )
}

function normalizeCandidate(raw: unknown, index: number): MissionCandidate | null {
  if (!isMissionCandidate(raw)) return null
  const c = raw as MissionCandidate
  const priority = c.priority === "low" || c.priority === "high" ? c.priority : "normal"
  const citedEventIds = Array.isArray(c.citedEventIds)
    ? c.citedEventIds.filter((x): x is number => Number.isInteger(x))
    : []
  return {
    id: typeof c.id === "string" && c.id.trim() ? c.id.trim() : `cand_${index + 1}`,
    title: c.title.trim(),
    urgent: Boolean(c.urgent),
    priority,
    recommendation: c.recommendation.trim(),
    analysisMarkdown: c.analysisMarkdown.trim(),
    confidence: Math.max(0, Math.min(1, c.confidence)),
    confidenceLabel: typeof c.confidenceLabel === "string" ? c.confidenceLabel.trim() : "",
    sourceProvider: typeof c.sourceProvider === "string" && c.sourceProvider.trim() ? c.sourceProvider.trim() : "argus",
    sourceEventType:
      typeof c.sourceEventType === "string" && c.sourceEventType.trim() ? c.sourceEventType.trim() : "pattern",
    plan: normalizePlan(c.plan),
    actions: normalizeActions(c.actions),
    citedEventIds,
  }
}

function parseCandidates(raw: unknown): MissionCandidate[] {
  if (!Array.isArray(raw)) return []
  const result: MissionCandidate[] = []
  for (const [i, item] of raw.entries()) {
    const c = normalizeCandidate(item, i)
    if (c) result.push(c)
  }
  return result
}

function parseVerdicts(raw: unknown): Verdict[] {
  if (!Array.isArray(raw)) return []
  const out: Verdict[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const v = item as Partial<Verdict>
    if (typeof v.id !== "string" || !v.id) continue
    const verdict = v.verdict === "surface" ? "surface" : "suppress"
    out.push({ id: v.id, verdict, reason: typeof v.reason === "string" ? v.reason.trim() : "" })
  }
  return out
}

// ── Prompt builders ───────────────────────────────────────────────────────

type GeneratorPromptInput = {
  operatingDoc: string
  recentDecisions: RecentDecision[]
  groups: EventGroup[]
  windowMinutes: number
}

function formatEventGroup(group: EventGroup) {
  const samples = group.sampleTitles
    .slice(0, 5)
    .map((t) => `  • ${t}`)
    .join("\n")
  const ids = group.ids.slice(0, 20).join(", ")
  return [
    `- ${group.provider}.${group.eventType} (${group.count} event${group.count === 1 ? "" : "s"})`,
    samples,
    `  eventIds: [${ids}${group.ids.length > 20 ? `, …+${group.ids.length - 20} more` : ""}]`,
  ]
    .filter(Boolean)
    .join("\n")
}

function formatRecentDecisions(decisions: RecentDecision[]) {
  if (decisions.length === 0) return "(none yet)"
  return decisions
    .map((d) => {
      const who = d.actionKey ? `${d.kind} → ${d.actionKey}` : d.kind
      const title = d.missionTitle ? ` "${d.missionTitle.slice(0, 80)}"` : ""
      return `- [${d.createdAt}] ${who}${title}`
    })
    .join("\n")
}

function buildGeneratorPrompt(input: GeneratorPromptInput): string {
  const candidateExample: MissionCandidate = {
    id: "cand_1",
    title: "Short headline of the decision",
    urgent: false,
    priority: "normal",
    recommendation: "One-line recommended action, written as a direct verb phrase",
    analysisMarkdown:
      "2-4 paragraphs grounded in the cited events. **Bold** key numbers. Use `code` for identifiers. Never invent facts.",
    confidence: 0.78,
    confidenceLabel: "pattern in window",
    sourceProvider: "github",
    sourceEventType: "issues",
    plan: [
      {
        step: 1,
        description: "What the first step does, concretely",
        tool: "github.issues.comment",
        estimate: "~2s",
        reversibility: "reversible",
      },
    ],
    actions: [
      {
        key: "approve",
        label: "Send reply to all 3",
        hotkey: "1",
        actionPrompt: "Specific instruction the coding agent would execute if the user picks this action.",
        artifact: {
          kind: "github_comment",
          title: "Reply to issue #123",
          recipient: "homanp/argus#123",
          body: "Pre-drafted markdown body of what would be posted. This is what the user will see and approve.",
        },
      },
    ],
    citedEventIds: [42, 43, 44],
  }

  return [
    `[Argus mission scan — PHASE 1: GENERATE CANDIDATES]`,
    `You run on a cadence. Given a window of recent events, propose 0-5 missions worth surfacing to the user.`,
    ``,
    `# Operating doc (your running theory of how this user operates)`,
    input.operatingDoc.trim() || "(empty — no theory yet)",
    ``,
    `# Recent decisions (how the user has handled similar missions)`,
    formatRecentDecisions(input.recentDecisions),
    ``,
    `# Event window — last ${input.windowMinutes} minutes, grouped by provider/type`,
    input.groups.length === 0 ? "(no events in window)" : input.groups.map(formatEventGroup).join("\n\n"),
    ``,
    `# Rules`,
    `- Return JSON array of 0-5 candidates. Fewer is better. Empty array is valid when nothing meets the bar.`,
    `- A mission must: (a) save the user time, or (b) prevent a mistake, or (c) surface a pattern they couldn't easily see themselves. Not "might be interesting".`,
    `- Ground every claim in cited event ids. Never invent facts.`,
    `- Every action MUST include a pre-drafted \`artifact\` — the actual thing that would be produced on approval (comment body, email, message). The user should be able to say "yes, send exactly that".`,
    `- Return ONLY JSON — no prose, no markdown fences.`,
    ``,
    `# Schema example (for ONE candidate — return an array)`,
    JSON.stringify(candidateExample, null, 2),
  ].join("\n")
}

type CriticPromptInput = {
  operatingDoc: string
  recentDecisions: RecentDecision[]
  candidates: MissionCandidate[]
}

function buildCriticPrompt(input: CriticPromptInput): string {
  return [
    `[Argus mission scan — PHASE 2: CRITIQUE]`,
    `You are the last line of defense before a mission reaches the user's inbox.`,
    `Default to SUPPRESS. Only return "surface" when you are >70% confident the user would thank you for interrupting them RIGHT NOW.`,
    `A pattern that "might be interesting" is not enough — the mission must change what the user would do today.`,
    ``,
    `# Operating doc`,
    input.operatingDoc.trim() || "(empty — no theory yet)",
    ``,
    `# Recent decisions (what the user has accepted/dismissed)`,
    formatRecentDecisions(input.recentDecisions),
    ``,
    `# Candidates to judge`,
    JSON.stringify(
      input.candidates.map((c) => ({
        id: c.id,
        title: c.title,
        recommendation: c.recommendation,
        analysisMarkdown: c.analysisMarkdown,
        confidence: c.confidence,
        citedEventIds: c.citedEventIds,
      })),
      null,
      2,
    ),
    ``,
    `# Output format`,
    `Return JSON array with one verdict per candidate id:`,
    `[{ "id": "cand_1", "verdict": "surface" | "suppress", "reason": "short one-sentence justification grounded in the operating doc or recent decisions" }]`,
    `Every verdict MUST include a reason. Reasons for "suppress" should cite which operating-doc line or recent decision made you drop it.`,
  ].join("\n")
}

type DocUpdatePromptInput = {
  operatingDoc: string
  decisionKind: string
  actionKey: string | null
  missionTitle: string
  missionRecommendation: string
}

function buildDocUpdatePrompt(input: DocUpdatePromptInput): string {
  return [
    `[Operating doc update]`,
    `You maintain a short markdown doc that captures how the user operates. Every time the user makes a decision on a mission, you consider whether that decision reveals something new about their preferences, and if so, you propose a small addition.`,
    ``,
    `# Current doc`,
    input.operatingDoc.trim() || "(empty)",
    ``,
    `# New decision`,
    `Mission: "${input.missionTitle}"`,
    `Recommendation argus made: "${input.missionRecommendation}"`,
    `User action: ${input.decisionKind}${input.actionKey ? ` (${input.actionKey})` : ""}`,
    ``,
    `# Rules`,
    `- If this decision reveals a NEW preference that isn't already captured in the doc, return a tiny diff (1-3 lines). Otherwise return { "diff": null, "reason": "already captured" }.`,
    `- The diff is raw markdown to append. Prefer short bulleted observations like "- prefers credits over refunds for month 3-6 churns".`,
    `- Return JSON only: { "diff": string | null, "reason": string }.`,
    `- Be conservative — better to return null than to duplicate existing lines or invent patterns from a single decision.`,
  ].join("\n")
}

// ── Mission action dispatch prompt + signals ─────────────────────────────

type MissionSnapshot = {
  title: string
  analysisMarkdown: string
  recommendation: string
  plan: MissionPlanStep[]
}

type MissionSignalSnapshot = {
  source: string | null
  eventType: string | null
  payload: unknown
}

/**
 * Loads the webhook-event payloads linked to a mission through
 * `mission_signals`. Returns them in the order they were attached (trigger
 * first, then context rows). Used by `buildMissionActionContext` to ground
 * the dispatched agent call in the same facts the mission itself cited.
 */
async function loadMissionSignals(db: DB, missionId: string): Promise<MissionSignalSnapshot[]> {
  const rows = await db
    .select({
      id: missionSignals.id,
      source: githubWebhookEvents.source,
      eventType: githubWebhookEvents.eventType,
      payloadJson: githubWebhookEvents.payloadJson,
    })
    .from(missionSignals)
    .leftJoin(githubWebhookEvents, eq(missionSignals.webhookEventId, githubWebhookEvents.id))
    .where(eq(missionSignals.missionId, missionId))
    .orderBy(missionSignals.id)

  return rows.map((row) => {
    let payload: unknown = null
    if (row.payloadJson) {
      try {
        payload = JSON.parse(row.payloadJson)
      } catch {
        payload = row.payloadJson
      }
    }
    return { source: row.source ?? null, eventType: row.eventType ?? null, payload }
  })
}

type MissionActionContextInput = {
  mission: MissionSnapshot
  action: MissionAction
  signals: MissionSignalSnapshot[]
}

function formatPlanForDispatch(plan: MissionPlanStep[]): string {
  if (plan.length === 0) return "(no plan steps proposed)"
  return plan
    .map((step) => {
      const bits = [`${step.step}. ${step.description}`]
      if (step.tool) bits.push(`tool: \`${step.tool}\``)
      if (step.estimate) bits.push(`estimate: ${step.estimate}`)
      bits.push(`reversibility: ${step.reversibilityLabel || step.reversibility}`)
      return bits.join(" — ")
    })
    .join("\n")
}

function formatArtifactForDispatch(action: MissionAction): string {
  const artifact = action.artifact
  if (!artifact) return "(no pre-drafted artifact — generate one if the instruction requires output)"
  const lines = [`Kind: ${artifact.kind}`]
  if (artifact.title) lines.push(`Title: ${artifact.title}`)
  if (artifact.recipient) lines.push(`Recipient: ${artifact.recipient}`)
  lines.push("Body:", artifact.body)
  return lines.join("\n")
}

function formatSignalsForDispatch(signals: MissionSignalSnapshot[]): string {
  if (signals.length === 0) return "(none)"
  return signals
    .map((signal, index) => {
      const label = `${signal.source ?? "unknown"}/${signal.eventType ?? "event"}`
      // Keep the prompt bounded even if a payload is unusually large.
      const payloadJson = JSON.stringify(signal.payload ?? null, null, 2)
      const clipped = payloadJson.length > 3000 ? `${payloadJson.slice(0, 3000)}\n…` : payloadJson
      return `### signal ${index + 1} — ${label}\n${clipped}`
    })
    .join("\n\n")
}

function buildMissionActionContext(input: MissionActionContextInput): string {
  const { mission, action, signals } = input
  return [
    `[Argus mission execution]`,
    `You are executing a decision the user just approved. Follow the chosen action exactly.`,
    `If a pre-drafted artifact is present, treat the artifact body as the exact thing to send — do not rewrite unless the instruction explicitly asks for edits.`,
    ``,
    `# Mission: ${mission.title}`,
    ``,
    `# Analysis`,
    mission.analysisMarkdown || "(none)",
    ``,
    `# Recommended action (what Argus suggested)`,
    mission.recommendation || "(none)",
    ``,
    `# Plan (context — execute the chosen action, not every step)`,
    formatPlanForDispatch(mission.plan),
    ``,
    `# Chosen action`,
    `Label: ${action.label}`,
    `Key: ${action.key}`,
    `Instruction: ${action.actionPrompt || "(no explicit instruction — follow the artifact)"}`,
    ``,
    `# Pre-drafted artifact`,
    formatArtifactForDispatch(action),
    ``,
    `# Source signals (raw webhook payloads this mission was derived from)`,
    formatSignalsForDispatch(signals),
    ``,
    `# Output rules`,
    `- If you complete the action, return a short plain-text confirmation (one paragraph) describing what you did and any identifiers created.`,
    `- If you need the user to confirm anything further, explain what's needed and stop.`,
    `- Do NOT return JSON. This is executed output, not structured data for a parser.`,
  ].join("\n")
}

// ── Mission insertion ────────────────────────────────────────────────────

async function insertMissionFromCandidate(db: DB, candidate: MissionCandidate, agentName: string): Promise<string> {
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  // Use the first cited event as the triggering event for backward compat
  // with the existing schema column.
  const triggerEventId = candidate.citedEventIds[0] ?? null

  await db.insert(missions).values({
    id,
    status: "awaiting_decision",
    priority: candidate.priority,
    urgent: candidate.urgent,
    sourceProvider: candidate.sourceProvider,
    sourceEventType: candidate.sourceEventType,
    triggerWebhookEventId: triggerEventId,
    title: candidate.title,
    analysisMarkdown: candidate.analysisMarkdown,
    recommendation: candidate.recommendation,
    confidence: candidate.confidence,
    confidenceLabel: candidate.confidenceLabel || null,
    agentName,
    channelHint: null,
    planJson: JSON.stringify(candidate.plan),
    actionsJson: JSON.stringify(candidate.actions),
    metadataJson: "[]",
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  // Link every cited event that actually exists in the DB.
  if (candidate.citedEventIds.length > 0) {
    const existing = await db
      .select({ id: githubWebhookEvents.id })
      .from(githubWebhookEvents)
      .where(inArray(githubWebhookEvents.id, candidate.citedEventIds))

    for (const row of existing) {
      await db.insert(missionSignals).values({
        missionId: id,
        webhookEventId: row.id,
        label: row.id === triggerEventId ? "trigger" : "context",
        createdAt: timestamp,
      })
    }
  }

  console.log(`[missions] surfaced mission ${id} (${candidate.title.slice(0, 80)})`)
  return id
}

async function deleteMissionCascade(db: DB, missionId: string) {
  await db.delete(missionSignals).where(eq(missionSignals.missionId, missionId))
  await db.delete(schema.missionExecutions).where(eq(schema.missionExecutions.missionId, missionId))
  await db.delete(missions).where(eq(missions.id, missionId))
}

export {
  buildCriticPrompt,
  buildDocUpdatePrompt,
  buildGeneratorPrompt,
  buildMissionActionContext,
  deleteMissionCascade,
  insertMissionFromCandidate,
  loadMissionSignals,
  parseCandidates,
  parseVerdicts,
}
export type {
  EventGroup,
  GeneratorPromptInput,
  CriticPromptInput,
  DocUpdatePromptInput,
  MissionAction,
  MissionActionContextInput,
  MissionArtifact,
  MissionArtifactKind,
  MissionCandidate,
  MissionPlanStep,
  MissionSignalSnapshot,
  MissionSnapshot,
  RecentDecision,
  Verdict,
}

import crypto from "node:crypto"

import { eq, inArray } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import { extractAgentJson } from "./agent-json.js"
import { getConfiguredAgent, runAgent } from "./agent.js"
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

type MissionAction = {
  key: string
  label: string
  hotkey: string
  actionPrompt: string
}

type MissionBody = {
  title: string
  urgent: boolean
  priority: "low" | "normal" | "high"
  recommendation: string
  analysisMarkdown: string
  confidence: number
  confidenceLabel: string
  plan: MissionPlanStep[]
  actions: MissionAction[]
  additionalSignalEventIds?: number[]
}

type MissionOutput = { mission: null; reason: string } | { mission: MissionBody }

type GenerateMissionInput = {
  webhookEventId: number
  provider: string
  eventType: string
  payload: Record<string, unknown>
}

function buildMissionPrompt(input: GenerateMissionInput) {
  const schemaExample = {
    mission: {
      title: "Short, human-readable question or decision the user needs to make",
      urgent: false,
      priority: "normal",
      recommendation: "One-line recommended action, written as a direct verb phrase",
      analysisMarkdown:
        "A 2-4 paragraph prose analysis in Markdown. Cite concrete facts from the payload. **Bold** key numbers. Use `code` for identifiers.",
      confidence: 0.82,
      confidenceLabel: "short confidence tag (e.g. 'brin verified', 'values call', 'api impact')",
      plan: [
        {
          step: 1,
          description:
            "What the first step does, concretely. Wrap identifiers, emails, amounts, and enums in `backticks` so they render as inline code pills.",
          tool: "stripe.coupons.create",
          estimate: "~2s",
          reversibility: "reversible",
          reversibilityLabel: "reversible",
        },
      ],
      actions: [
        {
          key: "offer_credit",
          label: "Offer 50% credit",
          hotkey: "1",
          actionPrompt:
            "Plain-language instruction that will be handed to the coding agent if the user picks this action. Be specific.",
        },
      ],
      additionalSignalEventIds: [],
    },
  }

  const skipExample = {
    mission: null,
    reason: "Why this event does not warrant a mission (one short sentence).",
  }

  return [
    `[Argus mission generation]`,
    `You are Argus. A webhook event just arrived. Decide whether it warrants a "mission" — a decision the user should review.`,
    ``,
    `Source: ${input.provider}`,
    `Event: ${input.eventType}`,
    `Webhook event id: ${input.webhookEventId}`,
    ``,
    `[Event payload]`,
    JSON.stringify(input.payload, null, 2).slice(0, 6000),
    ``,
    `[Rules]`,
    `- Return valid JSON only. Do not wrap in markdown fences.`,
    `- If the event is routine (pings, trivial pushes, bot comments, noise), return: ${JSON.stringify(skipExample)}`,
    `- Otherwise return a mission object. Keep analysisMarkdown tight (≤ 4 paragraphs) and grounded in the payload — do not invent data.`,
    `- "plan" should have 3-6 concrete steps. "actions" should have 2-4 choices with hotkeys "1", "2", "3", "4".`,
    `- "confidence" is between 0 and 1. "priority" is one of "low" | "normal" | "high".`,
    `- "reversibility" per plan step is one of "reversible" | "auto" | "attention" (controls the dot color). "reversibilityLabel" is an optional short freeform label rendered next to the dot (e.g. "saved to drafts first", "30s recall window after send", "automatic"). When omitted, a default label is derived from reversibility.`,
    `- Plan step descriptions are rendered as Markdown — wrap identifiers, emails, amounts, statuses, and enums in \`backticks\` so they render as inline code pills.`,
    ``,
    `[Response schema example]`,
    JSON.stringify(schemaExample, null, 2),
  ].join("\n")
}

function isMissionBody(value: unknown): value is MissionBody {
  if (!value || typeof value !== "object") return false
  const body = value as Partial<MissionBody>
  return (
    typeof body.title === "string" &&
    typeof body.recommendation === "string" &&
    typeof body.analysisMarkdown === "string" &&
    typeof body.confidence === "number" &&
    Array.isArray(body.plan) &&
    Array.isArray(body.actions)
  )
}

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

function normalizeActions(actions: unknown): MissionAction[] {
  if (!Array.isArray(actions)) return []
  return actions
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null
      const action = raw as Partial<MissionAction>
      return {
        key: String(action.key ?? `action_${index + 1}`).trim(),
        label: String(action.label ?? "").trim(),
        hotkey: String(action.hotkey ?? String(index + 1)).trim(),
        actionPrompt: String(action.actionPrompt ?? "").trim(),
      } satisfies MissionAction
    })
    .filter((action): action is MissionAction => Boolean(action && action.label))
}

async function generateMission(db: DB, input: GenerateMissionInput): Promise<string | null> {
  const configured = getConfiguredAgent(db)
  if (!configured || configured.status !== "active") return null

  const prompt = buildMissionPrompt(input)

  let result
  try {
    result = await runAgent(configured.command, prompt)
  } catch (err) {
    console.error(`[missions] agent spawn failed:`, err)
    return null
  }

  if (result.exitCode !== 0) {
    console.warn(`[missions] agent exited with code ${result.exitCode} — skipping mission`)
    return null
  }

  const parsed = extractAgentJson<MissionOutput>(result.stdout || result.stderr || "")
  if (!parsed) {
    console.warn(`[missions] agent response did not contain JSON — skipping mission`)
    return null
  }

  if (parsed.mission === null) {
    console.log(`[missions] agent declined mission: ${parsed.reason ?? "no reason"}`)
    return null
  }

  if (!isMissionBody(parsed.mission)) {
    console.warn(`[missions] agent returned malformed mission object — skipping`)
    return null
  }

  return insertMission(db, input, parsed.mission, configured.name)
}

async function insertMission(
  db: DB,
  input: GenerateMissionInput,
  body: MissionBody,
  agentName: string,
): Promise<string> {
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const priority = body.priority === "low" || body.priority === "high" ? body.priority : "normal"

  await db.insert(missions).values({
    id,
    status: "awaiting_decision",
    priority,
    urgent: Boolean(body.urgent),
    sourceProvider: input.provider,
    sourceEventType: input.eventType,
    triggerWebhookEventId: input.webhookEventId,
    title: body.title.trim(),
    analysisMarkdown: body.analysisMarkdown.trim(),
    recommendation: body.recommendation.trim(),
    confidence: Math.max(0, Math.min(1, body.confidence)),
    confidenceLabel: body.confidenceLabel?.trim() || null,
    agentName,
    // channelHint and metadataJson are legacy columns kept nullable / empty
    // until a schema migration lands. The UI no longer reads either.
    channelHint: null,
    planJson: JSON.stringify(normalizePlan(body.plan)),
    actionsJson: JSON.stringify(normalizeActions(body.actions)),
    metadataJson: "[]",
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await db.insert(missionSignals).values({
    missionId: id,
    webhookEventId: input.webhookEventId,
    label: "trigger",
    createdAt: timestamp,
  })

  const additional = Array.isArray(body.additionalSignalEventIds)
    ? body.additionalSignalEventIds.filter((value): value is number => Number.isInteger(value))
    : []

  if (additional.length > 0) {
    const existing = await db
      .select({ id: githubWebhookEvents.id })
      .from(githubWebhookEvents)
      .where(inArray(githubWebhookEvents.id, additional))

    for (const row of existing) {
      if (row.id === input.webhookEventId) continue
      await db.insert(missionSignals).values({
        missionId: id,
        webhookEventId: row.id,
        label: "context",
        createdAt: timestamp,
      })
    }
  }

  console.log(`[missions] created mission ${id} (${body.title.slice(0, 80)})`)
  return id
}

async function deleteMissionCascade(db: DB, missionId: string) {
  await db.delete(missionSignals).where(eq(missionSignals.missionId, missionId))
  await db.delete(schema.missionExecutions).where(eq(schema.missionExecutions.missionId, missionId))
  await db.delete(missions).where(eq(missions.id, missionId))
}

export { deleteMissionCascade, generateMission }
export type { MissionAction, MissionBody, MissionOutput, MissionPlanStep }

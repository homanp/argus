import crypto from "node:crypto"

import { desc, eq, gte } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import { extractAgentJson } from "./agent-json.js"
import { getConfiguredAgent, runAgent } from "./agent.js"
import { emitEvent } from "./events.js"
import * as schema from "./db/schema.js"
import {
  githubWebhookEvents,
  missionDecisions,
  missionSettings,
  missionSuppressions,
  missions,
  operatingDoc,
  operatingDocUpdates,
} from "./db/schema.js"
import {
  buildCriticPrompt,
  buildDocUpdatePrompt,
  buildGeneratorPrompt,
  insertMissionFromCandidate,
  parseCandidates,
  parseVerdicts,
  type EventGroup,
  type MissionCandidate,
  type RecentDecision,
  type Verdict,
} from "./missions.js"

type DB = BetterSQLite3Database<typeof schema>

const SETTINGS_ID = "default"
const OPERATING_DOC_ID = "default"
const MIN_INTERVAL_MINUTES = 5
const MAX_INTERVAL_MINUTES = 60 * 24 * 7
const MIN_LOOKBACK_MINUTES = 5
const MAX_LOOKBACK_MINUTES = 60 * 24 * 30
const DEFAULT_OPERATING_DOC = [
  "# How I operate",
  "",
  "_Argus will update this as you make decisions. You can also edit it directly —",
  "anything you write here is treated as ground truth by the mission engine._",
  "",
].join("\n")

type MissionSettingsRow = typeof missionSettings.$inferSelect
type OperatingDocRow = typeof operatingDoc.$inferSelect

type ScanSummary = {
  scanId: string
  startedAt: string
  finishedAt: string | null
  windowMinutes: number
  eventCount: number
  groupCount: number
  candidateCount: number
  surfacedCount: number
  suppressedCount: number
  missionIds: string[]
  error?: string
}

function nowIso() {
  return new Date().toISOString()
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

// ── Settings ─────────────────────────────────────────────────────────────

function ensureMissionSettings(db: DB): MissionSettingsRow {
  const existing = db.select().from(missionSettings).where(eq(missionSettings.id, SETTINGS_ID)).get()
  if (existing) return existing

  const timestamp = nowIso()
  db.insert(missionSettings)
    .values({
      id: SETTINGS_ID,
      enabled: true,
      intervalMinutes: 60,
      lookbackMinutes: 120,
      lastScanAt: null,
      nextScanAt: addMinutes(timestamp, 60),
      lastScanSummaryJson: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run()

  return db.select().from(missionSettings).where(eq(missionSettings.id, SETTINGS_ID)).get() as MissionSettingsRow
}

function updateMissionSettings(
  db: DB,
  patch: Partial<Pick<MissionSettingsRow, "enabled" | "intervalMinutes" | "lookbackMinutes" | "nextScanAt">>,
): MissionSettingsRow {
  ensureMissionSettings(db)
  const updates: Partial<typeof missionSettings.$inferInsert> = { updatedAt: nowIso() }
  if (patch.enabled !== undefined) updates.enabled = patch.enabled
  if (patch.intervalMinutes !== undefined) {
    updates.intervalMinutes = Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, patch.intervalMinutes))
  }
  if (patch.lookbackMinutes !== undefined) {
    updates.lookbackMinutes = Math.max(MIN_LOOKBACK_MINUTES, Math.min(MAX_LOOKBACK_MINUTES, patch.lookbackMinutes))
  }
  if (patch.nextScanAt !== undefined) updates.nextScanAt = patch.nextScanAt
  db.update(missionSettings).set(updates).where(eq(missionSettings.id, SETTINGS_ID)).run()
  return db.select().from(missionSettings).where(eq(missionSettings.id, SETTINGS_ID)).get() as MissionSettingsRow
}

// ── Operating doc ────────────────────────────────────────────────────────

function ensureOperatingDoc(db: DB): OperatingDocRow {
  const existing = db.select().from(operatingDoc).where(eq(operatingDoc.id, OPERATING_DOC_ID)).get()
  if (existing) return existing

  const timestamp = nowIso()
  db.insert(operatingDoc)
    .values({
      id: OPERATING_DOC_ID,
      markdown: DEFAULT_OPERATING_DOC,
      updatedBy: "system",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run()

  return db.select().from(operatingDoc).where(eq(operatingDoc.id, OPERATING_DOC_ID)).get() as OperatingDocRow
}

function writeOperatingDoc(
  db: DB,
  nextMarkdown: string,
  source: "decision" | "manual",
  details: { reason?: string; missionId?: string; diff?: string } = {},
): OperatingDocRow {
  const current = ensureOperatingDoc(db)
  if (current.markdown === nextMarkdown) return current

  const timestamp = nowIso()
  db.insert(operatingDocUpdates)
    .values({
      before: current.markdown,
      after: nextMarkdown,
      diff: details.diff ?? null,
      reason: details.reason ?? null,
      source,
      missionId: details.missionId ?? null,
      createdAt: timestamp,
    })
    .run()

  db.update(operatingDoc)
    .set({
      markdown: nextMarkdown,
      updatedBy: source === "manual" ? "user" : "agent",
      updatedAt: timestamp,
    })
    .where(eq(operatingDoc.id, OPERATING_DOC_ID))
    .run()

  emitEvent("missions")
  return db.select().from(operatingDoc).where(eq(operatingDoc.id, OPERATING_DOC_ID)).get() as OperatingDocRow
}

// ── Windowed event reads ─────────────────────────────────────────────────

function loadEventsSince(db: DB, sinceIso: string): EventGroup[] {
  const rows = db
    .select({
      id: githubWebhookEvents.id,
      eventType: githubWebhookEvents.eventType,
      payloadJson: githubWebhookEvents.payloadJson,
    })
    .from(githubWebhookEvents)
    .where(gte(githubWebhookEvents.receivedAt, sinceIso))
    .orderBy(desc(githubWebhookEvents.receivedAt))
    .all()

  const groups = new Map<string, EventGroup>()
  for (const row of rows) {
    const key = `github.${row.eventType}`
    let group = groups.get(key)
    if (!group) {
      group = { provider: "github", eventType: row.eventType, count: 0, sampleTitles: [], ids: [] }
      groups.set(key, group)
    }
    group.count += 1
    group.ids.push(row.id)
    if (group.sampleTitles.length < 5) {
      const title = extractEventTitle(row.payloadJson, row.eventType)
      if (title) group.sampleTitles.push(title)
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count)
}

function extractEventTitle(payloadJson: string, eventType: string): string | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>
    const issue = payload.issue as Record<string, unknown> | undefined
    const pr = payload.pull_request as Record<string, unknown> | undefined
    const repo = payload.repository as Record<string, unknown> | undefined
    const action = typeof payload.action === "string" ? payload.action : null
    const repoName = typeof repo?.full_name === "string" ? repo.full_name : null

    if (issue && typeof issue.title === "string") {
      return `#${issue.number ?? "?"} ${issue.title}${action ? ` [${action}]` : ""}${repoName ? ` — ${repoName}` : ""}`
    }
    if (pr && typeof pr.title === "string") {
      return `PR #${pr.number ?? "?"} ${pr.title}${action ? ` [${action}]` : ""}${repoName ? ` — ${repoName}` : ""}`
    }
    if (action && repoName) return `${eventType} ${action} on ${repoName}`
    if (repoName) return `${eventType} on ${repoName}`
    return null
  } catch {
    return null
  }
}

// ── Recent decisions ─────────────────────────────────────────────────────

function loadRecentDecisions(db: DB, limit: number): RecentDecision[] {
  const rows = db
    .select({
      kind: missionDecisions.kind,
      actionKey: missionDecisions.actionKey,
      createdAt: missionDecisions.createdAt,
      missionTitle: missions.title,
    })
    .from(missionDecisions)
    .leftJoin(missions, eq(missionDecisions.missionId, missions.id))
    .orderBy(desc(missionDecisions.createdAt))
    .limit(limit)
    .all()

  return rows.map((row) => ({
    kind: row.kind,
    actionKey: row.actionKey,
    createdAt: row.createdAt,
    missionTitle: row.missionTitle,
  }))
}

// ── Scan orchestration ───────────────────────────────────────────────────

async function runMissionScan(
  db: DB,
  opts: { trigger: "cron" | "manual" } = { trigger: "cron" },
): Promise<ScanSummary> {
  const settings = ensureMissionSettings(db)
  const scanId = crypto.randomUUID()
  const startedAt = nowIso()
  const sinceIso = addMinutes(startedAt, -settings.lookbackMinutes)

  const groups = loadEventsSince(db, sinceIso)
  const eventCount = groups.reduce((sum, g) => sum + g.count, 0)

  const summary: ScanSummary = {
    scanId,
    startedAt,
    finishedAt: null,
    windowMinutes: settings.lookbackMinutes,
    eventCount,
    groupCount: groups.length,
    candidateCount: 0,
    surfacedCount: 0,
    suppressedCount: 0,
    missionIds: [],
  }

  // Always advance the cursor even if the scan short-circuits.
  updateMissionSettings(db, {
    nextScanAt: addMinutes(startedAt, settings.intervalMinutes),
  })
  db.update(missionSettings)
    .set({ lastScanAt: startedAt, updatedAt: startedAt })
    .where(eq(missionSettings.id, SETTINGS_ID))
    .run()

  const configured = getConfiguredAgent(db)
  if (!configured || configured.status !== "active") {
    summary.error = "No agent configured"
    summary.finishedAt = nowIso()
    persistSummary(db, summary)
    console.log(`[mission-engine] scan ${scanId} skipped — no agent configured`)
    return summary
  }

  if (eventCount === 0) {
    summary.finishedAt = nowIso()
    persistSummary(db, summary)
    console.log(`[mission-engine] scan ${scanId} — window empty (${settings.lookbackMinutes}m lookback)`)
    return summary
  }

  const opDoc = ensureOperatingDoc(db).markdown
  const recentDecisions = loadRecentDecisions(db, 20)

  // Phase 1 — generator
  let candidates: MissionCandidate[] = []
  try {
    const genPrompt = buildGeneratorPrompt({
      operatingDoc: opDoc,
      recentDecisions,
      groups,
      windowMinutes: settings.lookbackMinutes,
    })
    const genResult = await runAgent(configured.command, genPrompt)
    if (genResult.exitCode !== 0) {
      throw new Error(`generator exited with code ${genResult.exitCode}: ${genResult.stderr.slice(0, 200)}`)
    }
    const parsed = extractAgentJson<unknown>(genResult.stdout || genResult.stderr || "")
    candidates = parseCandidates(parsed)
    summary.candidateCount = candidates.length
  } catch (err) {
    summary.error = `generator: ${err instanceof Error ? err.message : String(err)}`
    summary.finishedAt = nowIso()
    persistSummary(db, summary)
    console.error(`[mission-engine] scan ${scanId} generator failed:`, err)
    return summary
  }

  if (candidates.length === 0) {
    summary.finishedAt = nowIso()
    persistSummary(db, summary)
    console.log(`[mission-engine] scan ${scanId} — 0 candidates from ${eventCount} events`)
    return summary
  }

  // Phase 2 — critic
  let verdicts: Verdict[] = []
  try {
    const critPrompt = buildCriticPrompt({ operatingDoc: opDoc, recentDecisions, candidates })
    const critResult = await runAgent(configured.command, critPrompt)
    if (critResult.exitCode !== 0) {
      throw new Error(`critic exited with code ${critResult.exitCode}: ${critResult.stderr.slice(0, 200)}`)
    }
    const parsed = extractAgentJson<unknown>(critResult.stdout || critResult.stderr || "")
    verdicts = parseVerdicts(parsed)
  } catch (err) {
    summary.error = `critic: ${err instanceof Error ? err.message : String(err)}`
    summary.finishedAt = nowIso()
    persistSummary(db, summary)
    console.error(`[mission-engine] scan ${scanId} critic failed:`, err)
    return summary
  }

  const createdAt = nowIso()
  for (const candidate of candidates) {
    const verdict =
      verdicts.find((v) => v.id === candidate.id) ??
      ({ id: candidate.id, verdict: "suppress", reason: "no verdict from critic" } satisfies Verdict)
    if (verdict.verdict === "surface") {
      const missionId = await insertMissionFromCandidate(db, candidate, configured.name)
      summary.surfacedCount += 1
      summary.missionIds.push(missionId)
    } else {
      db.insert(missionSuppressions)
        .values({
          scanId,
          candidateJson: JSON.stringify(candidate),
          verdict: "suppress",
          reason: verdict.reason || "no reason given",
          createdAt,
        })
        .run()
      summary.suppressedCount += 1
    }
  }

  summary.finishedAt = nowIso()
  persistSummary(db, summary)
  console.log(
    `[mission-engine] scan ${scanId} — ${eventCount} events → ${candidates.length} candidates → ${summary.surfacedCount} surfaced, ${summary.suppressedCount} suppressed${opts.trigger === "manual" ? " (manual)" : ""}`,
  )
  return summary
}

function persistSummary(db: DB, summary: ScanSummary) {
  db.update(missionSettings)
    .set({ lastScanSummaryJson: JSON.stringify(summary), updatedAt: nowIso() })
    .where(eq(missionSettings.id, SETTINGS_ID))
    .run()
  // Every scan end is an observable state change — surfaced missions land
  // in the list, suppressions land in Insights, settings change timestamps.
  // One broadcast covers all of those for subscribed tabs.
  emitEvent("missions")
}

// ── Tick (called from scheduler) ─────────────────────────────────────────

let inflight: Promise<unknown> | null = null

function missionEngineTick(db: DB) {
  if (inflight) return // guard against overlapping scans when the agent is slow
  const settings = ensureMissionSettings(db)
  if (!settings.enabled) return
  if (!settings.nextScanAt) {
    updateMissionSettings(db, { nextScanAt: addMinutes(nowIso(), settings.intervalMinutes) })
    return
  }
  if (new Date(settings.nextScanAt).getTime() > Date.now()) return

  inflight = runMissionScan(db, { trigger: "cron" })
    .catch((err) => {
      console.error("[mission-engine] tick failed:", err)
    })
    .finally(() => {
      inflight = null
    })
}

// ── Operating-doc auto-update on user decisions ──────────────────────────

type DecisionRecord = {
  missionId: string
  kind: "approved" | "dismissed" | "deleted" | "edited"
  actionKey: string | null
  missionTitle: string
  missionRecommendation: string
}

async function updateOperatingDocFromDecision(db: DB, decision: DecisionRecord): Promise<void> {
  const configured = getConfiguredAgent(db)
  if (!configured || configured.status !== "active") return

  const current = ensureOperatingDoc(db).markdown
  const prompt = buildDocUpdatePrompt({
    operatingDoc: current,
    decisionKind: decision.kind,
    actionKey: decision.actionKey,
    missionTitle: decision.missionTitle,
    missionRecommendation: decision.missionRecommendation,
  })

  let parsed: { diff?: string | null; reason?: string } | null = null
  try {
    const result = await runAgent(configured.command, prompt)
    if (result.exitCode !== 0) return
    parsed = extractAgentJson<{ diff?: string | null; reason?: string }>(result.stdout || result.stderr || "")
  } catch (err) {
    console.error("[opdoc] agent call failed:", err)
    return
  }

  if (!parsed || typeof parsed.diff !== "string" || !parsed.diff.trim()) return

  const diff = parsed.diff.trim()
  const next = current.endsWith("\n") ? `${current}${diff}\n` : `${current}\n\n${diff}\n`
  writeOperatingDoc(db, next, "decision", {
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    missionId: decision.missionId,
    diff,
  })
}

function recordDecision(db: DB, missionId: string, kind: DecisionRecord["kind"], actionKey: string | null) {
  db.insert(missionDecisions)
    .values({
      missionId,
      kind,
      actionKey,
      createdAt: nowIso(),
    })
    .run()
}

// ── Revert helper ────────────────────────────────────────────────────────

function revertOperatingDocUpdate(db: DB, updateId: number): OperatingDocRow {
  const row = db.select().from(operatingDocUpdates).where(eq(operatingDocUpdates.id, updateId)).get()
  if (!row) throw new Error("Operating doc update not found.")
  return writeOperatingDoc(db, row.before, "manual", {
    reason: `Reverted update #${updateId}`,
  })
}

export {
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
  MIN_LOOKBACK_MINUTES,
  MAX_LOOKBACK_MINUTES,
  ensureMissionSettings,
  ensureOperatingDoc,
  missionEngineTick,
  recordDecision,
  revertOperatingDocUpdate,
  runMissionScan,
  updateMissionSettings,
  updateOperatingDocFromDecision,
  writeOperatingDoc,
}
export type { DecisionRecord, MissionSettingsRow, OperatingDocRow, ScanSummary }

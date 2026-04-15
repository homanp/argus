import crypto from "node:crypto"
import path from "node:path"

import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import { and, count, desc, eq, inArray, max } from "drizzle-orm"

import { checkCliInstalled, checkSkillInstalled, detectInstalledAgents, getConfiguredAgent, runAgent } from "./agent.js"
import { createDatabase } from "./db/client.js"
import {
  agent as agentTable,
  githubRepositories,
  githubWebhookEvents,
  integrations,
  scheduleExecutions,
  schedules,
  triggerExecutions,
  triggers,
} from "./db/schema.js"
import { startScheduler, computeNextRunAt, isValidCron } from "./scheduler.js"
import { startTunnel, stopTunnel } from "./tunnel.js"

dotenv.config()

type GitHubUser = {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string | null
}

type GitHubRepository = {
  id: number
  name: string
  full_name: string
  default_branch: string | null
  owner: {
    login: string
  }
  private: boolean
  html_url: string
}

type GitHubWebhookPayload = {
  repository?: {
    id?: number
    full_name?: string
  }
  sender?: {
    login?: string
  }
}

type GitHubHook = {
  id: number
  events: string[]
  active: boolean
  config: {
    url?: string
    content_type?: string
  }
}

const GITHUB_STATIC_EVENTS = [
  "branch_protection_rule",
  "check_run",
  "check_suite",
  "code_scanning_alert",
  "commit_comment",
  "create",
  "delete",
  "dependabot_alert",
  "deploy_key",
  "deployment",
  "deployment_status",
  "discussion",
  "discussion_comment",
  "fork",
  "gollum",
  "issue_comment",
  "issues",
  "label",
  "member",
  "merge_group",
  "milestone",
  "package",
  "page_build",
  "ping",
  "project",
  "project_card",
  "project_column",
  "public",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "push",
  "registry_package",
  "release",
  "repository",
  "repository_dispatch",
  "secret_scanning_alert",
  "star",
  "status",
  "watch",
  "workflow_dispatch",
  "workflow_job",
  "workflow_run",
]

type IntegrationRow = typeof integrations.$inferSelect
type RepositoryRow = typeof githubRepositories.$inferSelect
type WebhookEventRow = typeof githubWebhookEvents.$inferSelect
type TriggerRow = typeof triggers.$inferSelect
type ScheduleRow = typeof schedules.$inferSelect

const config: {
  port: number
  relayBaseUrl: string
  relayDbPath: string
  githubWebhookSecretFallback: string
} = {
  port: Number(process.env.PORT ?? "8787"),
  relayBaseUrl: process.env.RELAY_BASE_URL ?? "http://127.0.0.1:8787",
  relayDbPath: process.env.RELAY_DB_PATH ?? path.join(process.cwd(), "data", "relay.db"),
  githubWebhookSecretFallback: process.env.GITHUB_WEBHOOK_SECRET ?? "",
}

function shouldAutoTunnel() {
  const explicit = process.env.RELAY_BASE_URL ?? ""
  if (!explicit) {
    return true
  }

  try {
    const url = new URL(explicit)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0"
  } catch {
    return false
  }
}

const { sqlite, db } = createDatabase(config.relayDbPath)
const app = express()

function now() {
  return new Date().toISOString()
}

async function githubRequest<T>(apiKey: string, route: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com${route}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "argus-relay/0.1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `GitHub request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

async function fetchGitHubUser(apiKey: string) {
  return githubRequest<GitHubUser>(apiKey, "/user")
}

async function fetchGitHubRepositories(apiKey: string) {
  const repositories: GitHubRepository[] = []
  let page = 1

  while (true) {
    const pageResults = await githubRequest<GitHubRepository[]>(
      apiKey,
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    )

    repositories.push(...pageResults)

    if (pageResults.length < 100) {
      break
    }

    page += 1
  }

  return repositories
}

async function createGitHubWebhook(
  apiKey: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
): Promise<number | null> {
  try {
    const hook = await githubRequest<GitHubHook>(apiKey, `/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      body: JSON.stringify({
        name: "web",
        active: true,
        events: GITHUB_STATIC_EVENTS,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
      }),
    })
    return hook.id
  } catch {
    return null
  }
}

async function updateGitHubWebhookUrl(
  apiKey: string,
  owner: string,
  repo: string,
  hookId: number,
  webhookUrl: string,
  secret: string,
): Promise<boolean> {
  try {
    await githubRequest<GitHubHook>(apiKey, `/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: "PATCH",
      body: JSON.stringify({
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
      }),
    })
    return true
  } catch {
    return false
  }
}

async function deleteGitHubWebhook(apiKey: string, owner: string, repo: string, hookId: number): Promise<void> {
  try {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "argus-relay/0.1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
  } catch {
    // Best-effort cleanup
  }
}

async function syncAllWebhookUrls() {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))

  if (!integration?.apiKey) return

  const repos: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(and(eq(githubRepositories.integrationId, integration.id), eq(githubRepositories.isSelected, true)))

  let updated = 0

  for (const repo of repos) {
    if (!repo.webhookKey || !repo.webhookSecret) continue

    const webhookUrl = `${config.relayBaseUrl}/webhooks/github/${repo.webhookKey}`

    if (repo.githubWebhookId) {
      const success = await updateGitHubWebhookUrl(
        integration.apiKey,
        repo.owner,
        repo.name,
        repo.githubWebhookId,
        webhookUrl,
        repo.webhookSecret,
      )
      if (success) {
        updated += 1
      } else {
        // Hook may have been deleted on GitHub — recreate it
        const newHookId = await createGitHubWebhook(
          integration.apiKey,
          repo.owner,
          repo.name,
          webhookUrl,
          repo.webhookSecret,
        )
        if (newHookId) {
          await db
            .update(githubRepositories)
            .set({ githubWebhookId: newHookId, webhookStatus: "active", updatedAt: now() })
            .where(eq(githubRepositories.id, repo.id))
          updated += 1
        }
      }
    } else {
      const hookId = await createGitHubWebhook(
        integration.apiKey,
        repo.owner,
        repo.name,
        webhookUrl,
        repo.webhookSecret,
      )
      if (hookId) {
        await db
          .update(githubRepositories)
          .set({ githubWebhookId: hookId, webhookStatus: "active", updatedAt: now() })
          .where(eq(githubRepositories.id, repo.id))
        updated += 1
      }
    }
  }

  if (updated > 0) {
    console.log(`Updated ${updated} webhook(s) to ${config.relayBaseUrl}`)
  }
}

async function upsertGitHubIntegration(apiKey: string) {
  const user = await fetchGitHubUser(apiKey)
  const repositories = await fetchGitHubRepositories(apiKey)
  const timestamp = now()

  const [existingIntegration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))

  if (existingIntegration) {
    await db
      .update(integrations)
      .set({
        displayName: "GitHub",
        apiKey,
        status: "connected",
        externalAccountId: String(user.id),
        accountLogin: user.login,
        accountName: user.name ?? user.login,
        accountEmail: user.email,
        accountAvatarUrl: user.avatar_url,
        lastValidatedAt: timestamp,
        lastError: null,
        updatedAt: timestamp,
      })
      .where(eq(integrations.id, existingIntegration.id))
  } else {
    await db.insert(integrations).values({
      id: crypto.randomUUID(),
      provider: "github",
      displayName: "GitHub",
      apiKey,
      status: "connected",
      externalAccountId: String(user.id),
      accountLogin: user.login,
      accountName: user.name ?? user.login,
      accountEmail: user.email,
      accountAvatarUrl: user.avatar_url,
      lastValidatedAt: timestamp,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))
  if (!integration) {
    throw new Error("Failed to persist GitHub integration.")
  }

  const existingRepositories: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.integrationId, integration.id))
  const existingByRepositoryId = new Map<string, RepositoryRow>(
    existingRepositories.map((repo) => [repo.repositoryId, repo]),
  )

  const incomingIds = repositories.map((repository) => String(repository.id))
  const staleRepositoryIds = existingRepositories
    .filter((repository) => !incomingIds.includes(repository.repositoryId))
    .map((repository) => repository.repositoryId)

  if (staleRepositoryIds.length > 0) {
    await db
      .delete(githubRepositories)
      .where(
        and(
          eq(githubRepositories.integrationId, integration.id),
          inArray(githubRepositories.repositoryId, staleRepositoryIds),
        ),
      )
  }

  for (const repository of repositories) {
    const repositoryId = String(repository.id)
    const existing = existingByRepositoryId.get(repositoryId)

    if (existing) {
      await db
        .update(githubRepositories)
        .set({
          owner: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          defaultBranch: repository.default_branch,
          private: repository.private,
          htmlUrl: repository.html_url,
          lastSyncedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(githubRepositories.id, existing.id))
    } else {
      await db.insert(githubRepositories).values({
        integrationId: integration.id,
        repositoryId,
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        private: repository.private,
        htmlUrl: repository.html_url,
        isSelected: false,
        webhookStatus: "not_configured",
        lastSyncedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }

  return getGitHubIntegrationState()
}

async function getGitHubIntegrationState() {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))
  const repositories: RepositoryRow[] = integration
    ? await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.integrationId, integration.id))
        .orderBy(githubRepositories.fullName)
    : []
  const recentEvents: WebhookEventRow[] = integration
    ? await db
        .select()
        .from(githubWebhookEvents)
        .where(eq(githubWebhookEvents.integrationId, integration.id))
        .orderBy(desc(githubWebhookEvents.receivedAt))
        .limit(10)
    : []

  return {
    provider: "github",
    displayName: "GitHub",
    status: integration?.status ?? "not_connected",
    apiKeyConfigured: Boolean(integration?.apiKey),
    relayBaseUrl: config.relayBaseUrl,
    supportedEvents: ["push", "pull_request", "issues", "issue_comment"],
    account: integration
      ? {
          login: integration.accountLogin,
          name: integration.accountName,
          email: integration.accountEmail,
          avatarUrl: integration.accountAvatarUrl,
          lastValidatedAt: integration.lastValidatedAt,
          lastError: integration.lastError,
        }
      : null,
    repositories: repositories.map((repository) => ({
      id: repository.repositoryId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      private: Boolean(repository.private),
      selected: Boolean(repository.isSelected),
      webhookUrl: repository.webhookKey ? `${config.relayBaseUrl}/webhooks/github/${repository.webhookKey}` : null,
      webhookSecret: repository.webhookSecret ?? null,
      webhookManaged: Boolean(repository.githubWebhookId),
      webhookStatus: repository.webhookStatus,
      webhookLastReceivedAt: repository.webhookLastReceivedAt,
      htmlUrl: repository.htmlUrl,
      defaultBranch: repository.defaultBranch,
      lastSyncedAt: repository.lastSyncedAt,
    })),
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      source: event.source,
      repositoryId: event.repositoryId,
      receivedAt: event.receivedAt,
      payloadJson: JSON.parse(event.payloadJson),
    })),
  }
}

async function ensureRepositoryWebhookConfig(repositoryId: string) {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))
  if (!integration) {
    throw new Error("GitHub integration is not configured.")
  }

  const [repository]: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(and(eq(githubRepositories.integrationId, integration.id), eq(githubRepositories.repositoryId, repositoryId)))

  if (!repository) {
    throw new Error("GitHub repository not found.")
  }

  if (!repository.webhookKey || !repository.webhookSecret) {
    await db
      .update(githubRepositories)
      .set({
        webhookKey: repository.webhookKey ?? crypto.randomUUID(),
        webhookSecret: repository.webhookSecret ?? crypto.randomUUID().replace(/-/g, ""),
        webhookStatus: "ready",
        updatedAt: now(),
      })
      .where(eq(githubRepositories.id, repository.id))
  }

  return getGitHubIntegrationState()
}

async function setRepositorySelected(repositoryId: string, enabled: boolean) {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))
  if (!integration) {
    throw new Error("GitHub integration is not configured.")
  }

  const [repository]: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(and(eq(githubRepositories.integrationId, integration.id), eq(githubRepositories.repositoryId, repositoryId)))

  if (!repository) {
    throw new Error("GitHub repository not found.")
  }

  const updates: Partial<typeof githubRepositories.$inferInsert> = {
    isSelected: enabled,
    updatedAt: now(),
  }

  if (enabled) {
    const webhookKey = repository.webhookKey ?? crypto.randomUUID()
    const webhookSecret = repository.webhookSecret ?? crypto.randomUUID().replace(/-/g, "")
    updates.webhookKey = webhookKey
    updates.webhookSecret = webhookSecret

    if (integration.apiKey) {
      const webhookUrl = `${config.relayBaseUrl}/webhooks/github/${webhookKey}`
      const hookId = await createGitHubWebhook(
        integration.apiKey,
        repository.owner,
        repository.name,
        webhookUrl,
        webhookSecret,
      )
      if (hookId) {
        updates.githubWebhookId = hookId
        updates.webhookStatus = "active"
      } else {
        updates.webhookStatus = "ready"
      }
    } else {
      updates.webhookStatus = "ready"
    }
  } else {
    if (repository.githubWebhookId && integration.apiKey) {
      await deleteGitHubWebhook(integration.apiKey, repository.owner, repository.name, repository.githubWebhookId)
    }
    updates.githubWebhookId = null
    updates.webhookStatus = "not_configured"
  }

  await db.update(githubRepositories).set(updates).where(eq(githubRepositories.id, repository.id))
  return getGitHubIntegrationState()
}

async function recordWebhookEvent({
  repository,
  deliveryId,
  eventType,
  source,
  payload,
  receivedAt,
}: {
  repository: typeof githubRepositories.$inferSelect
  deliveryId: string
  eventType: string
  source: string
  payload: Record<string, unknown>
  receivedAt: string
}) {
  const result = db
    .insert(githubWebhookEvents)
    .values({
      integrationId: repository.integrationId,
      repositoryId: repository.repositoryId,
      deliveryId,
      eventType,
      source,
      payloadJson: JSON.stringify(payload),
      receivedAt,
    })
    .returning({ id: githubWebhookEvents.id })

  const [inserted] = await result

  await db
    .update(githubRepositories)
    .set({
      webhookStatus: source === "test" ? "test_passed" : "active",
      webhookLastReceivedAt: receivedAt,
      updatedAt: receivedAt,
    })
    .where(eq(githubRepositories.id, repository.id))

  if (inserted) {
    await evaluateTriggers(inserted.id, "github", eventType, payload)
  }
}

type TriggerCondition = {
  field: string
  operator: "equals" | "not_equals" | "contains"
  value: string
}

function resolveField(object: Record<string, unknown>, path: string): unknown[] {
  let current: unknown[] = [object]

  for (const segment of path.split(".")) {
    const next: unknown[] = []
    for (const node of current) {
      if (node == null || typeof node !== "object") continue
      if (Array.isArray(node)) {
        for (const item of node) {
          if (item != null && typeof item === "object") {
            const val = (item as Record<string, unknown>)[segment]
            if (val !== undefined) next.push(val)
          }
        }
      } else {
        const val = (node as Record<string, unknown>)[segment]
        if (val !== undefined) next.push(val)
      }
    }
    current = next
  }

  return current
}

function matchesCondition(values: unknown[], operator: TriggerCondition["operator"], expected: string): boolean {
  if (values.length === 0) {
    return operator === "not_equals"
  }

  const strings = values.map((v) => (v == null ? "" : String(v)))

  switch (operator) {
    case "equals":
      return strings.some((s) => s === expected)
    case "not_equals":
      return strings.every((s) => s !== expected)
    case "contains":
      return strings.some((s) => s.includes(expected))
  }
}

function evaluateConditions(payload: Record<string, unknown>, conditions: TriggerCondition[]): boolean {
  for (const condition of conditions) {
    const values = resolveField(payload, condition.field)
    if (!matchesCondition(values, condition.operator, condition.value)) return false
  }
  return true
}

function buildTriggerContext(
  trigger: TriggerRow,
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const lines = [
    `[Trigger: ${trigger.name}]`,
    `Source: ${provider}`,
    `Event: ${eventType}`,
    ``,
    `[Event payload]`,
    JSON.stringify(payload),
    ``,
    `[Task]`,
    trigger.actionPrompt,
  ]
  return lines.join("\n")
}

async function evaluateTriggers(
  webhookEventId: number,
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const matchingTriggers: TriggerRow[] = await db
    .select()
    .from(triggers)
    .where(and(eq(triggers.provider, provider), eq(triggers.eventType, eventType), eq(triggers.enabled, true)))

  let fired = 0
  const timestamp = now()

  for (const trigger of matchingTriggers) {
    const conditions: TriggerCondition[] = trigger.conditionsJson
      ? (JSON.parse(trigger.conditionsJson) as TriggerCondition[])
      : []

    if (conditions.length === 0 || evaluateConditions(payload, conditions)) {
      const [execution] = await db
        .insert(triggerExecutions)
        .values({
          triggerId: trigger.id,
          webhookEventId,
          matchedAt: timestamp,
          status: trigger.actionPrompt ? "running" : "matched",
        })
        .returning()

      fired += 1

      if (trigger.actionPrompt) {
        const configured = getConfiguredAgent(db)
        if (configured && configured.status === "active") {
          const enrichedPrompt = buildTriggerContext(trigger, provider, eventType, payload)
          runAgent(configured.command, enrichedPrompt)
            .then((result) => {
              const finished = new Date().toISOString()
              const status = result.exitCode === 0 ? "completed" : "failed"
              const resultMessage = result.stdout || result.stderr || `exit ${result.exitCode}`

              db.update(triggerExecutions)
                .set({ status, finishedAt: finished, resultMessage: resultMessage.slice(0, 4000) })
                .where(eq(triggerExecutions.id, execution.id))
                .run()

              db.update(agentTable)
                .set({ lastUsedAt: finished, updatedAt: finished })
                .where(eq(agentTable.id, "default"))
                .run()
              console.log(`[agent] trigger "${trigger.name}" → exit ${result.exitCode}`)
            })
            .catch((err) => {
              db.update(triggerExecutions)
                .set({ status: "failed", finishedAt: new Date().toISOString(), resultMessage: String(err) })
                .where(eq(triggerExecutions.id, execution.id))
                .run()
              console.error(`[agent] trigger "${trigger.name}" failed:`, err)
            })
        }
      }
    }
  }

  if (fired > 0) {
    console.log(`${fired} trigger(s) fired for ${provider}/${eventType}`)
  }

  return fired
}

function verifySignature(rawBody: Buffer, secret: string, signatureHeader: string | undefined) {
  if (!signatureHeader) {
    return false
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const expected = Buffer.from(`sha256=${digest}`)
  const actual = Buffer.from(signatureHeader)

  if (expected.length !== actual.length) {
    return false
  }

  return crypto.timingSafeEqual(expected, actual)
}

app.use(
  cors({
    origin: "*",
  }),
)

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    relayBaseUrl: config.relayBaseUrl,
  })
})

app.get("/api/integrations/github", async (_request, response) => {
  response.json(await getGitHubIntegrationState())
})

app.post("/api/integrations/github/connect", express.json(), async (request, response) => {
  const apiKey = typeof request.body?.apiKey === "string" ? request.body.apiKey.trim() : ""

  if (!apiKey) {
    response.status(400).json({ error: "API key is required." })
    return
  }

  try {
    const state = await upsertGitHubIntegration(apiKey)
    response.json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect GitHub."

    const [integration] = await db.select().from(integrations).where(eq(integrations.provider, "github"))
    if (integration) {
      await db
        .update(integrations)
        .set({
          status: "error",
          lastError: message,
          updatedAt: now(),
        })
        .where(eq(integrations.id, integration.id))
    }

    response.status(500).json({ error: message })
  }
})

app.post("/api/integrations/github/sync", async (_request, response) => {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))

  if (!integration?.apiKey) {
    response.status(400).json({ error: "Connect GitHub with an API key first." })
    return
  }

  try {
    response.json(await upsertGitHubIntegration(integration.apiKey))
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sync GitHub repositories.",
    })
  }
})

app.post("/api/integrations/github/repositories/:repositoryId/select", express.json(), async (request, response) => {
  const enabled = Boolean(request.body?.enabled)

  try {
    const state = await setRepositorySelected(request.params.repositoryId, enabled)
    response.json(state)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update repository selection.",
    })
  }
})

app.post("/api/integrations/github/repositories/:repositoryId/webhook/configure", async (request, response) => {
  try {
    const state = await ensureRepositoryWebhookConfig(request.params.repositoryId)
    response.json(state)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to prepare webhook configuration.",
    })
  }
})

app.get("/api/integrations/github/available-events", async (_request, response) => {
  const [integration]: IntegrationRow[] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "github"))

  if (!integration?.apiKey) {
    response.json({ events: GITHUB_STATIC_EVENTS, source: "static_fallback" })
    return
  }

  const selectedRepos: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(and(eq(githubRepositories.integrationId, integration.id), eq(githubRepositories.isSelected, true)))

  if (selectedRepos.length === 0) {
    response.json({ events: GITHUB_STATIC_EVENTS, source: "static_fallback" })
    return
  }

  try {
    const allEvents = new Set<string>()

    for (const repo of selectedRepos) {
      try {
        const hooks = await githubRequest<GitHubHook[]>(integration.apiKey, `/repos/${repo.owner}/${repo.name}/hooks`)
        for (const hook of hooks) {
          for (const event of hook.events) {
            if (event === "*") {
              for (const e of GITHUB_STATIC_EVENTS) allEvents.add(e)
            } else {
              allEvents.add(event)
            }
          }
        }
      } catch {
        // Individual repo may fail if PAT lacks admin:repo_hook — skip it
      }
    }

    if (allEvents.size === 0) {
      response.json({ events: GITHUB_STATIC_EVENTS, source: "static_fallback" })
      return
    }

    response.json({ events: [...allEvents].sort(), source: "github_api" })
  } catch {
    response.json({ events: GITHUB_STATIC_EVENTS, source: "static_fallback" })
  }
})

app.post("/api/integrations/github/repositories/:repositoryId/test-webhook", async (request, response) => {
  const [integration] = await db.select().from(integrations).where(eq(integrations.provider, "github"))
  if (!integration) {
    response.status(400).json({ error: "GitHub integration is not configured." })
    return
  }

  const [repository]: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(
      and(
        eq(githubRepositories.integrationId, integration.id),
        eq(githubRepositories.repositoryId, request.params.repositoryId),
      ),
    )

  if (!repository) {
    response.status(404).json({ error: "GitHub repository not found." })
    return
  }

  const receivedAt = now()
  const payload = {
    action: "test",
    repository: {
      id: Number(repository.repositoryId),
      full_name: repository.fullName,
      html_url: repository.htmlUrl,
    },
    sender: {
      login: integration.accountLogin,
    },
  }

  await recordWebhookEvent({
    repository,
    deliveryId: `test-${crypto.randomUUID()}`,
    eventType: "ping",
    source: "test",
    payload,
    receivedAt,
  })

  response.json(await getGitHubIntegrationState())
})

app.post("/webhooks/github/:webhookKey", express.raw({ type: "*/*" }), async (request, response) => {
  const [repository]: RepositoryRow[] = await db
    .select()
    .from(githubRepositories)
    .where(eq(githubRepositories.webhookKey, request.params.webhookKey))

  if (!repository || !repository.webhookSecret) {
    response.status(404).json({ error: "Unknown webhook target." })
    return
  }

  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body ?? ""))
  if (!verifySignature(rawBody, repository.webhookSecret, request.header("x-hub-signature-256"))) {
    response.status(401).json({ error: "Invalid webhook signature." })
    return
  }

  const eventType = request.header("x-github-event") ?? "unknown"
  const deliveryId = request.header("x-github-delivery") ?? crypto.randomUUID()
  const payload = JSON.parse(rawBody.toString("utf8")) as GitHubWebhookPayload
  const receivedAt = now()

  try {
    await recordWebhookEvent({
      repository,
      deliveryId,
      eventType,
      source: "github",
      payload: payload as unknown as Record<string, unknown>,
      receivedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store webhook event."
    if (!message.includes("UNIQUE")) {
      response.status(500).json({ error: message })
      return
    }
  }

  response.json({ ok: true })
})

// --- Triggers CRUD ---

app.get("/api/triggers", async (_request, response) => {
  const allTriggers: TriggerRow[] = await db.select().from(triggers).orderBy(desc(triggers.createdAt))

  const executionCounts = await db
    .select({ triggerId: triggerExecutions.triggerId, count: count() })
    .from(triggerExecutions)
    .groupBy(triggerExecutions.triggerId)
  const countMap = new Map(executionCounts.map((row) => [row.triggerId, row.count]))

  const lastExecutions = await db
    .select({ triggerId: triggerExecutions.triggerId, lastMatchedAt: max(triggerExecutions.matchedAt) })
    .from(triggerExecutions)
    .groupBy(triggerExecutions.triggerId)
  const lastFiredMap = new Map(lastExecutions.map((row) => [row.triggerId, row.lastMatchedAt]))

  response.json(
    allTriggers.map((trigger) => ({
      id: trigger.id,
      name: trigger.name,
      provider: trigger.provider,
      eventType: trigger.eventType,
      conditions: trigger.conditionsJson ? JSON.parse(trigger.conditionsJson) : [],
      actionPrompt: trigger.actionPrompt ?? null,
      enabled: Boolean(trigger.enabled),
      executionCount: countMap.get(trigger.id) ?? 0,
      lastFiredAt: lastFiredMap.get(trigger.id) ?? null,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    })),
  )
})

app.post("/api/triggers", express.json(), async (request, response) => {
  const { name, provider, eventType, conditions, actionPrompt, enabled } = request.body ?? {}

  if (!name || typeof name !== "string") {
    response.status(400).json({ error: "Trigger name is required." })
    return
  }
  if (!provider || typeof provider !== "string") {
    response.status(400).json({ error: "Provider is required." })
    return
  }
  if (!eventType || typeof eventType !== "string") {
    response.status(400).json({ error: "Event type is required." })
    return
  }

  const timestamp = now()
  const id = crypto.randomUUID()
  const promptValue = typeof actionPrompt === "string" && actionPrompt.trim() ? actionPrompt.trim() : null

  await db.insert(triggers).values({
    id,
    name: name.trim(),
    provider,
    eventType,
    conditionsJson: Array.isArray(conditions) && conditions.length > 0 ? JSON.stringify(conditions) : null,
    actionPrompt: promptValue,
    enabled: enabled !== false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const [created]: TriggerRow[] = await db.select().from(triggers).where(eq(triggers.id, id))
  response.json({
    id: created.id,
    name: created.name,
    provider: created.provider,
    eventType: created.eventType,
    conditions: created.conditionsJson ? JSON.parse(created.conditionsJson) : [],
    actionPrompt: created.actionPrompt ?? null,
    enabled: Boolean(created.enabled),
    executionCount: 0,
    lastFiredAt: null,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  })
})

app.patch("/api/triggers/:triggerId", express.json(), async (request, response) => {
  const [existing]: TriggerRow[] = await db.select().from(triggers).where(eq(triggers.id, request.params.triggerId))

  if (!existing) {
    response.status(404).json({ error: "Trigger not found." })
    return
  }

  const updates: Partial<typeof triggers.$inferInsert> = { updatedAt: now() }

  if (request.body.name !== undefined) updates.name = String(request.body.name).trim()
  if (request.body.provider !== undefined) updates.provider = String(request.body.provider)
  if (request.body.eventType !== undefined) updates.eventType = String(request.body.eventType)
  if (request.body.enabled !== undefined) updates.enabled = Boolean(request.body.enabled)
  if (request.body.conditions !== undefined) {
    updates.conditionsJson =
      Array.isArray(request.body.conditions) && request.body.conditions.length > 0
        ? JSON.stringify(request.body.conditions)
        : null
  }
  if (request.body.actionPrompt !== undefined) {
    const val = request.body.actionPrompt
    updates.actionPrompt = typeof val === "string" && val.trim() ? val.trim() : null
  }

  await db.update(triggers).set(updates).where(eq(triggers.id, existing.id))

  const [updated]: TriggerRow[] = await db.select().from(triggers).where(eq(triggers.id, existing.id))
  const [execCount] = await db
    .select({ count: count() })
    .from(triggerExecutions)
    .where(eq(triggerExecutions.triggerId, existing.id))
  const [lastExec] = await db
    .select({ matchedAt: triggerExecutions.matchedAt })
    .from(triggerExecutions)
    .where(eq(triggerExecutions.triggerId, existing.id))
    .orderBy(desc(triggerExecutions.matchedAt))
    .limit(1)

  response.json({
    id: updated.id,
    name: updated.name,
    provider: updated.provider,
    eventType: updated.eventType,
    conditions: updated.conditionsJson ? JSON.parse(updated.conditionsJson) : [],
    actionPrompt: updated.actionPrompt ?? null,
    enabled: Boolean(updated.enabled),
    executionCount: execCount?.count ?? 0,
    lastFiredAt: lastExec?.matchedAt ?? null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  })
})

app.delete("/api/triggers/:triggerId", async (request, response) => {
  const [existing]: TriggerRow[] = await db.select().from(triggers).where(eq(triggers.id, request.params.triggerId))

  if (!existing) {
    response.status(404).json({ error: "Trigger not found." })
    return
  }

  await db.delete(triggerExecutions).where(eq(triggerExecutions.triggerId, existing.id))
  await db.delete(triggers).where(eq(triggers.id, existing.id))

  response.json({ ok: true })
})

app.get("/api/triggers/:triggerId/executions", async (request, response) => {
  const [existing]: TriggerRow[] = await db.select().from(triggers).where(eq(triggers.id, request.params.triggerId))

  if (!existing) {
    response.status(404).json({ error: "Trigger not found." })
    return
  }

  const executions = await db
    .select({
      id: triggerExecutions.id,
      matchedAt: triggerExecutions.matchedAt,
      webhookEventId: triggerExecutions.webhookEventId,
      status: triggerExecutions.status,
      finishedAt: triggerExecutions.finishedAt,
      resultMessage: triggerExecutions.resultMessage,
      eventType: githubWebhookEvents.eventType,
      repositoryId: githubWebhookEvents.repositoryId,
      payloadJson: githubWebhookEvents.payloadJson,
      receivedAt: githubWebhookEvents.receivedAt,
    })
    .from(triggerExecutions)
    .leftJoin(githubWebhookEvents, eq(triggerExecutions.webhookEventId, githubWebhookEvents.id))
    .where(eq(triggerExecutions.triggerId, existing.id))
    .orderBy(desc(triggerExecutions.matchedAt))
    .limit(50)

  response.json({
    trigger: {
      id: existing.id,
      name: existing.name,
      provider: existing.provider,
      eventType: existing.eventType,
      conditions: existing.conditionsJson ? JSON.parse(existing.conditionsJson) : [],
      actionPrompt: existing.actionPrompt ?? null,
      enabled: Boolean(existing.enabled),
    },
    executions: executions.map((row) => ({
      id: row.id,
      matchedAt: row.matchedAt,
      webhookEventId: row.webhookEventId,
      status: row.status ?? "matched",
      finishedAt: row.finishedAt ?? null,
      resultMessage: row.resultMessage ?? null,
      eventType: row.eventType,
      repositoryId: row.repositoryId,
      payload: row.payloadJson ? JSON.parse(row.payloadJson) : null,
      receivedAt: row.receivedAt,
    })),
  })
})

// --- Schedules preview ---

app.post("/api/schedules/preview", express.json(), (request, response) => {
  const { cronExpression, timezone } = request.body ?? {}

  if (!cronExpression || typeof cronExpression !== "string") {
    response.status(400).json({ error: "Cron expression is required." })
    return
  }
  if (!isValidCron(cronExpression)) {
    response.status(400).json({ error: `Invalid cron expression: ${cronExpression}` })
    return
  }

  const tz = typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC"
  const runs: string[] = []

  try {
    let cursor = new Date()
    for (let i = 0; i < 3; i++) {
      const next = computeNextRunAt(cronExpression, tz, cursor)
      if (!next) break
      runs.push(next)
      cursor = new Date(new Date(next).getTime() + 1000)
    }
  } catch {
    response.status(400).json({ error: "Failed to compute next runs." })
    return
  }

  response.json({ runs })
})

// --- Schedules CRUD ---

app.get("/api/schedules", async (_request, response) => {
  const allSchedules: ScheduleRow[] = await db.select().from(schedules).orderBy(desc(schedules.createdAt))

  const executionCounts = await db
    .select({ scheduleId: scheduleExecutions.scheduleId, count: count() })
    .from(scheduleExecutions)
    .groupBy(scheduleExecutions.scheduleId)
  const countMap = new Map(executionCounts.map((row) => [row.scheduleId, row.count]))

  response.json(
    allSchedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description ?? null,
      prompt: schedule.prompt,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      enabled: Boolean(schedule.enabled),
      nextRunAt: schedule.nextRunAt ?? null,
      lastRunAt: schedule.lastRunAt ?? null,
      executionCount: countMap.get(schedule.id) ?? 0,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    })),
  )
})

app.post("/api/schedules", express.json(), async (request, response) => {
  const { name, description, prompt, cronExpression, timezone, enabled } = request.body ?? {}

  if (!name || typeof name !== "string") {
    response.status(400).json({ error: "Schedule name is required." })
    return
  }
  if (!prompt || typeof prompt !== "string") {
    response.status(400).json({ error: "Prompt is required." })
    return
  }
  if (!cronExpression || typeof cronExpression !== "string") {
    response.status(400).json({ error: "Cron expression is required." })
    return
  }
  if (!isValidCron(cronExpression)) {
    response.status(400).json({ error: `Invalid cron expression: ${cronExpression}` })
    return
  }

  const tz = typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC"
  const timestamp = now()
  const id = crypto.randomUUID()
  const nextRunAt = computeNextRunAt(cronExpression, tz)

  await db.insert(schedules).values({
    id,
    name: name.trim(),
    description: typeof description === "string" && description.trim() ? description.trim() : null,
    prompt: prompt.trim(),
    cronExpression,
    timezone: tz,
    enabled: enabled !== false,
    nextRunAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const [created]: ScheduleRow[] = await db.select().from(schedules).where(eq(schedules.id, id))
  response.json({
    id: created.id,
    name: created.name,
    description: created.description ?? null,
    prompt: created.prompt,
    cronExpression: created.cronExpression,
    timezone: created.timezone,
    enabled: Boolean(created.enabled),
    nextRunAt: created.nextRunAt ?? null,
    lastRunAt: created.lastRunAt ?? null,
    executionCount: 0,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  })
})

app.patch("/api/schedules/:scheduleId", express.json(), async (request, response) => {
  const [existing]: ScheduleRow[] = await db.select().from(schedules).where(eq(schedules.id, request.params.scheduleId))

  if (!existing) {
    response.status(404).json({ error: "Schedule not found." })
    return
  }

  const updates: Partial<typeof schedules.$inferInsert> = { updatedAt: now() }

  if (request.body.name !== undefined) updates.name = String(request.body.name).trim()
  if (request.body.description !== undefined) {
    const val = request.body.description
    updates.description = typeof val === "string" && val.trim() ? val.trim() : null
  }
  if (request.body.prompt !== undefined) updates.prompt = String(request.body.prompt).trim()
  if (request.body.enabled !== undefined) updates.enabled = Boolean(request.body.enabled)
  if (request.body.timezone !== undefined) updates.timezone = String(request.body.timezone).trim() || "UTC"

  if (request.body.cronExpression !== undefined) {
    const cron = String(request.body.cronExpression)
    if (!isValidCron(cron)) {
      response.status(400).json({ error: `Invalid cron expression: ${cron}` })
      return
    }
    updates.cronExpression = cron
  }

  const finalCron = updates.cronExpression ?? existing.cronExpression
  const finalTz = updates.timezone ?? existing.timezone
  if (updates.cronExpression || updates.timezone || updates.enabled !== undefined) {
    const isEnabled = updates.enabled ?? existing.enabled
    updates.nextRunAt = isEnabled ? computeNextRunAt(finalCron, finalTz) : existing.nextRunAt
  }

  await db.update(schedules).set(updates).where(eq(schedules.id, existing.id))

  const [updated]: ScheduleRow[] = await db.select().from(schedules).where(eq(schedules.id, existing.id))
  const [execCount] = await db
    .select({ count: count() })
    .from(scheduleExecutions)
    .where(eq(scheduleExecutions.scheduleId, existing.id))

  response.json({
    id: updated.id,
    name: updated.name,
    description: updated.description ?? null,
    prompt: updated.prompt,
    cronExpression: updated.cronExpression,
    timezone: updated.timezone,
    enabled: Boolean(updated.enabled),
    nextRunAt: updated.nextRunAt ?? null,
    lastRunAt: updated.lastRunAt ?? null,
    executionCount: execCount?.count ?? 0,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  })
})

app.delete("/api/schedules/:scheduleId", async (request, response) => {
  const [existing]: ScheduleRow[] = await db.select().from(schedules).where(eq(schedules.id, request.params.scheduleId))

  if (!existing) {
    response.status(404).json({ error: "Schedule not found." })
    return
  }

  await db.delete(scheduleExecutions).where(eq(scheduleExecutions.scheduleId, existing.id))
  await db.delete(schedules).where(eq(schedules.id, existing.id))

  response.json({ ok: true })
})

app.get("/api/schedules/:scheduleId/executions", async (request, response) => {
  const [existing]: ScheduleRow[] = await db.select().from(schedules).where(eq(schedules.id, request.params.scheduleId))

  if (!existing) {
    response.status(404).json({ error: "Schedule not found." })
    return
  }

  const executions = await db
    .select()
    .from(scheduleExecutions)
    .where(eq(scheduleExecutions.scheduleId, existing.id))
    .orderBy(desc(scheduleExecutions.startedAt))
    .limit(50)

  response.json({
    schedule: {
      id: existing.id,
      name: existing.name,
      description: existing.description ?? null,
      prompt: existing.prompt,
      cronExpression: existing.cronExpression,
      timezone: existing.timezone,
      enabled: Boolean(existing.enabled),
      nextRunAt: existing.nextRunAt ?? null,
      lastRunAt: existing.lastRunAt ?? null,
    },
    executions: executions.map((row) => ({
      id: row.id,
      status: row.status,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? null,
      resultMessage: row.resultMessage ?? null,
    })),
  })
})

// ── Agent routes ──

app.get("/api/agent", async (_request, response) => {
  const configured = getConfiguredAgent(db)
  response.json(configured)
})

app.post("/api/agent", express.json(), async (request, response) => {
  const { name, command } = request.body as { name?: string; command?: string }

  if (!name || !command) {
    response.status(400).json({ error: "Both name and command are required." })
    return
  }

  const timestamp = now()

  db.insert(agentTable)
    .values({ id: "default", name, command, status: "active", createdAt: timestamp, updatedAt: timestamp })
    .onConflictDoUpdate({
      target: agentTable.id,
      set: { name, command, status: "active", updatedAt: timestamp },
    })
    .run()

  const configured = getConfiguredAgent(db)
  response.json(configured)
})

app.delete("/api/agent", async (_request, response) => {
  db.delete(agentTable).where(eq(agentTable.id, "default")).run()
  response.json({ ok: true })
})

app.get("/api/agent/detect", async (_request, response) => {
  const agents = await detectInstalledAgents()
  response.json(agents)
})

app.post("/api/agent/test", async (_request, response) => {
  const configured = getConfiguredAgent(db)

  if (!configured) {
    response.status(400).json({ error: "No agent configured." })
    return
  }

  if (configured.status !== "active") {
    response.status(400).json({ error: "Agent is not active." })
    return
  }

  const result = await runAgent(configured.command, "Respond with exactly: hello")

  db.update(agentTable).set({ lastUsedAt: now(), updatedAt: now() }).where(eq(agentTable.id, "default")).run()

  response.json(result)
})

app.get("/api/agent/check-skill", async (_request, response) => {
  const configured = getConfiguredAgent(db)

  if (!configured) {
    response.status(400).json({ error: "No agent configured." })
    return
  }

  const result = checkSkillInstalled(configured.name)
  response.json(result)
})

app.get("/api/agent/check-cli", async (_request, response) => {
  const result = await checkCliInstalled()
  response.json(result)
})

app.post("/api/agent/validate", async (_request, response) => {
  const configured = getConfiguredAgent(db)

  if (!configured) {
    response.status(400).json({ error: "No agent configured." })
    return
  }

  const [agentResult, skillResult, cliResult] = await Promise.all([
    runAgent(configured.command, "Respond with exactly: hello").catch(() => ({
      exitCode: 1 as number | null,
      stdout: "",
      stderr: "spawn failed",
    })),
    Promise.resolve(checkSkillInstalled(configured.name)),
    checkCliInstalled(),
  ])

  const timestamp = now()
  const checkAgentOk = agentResult.exitCode === 0
  const checkSkillOk = skillResult.installed
  const checkCliOk = cliResult.installed

  db.update(agentTable)
    .set({
      checkAgentOk,
      checkSkillOk,
      checkCliOk,
      lastCheckedAt: timestamp,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentTable.id, "default"))
    .run()

  response.json({
    agent: { ok: checkAgentOk, exitCode: agentResult.exitCode },
    skill: { ok: checkSkillOk, path: skillResult.path },
    cli: { ok: checkCliOk, path: cliResult.path },
    checkedAt: timestamp,
  })
})

let schedulerTimer: ReturnType<typeof setInterval> | null = null

app.listen(config.port, () => {
  console.log(`Argus relay listening on http://127.0.0.1:${config.port}`)

  schedulerTimer = startScheduler(db)

  if (shouldAutoTunnel()) {
    console.log("Starting Cloudflare tunnel...")
    startTunnel(config.port)
      .then(async (tunnelUrl) => {
        config.relayBaseUrl = tunnelUrl
        console.log(`Tunnel ready: ${tunnelUrl}`)
        console.log("Syncing webhook URLs to new tunnel address...")
        await syncAllWebhookUrls()
      })
      .catch((error) => {
        console.error("Tunnel failed to start:", error instanceof Error ? error.message : error)
        console.error("Webhook URLs will use the local address. GitHub will reject them.")
      })
  } else {
    console.log(`Using explicit RELAY_BASE_URL: ${config.relayBaseUrl}`)
  }
})

process.on("SIGINT", () => {
  if (schedulerTimer) clearInterval(schedulerTimer)
  stopTunnel()
  sqlite.close()
  process.exit(0)
})

import crypto from "node:crypto"
import path from "node:path"

import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import { and, desc, eq, inArray } from "drizzle-orm"

import { createDatabase } from "./db/client.js"
import { githubRepositories, githubWebhookEvents, integrations } from "./db/schema.js"
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

type IntegrationRow = typeof integrations.$inferSelect
type RepositoryRow = typeof githubRepositories.$inferSelect
type WebhookEventRow = typeof githubWebhookEvents.$inferSelect

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

  if (enabled && (!repository.webhookKey || !repository.webhookSecret)) {
    updates.webhookKey = crypto.randomUUID()
    updates.webhookSecret = crypto.randomUUID().replace(/-/g, "")
    updates.webhookStatus = "ready"
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
  await db.insert(githubWebhookEvents).values({
    integrationId: repository.integrationId,
    repositoryId: repository.repositoryId,
    deliveryId,
    eventType,
    source,
    payloadJson: JSON.stringify(payload),
    receivedAt,
  })

  await db
    .update(githubRepositories)
    .set({
      webhookStatus: source === "test" ? "test_passed" : "active",
      webhookLastReceivedAt: receivedAt,
      updatedAt: receivedAt,
    })
    .where(eq(githubRepositories.id, repository.id))
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

app.listen(config.port, () => {
  console.log(`Argus relay listening on http://127.0.0.1:${config.port}`)

  if (shouldAutoTunnel()) {
    console.log("Starting Cloudflare tunnel...")
    startTunnel(config.port)
      .then((tunnelUrl) => {
        config.relayBaseUrl = tunnelUrl
        console.log(`Tunnel ready: ${tunnelUrl}`)
        console.log("Webhook URLs will use this tunnel address.")
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
  stopTunnel()
  sqlite.close()
  process.exit(0)
})

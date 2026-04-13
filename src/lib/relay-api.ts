type GitHubIntegrationAccount = {
  login: string | null
  name: string | null
  email: string | null
  avatarUrl: string | null
  lastValidatedAt: string | null
  lastError: string | null
}

type GitHubIntegrationRepository = {
  id: string
  owner: string
  name: string
  fullName: string
  private: boolean
  selected: boolean
  webhookUrl: string | null
  webhookSecret: string | null
  webhookStatus: string
  webhookLastReceivedAt: string | null
  htmlUrl: string
  defaultBranch: string | null
  lastSyncedAt: string | null
}

type GitHubWebhookEvent = {
  id: number
  eventType: string
  source: string
  repositoryId: string | null
  receivedAt: string
  payloadJson: Record<string, unknown>
}

type GitHubIntegrationState = {
  provider: string
  displayName: string
  status: string
  apiKeyConfigured: boolean
  relayBaseUrl: string
  supportedEvents: string[]
  account: GitHubIntegrationAccount | null
  repositories: GitHubIntegrationRepository[]
  recentEvents: GitHubWebhookEvent[]
}

const RELAY_BASE_URL = "http://127.0.0.1:8787"

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${RELAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Relay request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

async function getGitHubIntegration() {
  return request<GitHubIntegrationState>("/api/integrations/github")
}

async function connectGitHub(apiKey: string) {
  return request<GitHubIntegrationState>("/api/integrations/github/connect", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  })
}

async function syncGitHubRepositories() {
  return request<GitHubIntegrationState>("/api/integrations/github/sync", {
    method: "POST",
  })
}

async function setGitHubRepositorySelected(repositoryId: string, enabled: boolean) {
  return request<GitHubIntegrationState>(`/api/integrations/github/repositories/${repositoryId}/select`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  })
}

async function prepareGitHubRepositoryWebhook(repositoryId: string) {
  return request<GitHubIntegrationState>(`/api/integrations/github/repositories/${repositoryId}/webhook/configure`, {
    method: "POST",
  })
}

async function sendGitHubWebhookTest(repositoryId: string) {
  return request<GitHubIntegrationState>(`/api/integrations/github/repositories/${repositoryId}/test-webhook`, {
    method: "POST",
  })
}

export {
  RELAY_BASE_URL,
  connectGitHub,
  getGitHubIntegration,
  prepareGitHubRepositoryWebhook,
  sendGitHubWebhookTest,
  setGitHubRepositorySelected,
  syncGitHubRepositories,
}
export type { GitHubIntegrationRepository, GitHubIntegrationState }

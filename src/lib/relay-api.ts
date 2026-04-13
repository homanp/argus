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
  webhookManaged: boolean
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

type TriggerCondition = {
  field: string
  operator: "equals" | "not_equals" | "contains"
  value: string
}

type Trigger = {
  id: string
  name: string
  provider: string
  eventType: string
  conditions: TriggerCondition[]
  actionPrompt: string | null
  enabled: boolean
  executionCount: number
  lastFiredAt: string | null
  createdAt: string
  updatedAt: string
}

type TriggerExecution = {
  id: number
  matchedAt: string
  webhookEventId: number
  eventType: string | null
  repositoryId: string | null
  payload: Record<string, unknown> | null
  receivedAt: string | null
}

type TriggerDetailResponse = {
  trigger: {
    id: string
    name: string
    provider: string
    eventType: string
    conditions: TriggerCondition[]
    actionPrompt: string | null
    enabled: boolean
  }
  executions: TriggerExecution[]
}

type AvailableEventsResponse = {
  events: string[]
  source: "github_api" | "static_fallback"
}

type Schedule = {
  id: string
  name: string
  description: string | null
  prompt: string
  cronExpression: string
  timezone: string
  enabled: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  executionCount: number
  createdAt: string
  updatedAt: string
}

type ScheduleExecution = {
  id: number
  status: string
  startedAt: string
  finishedAt: string | null
  resultMessage: string | null
}

type ScheduleDetailResponse = {
  schedule: {
    id: string
    name: string
    description: string | null
    prompt: string
    cronExpression: string
    timezone: string
    enabled: boolean
    nextRunAt: string | null
    lastRunAt: string | null
  }
  executions: ScheduleExecution[]
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

async function getGitHubAvailableEvents() {
  return request<AvailableEventsResponse>("/api/integrations/github/available-events")
}

async function getTriggers() {
  return request<Trigger[]>("/api/triggers")
}

async function createTrigger(data: {
  name: string
  provider: string
  eventType: string
  conditions?: TriggerCondition[]
  actionPrompt?: string
  enabled?: boolean
}) {
  return request<Trigger>("/api/triggers", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

async function updateTrigger(
  triggerId: string,
  data: Partial<{
    name: string
    provider: string
    eventType: string
    conditions: TriggerCondition[]
    actionPrompt: string
    enabled: boolean
  }>,
) {
  return request<Trigger>(`/api/triggers/${triggerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

async function deleteTrigger(triggerId: string) {
  return request<{ ok: true }>(`/api/triggers/${triggerId}`, {
    method: "DELETE",
  })
}

async function getTriggerExecutions(triggerId: string) {
  return request<TriggerDetailResponse>(`/api/triggers/${triggerId}/executions`)
}

async function getSchedules() {
  return request<Schedule[]>("/api/schedules")
}

async function createSchedule(data: {
  name: string
  description?: string
  prompt: string
  cronExpression: string
  timezone?: string
  enabled?: boolean
}) {
  return request<Schedule>("/api/schedules", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

async function updateSchedule(
  scheduleId: string,
  data: Partial<{
    name: string
    description: string
    prompt: string
    cronExpression: string
    timezone: string
    enabled: boolean
  }>,
) {
  return request<Schedule>(`/api/schedules/${scheduleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

async function deleteSchedule(scheduleId: string) {
  return request<{ ok: true }>(`/api/schedules/${scheduleId}`, {
    method: "DELETE",
  })
}

async function getScheduleExecutions(scheduleId: string) {
  return request<ScheduleDetailResponse>(`/api/schedules/${scheduleId}/executions`)
}

export {
  RELAY_BASE_URL,
  connectGitHub,
  createSchedule,
  createTrigger,
  deleteSchedule,
  deleteTrigger,
  getGitHubAvailableEvents,
  getGitHubIntegration,
  getScheduleExecutions,
  getSchedules,
  getTriggerExecutions,
  getTriggers,
  prepareGitHubRepositoryWebhook,
  sendGitHubWebhookTest,
  setGitHubRepositorySelected,
  syncGitHubRepositories,
  updateSchedule,
  updateTrigger,
}
export type {
  AvailableEventsResponse,
  GitHubIntegrationRepository,
  GitHubIntegrationState,
  Schedule,
  ScheduleDetailResponse,
  ScheduleExecution,
  Trigger,
  TriggerCondition,
  TriggerDetailResponse,
  TriggerExecution,
}

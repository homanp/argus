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

type ChannelProvider = "slack" | "telegram" | "whatsapp" | "email"

type ChannelState = {
  provider: ChannelProvider
  displayName: string
  status: string
  config: Record<string, string> | null
  lastValidatedAt: string | null
  lastError: string | null
  createdAt: string | null
  updatedAt: string | null
}

type TelegramDiscoveryResponse = {
  bot: {
    id: string
    username: string | null
    firstName: string
  }
  chats: Array<{
    id: string
    type: string
    title: string
    username: string | null
  }>
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
  channelTargets: ChannelProvider[]
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
  status: string
  finishedAt: string | null
  resultMessage: string | null
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
    channelTargets: ChannelProvider[]
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

type RecentSession = {
  id: string
  type: "trigger" | "schedule" | "mission"
  sourceId: string
  name: string
  status: string
  startedAt: string
  finishedAt: string | null
  resultMessage: string | null
}

type MissionActionSummary = {
  key: string
  label: string
  hotkey: string
}

type MissionSummary = {
  id: string
  status: "awaiting_decision" | "decided" | "dismissed" | string
  priority: "low" | "normal" | "high" | string
  urgent: boolean
  sourceProvider: string
  sourceEventType: string
  title: string
  recommendation: string
  analysisMarkdown: string
  confidence: number
  confidenceLabel: string | null
  agentName: string | null
  decidedActionKey: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
  actions: MissionActionSummary[]
  actionLabels: string[]
}

type MissionPlanStep = {
  step: number
  description: string
  tool: string
  estimate: string
  reversibility: "reversible" | "auto" | "attention"
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

type Mission = Omit<MissionSummary, "actions"> & {
  plan: MissionPlanStep[]
  actions: MissionAction[]
}

type MissionSignal = {
  id: number
  label: string | null
  createdAt: string
  webhookEventId: number | null
  eventType: string | null
  source: string | null
  repositoryId: string | null
  payload: Record<string, unknown> | null
  receivedAt: string | null
}

type MissionExecution = {
  id: number
  actionKey: string
  promptSent: string
  status: "pending" | "running" | "completed" | "failed" | string
  startedAt: string
  finishedAt: string | null
  resultMessage: string | null
}

type MissionDetailResponse = {
  mission: Mission
  signals: MissionSignal[]
  executions: MissionExecution[]
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

async function getChannels() {
  return request<ChannelState[]>("/api/channels")
}

async function getChannel(provider: ChannelProvider) {
  return request<ChannelState>(`/api/channels/${provider}`)
}

async function configureChannel(provider: ChannelProvider, data: Record<string, string>) {
  return request<ChannelState>(`/api/channels/${provider}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

async function discoverTelegramChats(botToken: string) {
  return request<TelegramDiscoveryResponse>("/api/channels/telegram/discover", {
    method: "POST",
    body: JSON.stringify({ botToken }),
  })
}

async function removeChannel(provider: ChannelProvider) {
  return request<{ ok: true }>(`/api/channels/${provider}`, {
    method: "DELETE",
  })
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
  channelTargets?: ChannelProvider[]
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
    channelTargets: ChannelProvider[]
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

async function previewSchedule(cronExpression: string, timezone?: string) {
  return request<{ runs: string[] }>("/api/schedules/preview", {
    method: "POST",
    body: JSON.stringify({ cronExpression, timezone }),
  })
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

// ── Agent ──

type AgentConfig = {
  id: string
  name: string
  command: string
  status: string
  lastUsedAt: string | null
  checkAgentOk: boolean | null
  checkSkillOk: boolean | null
  checkCliOk: boolean | null
  cliPath: string | null
  cliVersion: string | null
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

type DetectedAgent = {
  slug: string
  name: string
  command: string
  detected: boolean
  image: string | null
}

type AgentTestResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

async function getAgent() {
  return request<AgentConfig | null>("/api/agent")
}

async function configureAgent(name: string, command: string) {
  return request<AgentConfig>("/api/agent", {
    method: "POST",
    body: JSON.stringify({ name, command }),
  })
}

async function removeAgent() {
  return request<{ ok: true }>("/api/agent", {
    method: "DELETE",
  })
}

async function detectAgents() {
  return request<DetectedAgent[]>("/api/agent/detect")
}

async function testAgent() {
  return request<AgentTestResult>("/api/agent/test", {
    method: "POST",
  })
}

async function checkAgentSkill() {
  return request<{ installed: boolean; path: string }>("/api/agent/check-skill")
}

async function checkAgentCli() {
  return request<{ installed: boolean; path: string | null; version: string | null }>("/api/agent/check-cli")
}

type ValidateResult = {
  agent: { ok: boolean; exitCode: number | null }
  skill: { ok: boolean; path: string }
  cli: { ok: boolean; path: string | null; version: string | null }
  checkedAt: string
}

async function getRecentSessions(options: { limit?: number } = {}) {
  const query = options.limit ? `?limit=${options.limit}` : ""
  return request<RecentSession[]>(`/api/sessions/recent${query}`)
}

async function getMissions() {
  return request<MissionSummary[]>("/api/missions")
}

async function getMission(missionId: string) {
  return request<MissionDetailResponse>(`/api/missions/${missionId}`)
}

async function decideMission(missionId: string, actionKey: string) {
  return request<{ ok: true; actionKey: string }>(`/api/missions/${missionId}/decide`, {
    method: "POST",
    body: JSON.stringify({ actionKey }),
  })
}

async function dismissMission(missionId: string) {
  return request<{ ok: true }>(`/api/missions/${missionId}/dismiss`, {
    method: "POST",
  })
}

async function deleteMission(missionId: string) {
  return request<{ ok: true }>(`/api/missions/${missionId}`, {
    method: "DELETE",
  })
}

// ── Mission engine ──

type MissionScanSummary = {
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

type MissionSettings = {
  id: string
  enabled: boolean
  intervalMinutes: number
  lookbackMinutes: number
  missionChannelProvider: ChannelProvider | null
  lastScanAt: string | null
  nextScanAt: string | null
  lastScanSummary: MissionScanSummary | null
  createdAt: string
  updatedAt: string
}

type MissionSuppression = {
  id: number
  scanId: string
  verdict: string
  reason: string | null
  createdAt: string
  candidate: unknown
}

type OperatingDoc = {
  markdown: string
  updatedBy: "user" | "agent" | "system" | string
  updatedAt: string
  createdAt: string
}

type OperatingDocUpdate = {
  id: number
  before: string
  after: string
  diff: string | null
  reason: string | null
  source: "decision" | "manual" | string
  missionId: string | null
  createdAt: string
}

async function getMissionSettings() {
  return request<MissionSettings>("/api/mission-settings")
}

async function updateMissionSettings(
  patch: Partial<Pick<MissionSettings, "enabled" | "intervalMinutes" | "lookbackMinutes" | "missionChannelProvider">>,
) {
  return request<MissionSettings>("/api/mission-settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  })
}

async function scanMissionsNow() {
  return request<{ ok: true; startedAt: string }>("/api/missions/scan", {
    method: "POST",
  })
}

async function sendMissionChannelTest() {
  return request<{ ok: true; provider: ChannelProvider }>("/api/mission-settings/test-channel", {
    method: "POST",
  })
}

async function getMissionSuppressions(params: { scanId?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.scanId) query.set("scanId", params.scanId)
  if (params.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<MissionSuppression[]>(`/api/mission-suppressions${suffix}`)
}

async function getOperatingDoc() {
  return request<OperatingDoc>("/api/operating-doc")
}

async function updateOperatingDoc(markdown: string) {
  return request<OperatingDoc>("/api/operating-doc", {
    method: "PUT",
    body: JSON.stringify({ markdown }),
  })
}

async function getOperatingDocUpdates(limit = 50) {
  return request<OperatingDocUpdate[]>(`/api/operating-doc/updates?limit=${limit}`)
}

async function revertOperatingDocUpdate(updateId: number) {
  return request<OperatingDoc>(`/api/operating-doc/updates/${updateId}/revert`, {
    method: "POST",
  })
}

async function validateAgent() {
  return request<ValidateResult>("/api/agent/validate", {
    method: "POST",
  })
}

export {
  RELAY_BASE_URL,
  checkAgentCli,
  checkAgentSkill,
  configureAgent,
  configureChannel,
  connectGitHub,
  createSchedule,
  createTrigger,
  decideMission,
  deleteMission,
  detectAgents,
  deleteSchedule,
  deleteTrigger,
  discoverTelegramChats,
  dismissMission,
  getAgent,
  getChannel,
  getChannels,
  getGitHubAvailableEvents,
  getGitHubIntegration,
  getMission,
  getMissionSettings,
  getMissionSuppressions,
  getMissions,
  getOperatingDoc,
  getOperatingDocUpdates,
  getRecentSessions,
  getScheduleExecutions,
  getSchedules,
  getTriggerExecutions,
  getTriggers,
  prepareGitHubRepositoryWebhook,
  previewSchedule,
  removeChannel,
  removeAgent,
  revertOperatingDocUpdate,
  scanMissionsNow,
  sendGitHubWebhookTest,
  sendMissionChannelTest,
  setGitHubRepositorySelected,
  syncGitHubRepositories,
  testAgent,
  updateMissionSettings,
  updateOperatingDoc,
  updateSchedule,
  updateTrigger,
  validateAgent,
}
export type {
  AgentConfig,
  AgentTestResult,
  AvailableEventsResponse,
  ChannelProvider,
  ChannelState,
  DetectedAgent,
  Mission,
  MissionAction,
  MissionArtifact,
  MissionArtifactKind,
  MissionDetailResponse,
  MissionExecution,
  MissionPlanStep,
  MissionScanSummary,
  MissionSettings,
  MissionSignal,
  MissionSummary,
  MissionSuppression,
  OperatingDoc,
  OperatingDocUpdate,
  TelegramDiscoveryResponse,
  ValidateResult,
  GitHubIntegrationRepository,
  GitHubIntegrationState,
  RecentSession,
  Schedule,
  ScheduleDetailResponse,
  ScheduleExecution,
  Trigger,
  TriggerCondition,
  TriggerDetailResponse,
  TriggerExecution,
}

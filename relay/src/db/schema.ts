import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}

const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  displayName: text("display_name").notNull(),
  apiKey: text("api_key"),
  status: text("status").notNull(),
  externalAccountId: text("external_account_id"),
  accountLogin: text("account_login"),
  accountName: text("account_name"),
  accountEmail: text("account_email"),
  accountAvatarUrl: text("account_avatar_url"),
  lastValidatedAt: text("last_validated_at"),
  lastError: text("last_error"),
  ...timestamps,
})

const githubRepositories = sqliteTable("github_repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  integrationId: text("integration_id").notNull(),
  repositoryId: text("repository_id").notNull().unique(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch"),
  private: integer("private", { mode: "boolean" }).notNull().default(false),
  htmlUrl: text("html_url").notNull(),
  isSelected: integer("is_selected", { mode: "boolean" }).notNull().default(false),
  webhookKey: text("webhook_key"),
  webhookSecret: text("webhook_secret"),
  githubWebhookId: integer("github_webhook_id"),
  webhookStatus: text("webhook_status").notNull().default("not_configured"),
  webhookLastReceivedAt: text("webhook_last_received_at"),
  lastSyncedAt: text("last_synced_at"),
  ...timestamps,
})

const githubWebhookEvents = sqliteTable("github_webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  integrationId: text("integration_id").notNull(),
  repositoryId: text("repository_id"),
  deliveryId: text("delivery_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  payloadJson: text("payload_json").notNull(),
  receivedAt: text("received_at").notNull(),
})

const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull(),
  configJson: text("config_json"),
  lastValidatedAt: text("last_validated_at"),
  lastError: text("last_error"),
  ...timestamps,
})

const triggers = sqliteTable("triggers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  eventType: text("event_type").notNull(),
  conditionsJson: text("conditions_json"),
  actionPrompt: text("action_prompt"),
  channelTargetsJson: text("channel_targets_json"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
})

const triggerExecutions = sqliteTable("trigger_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  triggerId: text("trigger_id").notNull(),
  webhookEventId: integer("webhook_event_id").notNull(),
  matchedAt: text("matched_at").notNull(),
  status: text("status"),
  finishedAt: text("finished_at"),
  resultMessage: text("result_message"),
})

const triggerDeliveryAttempts = sqliteTable("trigger_delivery_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  triggerExecutionId: integer("trigger_execution_id").notNull(),
  provider: text("provider").notNull(),
  targetLabel: text("target_label").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull(),
})

const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  nextRunAt: text("next_run_at"),
  lastRunAt: text("last_run_at"),
  ...timestamps,
})

const scheduleExecutions = sqliteTable("schedule_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scheduleId: text("schedule_id").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  resultMessage: text("result_message"),
})

const missions = sqliteTable("missions", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("awaiting_decision"),
  priority: text("priority").notNull().default("normal"),
  urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
  sourceProvider: text("source_provider").notNull(),
  sourceEventType: text("source_event_type").notNull(),
  triggerWebhookEventId: integer("trigger_webhook_event_id"),
  title: text("title").notNull(),
  analysisMarkdown: text("analysis_markdown").notNull(),
  recommendation: text("recommendation").notNull(),
  confidence: real("confidence").notNull().default(0),
  confidenceLabel: text("confidence_label"),
  agentName: text("agent_name"),
  channelHint: text("channel_hint"),
  planJson: text("plan_json").notNull(),
  actionsJson: text("actions_json").notNull(),
  metadataJson: text("metadata_json").notNull(),
  decidedActionKey: text("decided_action_key"),
  decidedAt: text("decided_at"),
  ...timestamps,
})

const missionSignals = sqliteTable("mission_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: text("mission_id").notNull(),
  webhookEventId: integer("webhook_event_id").notNull(),
  label: text("label"),
  createdAt: text("created_at").notNull(),
})

const missionExecutions = sqliteTable("mission_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: text("mission_id").notNull(),
  actionKey: text("action_key").notNull(),
  promptSent: text("prompt_sent").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  resultMessage: text("result_message"),
})

const missionSettings = sqliteTable("mission_settings", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  lookbackMinutes: integer("lookback_minutes").notNull().default(120),
  missionChannelProvider: text("mission_channel_provider"),
  lastScanAt: text("last_scan_at"),
  nextScanAt: text("next_scan_at"),
  lastScanSummaryJson: text("last_scan_summary_json"),
  ...timestamps,
})

const operatingDoc = sqliteTable("operating_doc", {
  id: text("id").primaryKey(),
  markdown: text("markdown").notNull(),
  updatedBy: text("updated_by").notNull().default("user"),
  ...timestamps,
})

const operatingDocUpdates = sqliteTable("operating_doc_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  before: text("before").notNull(),
  after: text("after").notNull(),
  diff: text("diff"),
  reason: text("reason"),
  source: text("source").notNull().default("decision"),
  missionId: text("mission_id"),
  createdAt: text("created_at").notNull(),
})

const missionDecisions = sqliteTable("mission_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: text("mission_id").notNull(),
  kind: text("kind").notNull(),
  actionKey: text("action_key"),
  createdAt: text("created_at").notNull(),
})

const missionSuppressions = sqliteTable("mission_suppressions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: text("scan_id").notNull(),
  candidateJson: text("candidate_json").notNull(),
  verdict: text("verdict").notNull().default("suppress"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
})

const agent = sqliteTable("agent", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  status: text("status").notNull().default("active"),
  lastUsedAt: text("last_used_at"),
  checkAgentOk: integer("check_agent_ok", { mode: "boolean" }),
  checkSkillOk: integer("check_skill_ok", { mode: "boolean" }),
  checkCliOk: integer("check_cli_ok", { mode: "boolean" }),
  cliPath: text("cli_path"),
  cliVersion: text("cli_version"),
  lastCheckedAt: text("last_checked_at"),
  ...timestamps,
})

export {
  agent,
  channels,
  githubRepositories,
  githubWebhookEvents,
  integrations,
  missionDecisions,
  missionExecutions,
  missionSettings,
  missionSignals,
  missionSuppressions,
  missions,
  operatingDoc,
  operatingDocUpdates,
  scheduleExecutions,
  schedules,
  triggerDeliveryAttempts,
  triggerExecutions,
  triggers,
}

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

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

const triggers = sqliteTable("triggers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  eventType: text("event_type").notNull(),
  conditionsJson: text("conditions_json"),
  actionPrompt: text("action_prompt"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
})

const triggerExecutions = sqliteTable("trigger_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  triggerId: text("trigger_id").notNull(),
  webhookEventId: integer("webhook_event_id").notNull(),
  matchedAt: text("matched_at").notNull(),
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

const agent = sqliteTable("agent", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  status: text("status").notNull().default("active"),
  lastUsedAt: text("last_used_at"),
  ...timestamps,
})

export {
  agent,
  githubRepositories,
  githubWebhookEvents,
  integrations,
  scheduleExecutions,
  schedules,
  triggerExecutions,
  triggers,
}

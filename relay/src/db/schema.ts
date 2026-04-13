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

export { githubRepositories, githubWebhookEvents, integrations }

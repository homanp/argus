import fs from "node:fs"
import path from "node:path"

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "./schema.js"

function createDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })

  const sqlite = new Database(databasePath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      api_key TEXT,
      status TEXT NOT NULL,
      external_account_id TEXT,
      account_login TEXT,
      account_name TEXT,
      account_email TEXT,
      account_avatar_url TEXT,
      last_validated_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS github_repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id TEXT NOT NULL,
      repository_id TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT,
      private INTEGER NOT NULL DEFAULT 0,
      html_url TEXT NOT NULL,
      is_selected INTEGER NOT NULL DEFAULT 0,
      webhook_key TEXT,
      webhook_secret TEXT,
      github_webhook_id INTEGER,
      webhook_status TEXT NOT NULL DEFAULT 'not_configured',
      webhook_last_received_at TEXT,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS github_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id TEXT NOT NULL,
      repository_id TEXT,
      delivery_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS triggers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      conditions_json TEXT,
      action_prompt TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trigger_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_id TEXT NOT NULL,
      webhook_event_id INTEGER NOT NULL,
      matched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      prompt TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at TEXT,
      last_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      result_message TEXT
    );

    CREATE TABLE IF NOT EXISTS agent (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const repoColumns = sqlite.pragma("table_info(github_repositories)") as { name: string }[]
  if (!repoColumns.some((col) => col.name === "github_webhook_id")) {
    sqlite.exec("ALTER TABLE github_repositories ADD COLUMN github_webhook_id INTEGER")
  }

  const triggerColumns = sqlite.pragma("table_info(triggers)") as { name: string }[]
  if (!triggerColumns.some((col) => col.name === "action_prompt")) {
    sqlite.exec("ALTER TABLE triggers ADD COLUMN action_prompt TEXT")
  }

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  }
}

export { createDatabase }

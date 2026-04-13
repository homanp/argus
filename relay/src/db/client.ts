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
  `)

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  }
}

export { createDatabase }

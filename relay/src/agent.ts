import { execFile, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import type * as schema from "./db/schema.js"
import { agent as agentTable } from "./db/schema.js"

type DB = BetterSQLite3Database<typeof schema>

type DetectedAgent = {
  slug: string
  name: string
  command: string
  detected: boolean
  image: string | null
}

type AgentConfig = {
  id: string
  name: string
  command: string
  status: string
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

type RunResult = {
  exitCode: number | null
  stdout: string
  stderr: string
}

const KNOWN_AGENTS = [
  // -p = headless, --dangerously-skip-permissions = full auto-approve
  {
    slug: "claude",
    name: "Claude Code",
    binary: "claude",
    command: "claude -p --output-format text --dangerously-skip-permissions",
    image: "/claude-code.svg",
  },

  // exec = headless, --dangerously-bypass-approvals-and-sandbox = full auto-approve
  {
    slug: "codex",
    name: "Codex",
    binary: "codex",
    command: "codex exec --dangerously-bypass-approvals-and-sandbox --ephemeral",
    image: "/codex.svg",
  },

  // -p = headless, -y = yolo mode (auto-approve all tool calls)
  { slug: "gemini", name: "Gemini CLI", binary: "gemini", command: "gemini -p -y", image: "/gemini.png" },

  // -p = headless, --force = yolo mode (auto-approve all file edits)
  {
    slug: "cursor",
    name: "Cursor",
    binary: "agent",
    command: "agent -p --force --output-format text",
    image: "/cursor.png",
  },

  // run = headless by default, auto-rejects permission prompts
  {
    slug: "opencode",
    name: "OpenCode",
    binary: "opencode",
    command: "opencode run --format default",
    image: "/opencode.svg",
  },
]

const execFileAsync = promisify(execFile)

async function detectInstalledAgents(): Promise<DetectedAgent[]> {
  const results: DetectedAgent[] = []

  for (const entry of KNOWN_AGENTS) {
    let detected = false
    try {
      await execFileAsync("which", [entry.binary])
      detected = true
    } catch {
      // not found
    }
    results.push({
      slug: entry.slug,
      name: entry.name,
      command: entry.command,
      detected,
      image: entry.image,
    })
  }

  return results
}

function getConfiguredAgent(db: DB): AgentConfig | null {
  const row = db.select().from(agentTable).where(eq(agentTable.id, "default")).get()
  return row ?? null
}

function parseCommand(command: string): { binary: string; args: string[] } {
  const parts: string[] = []
  let current = ""
  let inQuote: string | null = null

  for (const ch of command) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === " ") {
      if (current.length > 0) {
        parts.push(current)
        current = ""
      }
    } else {
      current += ch
    }
  }
  if (current.length > 0) parts.push(current)

  return { binary: parts[0] ?? command, args: parts.slice(1) }
}

function runAgent(command: string, prompt: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const { binary, args } = parseCommand(command)
    const fullArgs = [...args, prompt]

    console.log(
      `[agent] spawning: ${binary} ${fullArgs.map((a) => (a === prompt ? `"${a.slice(0, 80)}..."` : a)).join(" ")}`,
    )

    const child = spawn(binary, fullArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk))

    child.on("error", (err) => {
      console.error(`[agent] spawn error: ${err.message}`)
      resolve({
        exitCode: null,
        stdout: "",
        stderr: err.message,
      })
    })

    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8")
      const stderr = Buffer.concat(stderrChunks).toString("utf8")
      console.log(`[agent] exited with code ${code}`)
      resolve({ exitCode: code, stdout, stderr })
    })
  })
}

const SKILL_PATHS: Record<string, string> = {
  claude: ".claude/skills/argus/SKILL.md",
  codex: ".codex/skills/argus/SKILL.md",
  gemini: ".gemini/skills/argus/SKILL.md",
  cursor: ".cursor/skills/argus/SKILL.md",
  opencode: ".opencode/skills/argus/SKILL.md",
}

function resolveAgentSlug(agentName: string): string | null {
  const lower = agentName.toLowerCase()
  for (const entry of KNOWN_AGENTS) {
    if (entry.slug === lower || entry.name.toLowerCase() === lower) return entry.slug
  }
  return null
}

function checkSkillInstalled(agentName: string): { installed: boolean; path: string } {
  const slug = resolveAgentSlug(agentName)
  const relativePath = (slug && SKILL_PATHS[slug]) ?? `.cursor/skills/argus/SKILL.md`
  const fullPath = path.join(os.homedir(), relativePath)
  return { installed: fs.existsSync(fullPath), path: fullPath }
}

async function checkCliInstalled(): Promise<{ installed: boolean; path: string | null }> {
  try {
    const { stdout } = await execFileAsync("which", ["argus"])
    return { installed: true, path: stdout.trim() }
  } catch {
    return { installed: false, path: null }
  }
}

export { checkCliInstalled, checkSkillInstalled, detectInstalledAgents, getConfiguredAgent, parseCommand, runAgent }
export type { AgentConfig, DetectedAgent, RunResult }

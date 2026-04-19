import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import { extractAgentJson } from "./agent-json.js"
import * as schema from "./db/schema.js"
import { triggerDeliveryAttempts } from "./db/schema.js"

type DB = BetterSQLite3Database<typeof schema>

type ChannelRow = typeof schema.channels.$inferSelect
type TriggerRow = typeof schema.triggers.$inferSelect

type ChannelButton = {
  label: string
  url: string
  /** Slack styling: "primary" (green) or "danger" (red). Anything else renders default. */
  style?: "primary" | "danger"
}

type DeliveryNotification = {
  trigger: TriggerRow
  sourceProvider: string
  eventType: string
  payload: Record<string, unknown>
  agentResult?: string | null
  channelTitle?: string | null
  channelSummary?: string | null
  actionNeeded?: boolean | null
  commentNeeded?: boolean | null
  buttons?: ChannelButton[] | null
}

type DeliveryResult = {
  providerMessageId?: string | null
  responseBody?: string | null
}

type StructuredAgentResult = {
  review: string
  channelTitle?: string
  channelSummary?: string
  actionNeeded?: boolean
  commentNeeded?: boolean
  buttons?: ChannelButton[]
}

// Slack caps an actions block at 5 elements and a button label at ~75 chars.
// We clamp a bit tighter for safety and to keep messages visually tidy.
const MAX_BUTTONS = 5
const MAX_BUTTON_LABEL = 60

function parseButtons(raw: unknown): ChannelButton[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ChannelButton[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const obj = item as Partial<ChannelButton>
    const label = typeof obj.label === "string" ? obj.label.trim() : ""
    const url = typeof obj.url === "string" ? obj.url.trim() : ""
    if (!label || !url) continue
    // Only allow http(s) URLs so we don't accidentally render `javascript:` etc.
    if (!/^https?:\/\//i.test(url)) continue
    const style = obj.style === "primary" || obj.style === "danger" ? obj.style : undefined
    out.push({
      label: label.length > MAX_BUTTON_LABEL ? `${label.slice(0, MAX_BUTTON_LABEL - 1)}…` : label,
      url,
      ...(style ? { style } : {}),
    })
    if (out.length >= MAX_BUTTONS) break
  }
  return out.length > 0 ? out : undefined
}

function parseStructuredAgentResult(raw: string): StructuredAgentResult | null {
  const parsed = extractAgentJson<Partial<StructuredAgentResult>>(raw)
  if (!parsed || typeof parsed !== "object" || typeof parsed.review !== "string") return null

  return {
    review: parsed.review.trim(),
    channelTitle: typeof parsed.channelTitle === "string" ? parsed.channelTitle.trim() : undefined,
    channelSummary: typeof parsed.channelSummary === "string" ? parsed.channelSummary.trim() : undefined,
    actionNeeded: typeof parsed.actionNeeded === "boolean" ? parsed.actionNeeded : undefined,
    commentNeeded: typeof parsed.commentNeeded === "boolean" ? parsed.commentNeeded : undefined,
    buttons: parseButtons(parsed.buttons),
  }
}

function extractPrimaryLink(payload: Record<string, unknown>) {
  const issue = payload.issue
  if (issue && typeof issue === "object" && typeof (issue as Record<string, unknown>).html_url === "string") {
    return (issue as Record<string, unknown>).html_url as string
  }

  const pullRequest = payload.pull_request
  if (
    pullRequest &&
    typeof pullRequest === "object" &&
    typeof (pullRequest as Record<string, unknown>).html_url === "string"
  ) {
    return (pullRequest as Record<string, unknown>).html_url as string
  }

  const repository = payload.repository
  if (
    repository &&
    typeof repository === "object" &&
    typeof (repository as Record<string, unknown>).html_url === "string"
  ) {
    return (repository as Record<string, unknown>).html_url as string
  }

  return null
}

function extractPrimaryTitle(payload: Record<string, unknown>) {
  const issue = payload.issue
  if (issue && typeof issue === "object" && typeof (issue as Record<string, unknown>).title === "string") {
    return (issue as Record<string, unknown>).title as string
  }

  const pullRequest = payload.pull_request
  if (
    pullRequest &&
    typeof pullRequest === "object" &&
    typeof (pullRequest as Record<string, unknown>).title === "string"
  ) {
    return (pullRequest as Record<string, unknown>).title as string
  }

  return null
}

function buildFallbackTitle(notification: DeliveryNotification) {
  const itemTitle = extractPrimaryTitle(notification.payload)
  if (itemTitle) {
    return `${notification.trigger.name}: ${itemTitle}`
  }

  return `Argus trigger: ${notification.trigger.name}`
}

function buildFallbackSummary(notification: DeliveryNotification) {
  return `Argus processed this ${notification.sourceProvider}/${notification.eventType} event. Open Argus for the full review and history.`
}

function buildPlainText(notification: DeliveryNotification) {
  const parts: string[] = [notification.channelTitle?.trim() || buildFallbackTitle(notification)]
  const summary = notification.channelSummary?.trim() || buildFallbackSummary(notification)
  parts.push("", summary)

  const metadata: string[] = []
  if (notification.actionNeeded !== undefined && notification.actionNeeded !== null) {
    metadata.push(`Action needed: ${notification.actionNeeded ? "Yes" : "No"}`)
  }
  if (notification.commentNeeded !== undefined && notification.commentNeeded !== null) {
    metadata.push(`GitHub comment: ${notification.commentNeeded ? "Needed" : "None"}`)
  }
  metadata.push(`Source: ${notification.sourceProvider}/${notification.eventType}`)

  const link = extractPrimaryLink(notification.payload)
  if (link) {
    metadata.push(`Link: ${link}`)
  }

  if (metadata.length > 0) {
    parts.push("", ...metadata)
  }

  return parts.join("\n")
}

function buildEmailSubject(notification: DeliveryNotification) {
  return `Argus: ${notification.trigger.name}`
}

function parseConfig<T>(row: ChannelRow): T | null {
  if (!row.configJson) return null
  try {
    return JSON.parse(row.configJson) as T
  } catch {
    return null
  }
}

type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }
  | {
      type: "actions"
      elements: Array<{
        type: "button"
        text: { type: "plain_text"; text: string; emoji?: boolean }
        url: string
        style?: "primary" | "danger"
      }>
    }
  | { type: "divider" }

function buildSlackBlocks(notification: DeliveryNotification): SlackBlock[] {
  const blocks: SlackBlock[] = []

  const title = notification.channelTitle?.trim() || buildFallbackTitle(notification)
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: title.slice(0, 150), emoji: true },
  })

  const summary = notification.channelSummary?.trim() || buildFallbackSummary(notification)
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: summary.slice(0, 2900) },
  })

  const context: string[] = []
  if (notification.actionNeeded !== undefined && notification.actionNeeded !== null) {
    context.push(`*Action needed:* ${notification.actionNeeded ? "Yes" : "No"}`)
  }
  if (notification.commentNeeded !== undefined && notification.commentNeeded !== null) {
    context.push(`*GitHub comment:* ${notification.commentNeeded ? "Needed" : "None"}`)
  }
  context.push(`*Source:* \`${notification.sourceProvider}/${notification.eventType}\``)
  if (context.length > 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: context.join("  ·  ") }],
    })
  }

  // Buttons: merge agent-emitted buttons with a default "View source" link so
  // there is always a useful jump-off point even when the agent omits them.
  const buttons = [...(notification.buttons ?? [])]
  const primaryLink = extractPrimaryLink(notification.payload)
  const hasSourceLink = buttons.some((b) => primaryLink && b.url === primaryLink)
  if (primaryLink && !hasSourceLink && buttons.length < MAX_BUTTONS) {
    buttons.push({ label: "View source", url: primaryLink })
  }

  if (buttons.length > 0) {
    blocks.push({
      type: "actions",
      elements: buttons.map((button) => ({
        type: "button" as const,
        text: { type: "plain_text" as const, text: button.label, emoji: true },
        url: button.url,
        ...(button.style ? { style: button.style } : {}),
      })),
    })
  }

  return blocks
}

async function postSlack(notification: DeliveryNotification, row: ChannelRow): Promise<DeliveryResult> {
  const config = parseConfig<{ botToken?: string; channelId?: string }>(row)
  if (!config?.botToken || !config.channelId) {
    throw new Error("Slack channel is missing bot token or channel ID.")
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: config.channelId,
      // `text` is used as the notification/push preview and as a fallback for
      // clients that can't render blocks. Blocks carry the rich layout.
      text: buildPlainText(notification),
      blocks: buildSlackBlocks(notification),
    }),
  })

  const body = await response.text()
  const parsed = JSON.parse(body) as { ok?: boolean; error?: string; ts?: string }
  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.error ?? `Slack request failed with ${response.status}.`)
  }

  return {
    providerMessageId: parsed.ts ?? null,
    responseBody: body,
  }
}

async function postTelegram(notification: DeliveryNotification, row: ChannelRow): Promise<DeliveryResult> {
  const config = parseConfig<{ botToken?: string; chatId?: string }>(row)
  if (!config?.botToken || !config.chatId) {
    throw new Error("Telegram channel is missing bot token or chat ID.")
  }

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: buildPlainText(notification),
    }),
  })

  const body = await response.text()
  const parsed = JSON.parse(body) as { ok?: boolean; description?: string; result?: { message_id?: number } }
  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.description ?? `Telegram request failed with ${response.status}.`)
  }

  return {
    providerMessageId: parsed.result?.message_id ? String(parsed.result.message_id) : null,
    responseBody: body,
  }
}

async function postWhatsApp(notification: DeliveryNotification, row: ChannelRow): Promise<DeliveryResult> {
  const config = parseConfig<{ accessToken?: string; phoneNumberId?: string; recipient?: string }>(row)
  if (!config?.accessToken || !config.phoneNumberId || !config.recipient) {
    throw new Error("WhatsApp channel is missing access token, phone number ID, or recipient.")
  }

  const response = await fetch(`https://graph.facebook.com/v23.0/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: config.recipient,
      type: "text",
      text: {
        body: buildPlainText(notification),
      },
    }),
  })

  const body = await response.text()
  const parsed = JSON.parse(body) as { error?: { message?: string }; messages?: Array<{ id?: string }> }
  if (!response.ok || parsed.error) {
    throw new Error(parsed.error?.message ?? `WhatsApp request failed with ${response.status}.`)
  }

  return {
    providerMessageId: parsed.messages?.[0]?.id ?? null,
    responseBody: body,
  }
}

async function postEmail(notification: DeliveryNotification, row: ChannelRow): Promise<DeliveryResult> {
  const config = parseConfig<{ apiKey?: string; fromEmail?: string; toEmail?: string }>(row)
  if (!config?.apiKey || !config.fromEmail || !config.toEmail) {
    throw new Error("Email channel is missing Resend API key, from email, or to email.")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [config.toEmail],
      subject: buildEmailSubject(notification),
      text: buildPlainText(notification),
    }),
  })

  const body = await response.text()
  const parsed = JSON.parse(body) as { id?: string; message?: string }
  if (!response.ok) {
    throw new Error(parsed.message ?? `Resend request failed with ${response.status}.`)
  }

  return {
    providerMessageId: parsed.id ?? null,
    responseBody: body,
  }
}

async function deliverToChannel(notification: DeliveryNotification, row: ChannelRow) {
  switch (row.provider) {
    case "slack":
      return postSlack(notification, row)
    case "telegram":
      return postTelegram(notification, row)
    case "whatsapp":
      return postWhatsApp(notification, row)
    case "email":
      return postEmail(notification, row)
    default:
      throw new Error(`Unsupported channel provider: ${row.provider}`)
  }
}

function targetLabel(row: ChannelRow) {
  switch (row.provider) {
    case "slack": {
      const config = parseConfig<{ channelId?: string }>(row)
      return config?.channelId ?? "Slack"
    }
    case "telegram": {
      const config = parseConfig<{ chatId?: string }>(row)
      return config?.chatId ?? "Telegram"
    }
    case "whatsapp": {
      const config = parseConfig<{ recipient?: string }>(row)
      return config?.recipient ?? "WhatsApp"
    }
    case "email": {
      const config = parseConfig<{ toEmail?: string }>(row)
      return config?.toEmail ?? "Email"
    }
    default:
      return row.displayName
  }
}

async function recordAttempt(
  db: DB,
  triggerExecutionId: number,
  row: ChannelRow,
  status: "delivered" | "failed",
  createdAt: string,
  result: DeliveryResult | null,
  errorMessage: string | null,
) {
  await db.insert(triggerDeliveryAttempts).values({
    triggerExecutionId,
    provider: row.provider,
    targetLabel: targetLabel(row),
    status,
    providerMessageId: result?.providerMessageId ?? null,
    responseBody: result?.responseBody?.slice(0, 4000) ?? null,
    errorMessage,
    deliveredAt: status === "delivered" ? createdAt : null,
    createdAt,
  })
}

async function deliverNotification(
  db: DB,
  triggerExecutionId: number,
  targets: string[],
  notification: DeliveryNotification,
  createdAt: string,
) {
  if (targets.length === 0) return

  const rows = await db.select().from(schema.channels)
  const selected = rows.filter((row) => targets.includes(row.provider) && row.status === "connected")

  for (const row of selected) {
    try {
      const result = await deliverToChannel(notification, row)
      await recordAttempt(db, triggerExecutionId, row, "delivered", createdAt, result, null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await recordAttempt(db, triggerExecutionId, row, "failed", createdAt, null, message.slice(0, 4000))
      await db
        .update(schema.channels)
        .set({ lastError: message.slice(0, 4000), updatedAt: createdAt })
        .where(eq(schema.channels.id, row.id))
    }
  }
}

export { deliverNotification, parseStructuredAgentResult }
export type { ChannelButton, DeliveryNotification, StructuredAgentResult }

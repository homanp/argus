import crypto from "node:crypto"

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import * as schema from "./db/schema.js"
import { githubWebhookEvents, missions, missionSignals } from "./db/schema.js"

type DB = BetterSQLite3Database<typeof schema>

type SeedMission = {
  id: string
  status: "awaiting_decision" | "decided" | "dismissed"
  priority: "low" | "normal" | "high"
  urgent: boolean
  sourceProvider: string
  sourceEventType: string
  title: string
  recommendation: string
  analysisMarkdown: string
  confidence: number
  confidenceLabel: string
  agentName: string
  plan: Array<{
    step: number
    description: string
    tool: string
    estimate: string
    reversibility: "reversible" | "auto" | "attention"
    reversibilityLabel?: string
  }>
  actions: Array<{
    key: string
    label: string
    hotkey: string
    actionPrompt: string
  }>
  signalPayload: Record<string, unknown>
}

const SEED_MISSIONS: SeedMission[] = [
  {
    id: "seed-acme-refund",
    status: "awaiting_decision",
    priority: "high",
    urgent: true,
    sourceProvider: "stripe",
    sourceEventType: "refund.requested",
    title: "Acme Corp wants a $2,400 refund — what should I do?",
    recommendation: "Offer a 50% credit instead of a full refund",
    analysisMarkdown: [
      "Acme requested a refund this morning citing **unused seats** after 4 months on Brin Team. I dug into this before flagging it — here's what I found.",
      "",
      "The unused seats claim is **verifiable**. Their team restructured on Apr 1 (announced publicly on LinkedIn), and their seat count dropped from 14 to 6 the same day. API calls fell off a cliff on Apr 2 — from a 30-day average of 4,200/day to under 800/day. They're not lying.",
      "",
      "I cross-referenced this with how you've handled similar churns in the past. Of **23 customers** who churned between months 3-6 in the last year, you offered credits in 14 cases (61%), full refunds in 4 (17%), and declined 5 (22%). The credit path averaged `$1,200` recovered as future MRR — meaning customers came back later or expanded other accounts.",
      "",
      "Acme is a clean account: 4 months tenured, $9,600 lifetime value, no prior support tickets, no chargebacks. Their **Brin trust score is 0.91**. If you offer 50% credit ($1,200) instead of the full refund, you keep the relationship warm and statistically recover most of the value over the next 12 months.",
      "",
      "My recommendation: offer the credit. But this is your call — the full-refund path is also reasonable if you'd rather have a clean exit.",
    ].join("\n"),
    confidence: 0.91,
    confidenceLabel: "brin verified",
    agentName: "Argus default",
    plan: [
      {
        step: 1,
        description: "Generate `$1,200` credit code in Stripe — valid 12 months, applies to Brin Team plan only",
        tool: "stripe.coupons.create",
        estimate: "~2s",
        reversibility: "reversible",
      },
      {
        step: 2,
        description:
          'Draft response email to `jane@acme.com` — empathetic tone, acknowledges restructure, frames credit as "stay flexible while you rebuild"',
        tool: "argus mail · gpt-5",
        estimate: "~4s",
        reversibility: "reversible",
        reversibilityLabel: "saved to drafts first",
      },
      {
        step: 3,
        description: "Show you the draft for one-click confirm before sending",
        tool: "gmail.messages.send",
        estimate: "~1s",
        reversibility: "attention",
        reversibilityLabel: "30s recall window after send",
      },
      {
        step: 4,
        description: "Update Acme Corp deal stage to `at-risk · credit-offered` in Linear and tag your CS lead",
        tool: "linear.issue.update",
        estimate: "~1s",
        reversibility: "reversible",
      },
      {
        step: 5,
        description: "Schedule a follow-up check in 5 days — signal you if Acme hasn't redeemed or replied",
        tool: "schedules.create",
        estimate: "~1s",
        reversibility: "reversible",
      },
      {
        step: 6,
        description: "Log decision and outcome to your weekly Insights report",
        tool: "insights.log",
        estimate: "instant",
        reversibility: "auto",
        reversibilityLabel: "automatic",
      },
    ],
    actions: [
      {
        key: "offer_credit",
        label: "Offer 50% credit",
        hotkey: "1",
        actionPrompt:
          "Create a $1,200 Stripe coupon valid 12 months for Brin Team plan. Draft an empathetic email to jane@acme.com acknowledging their restructure, then surface the draft for one-click send. Update the Linear deal to at-risk · credit-offered and schedule a 5-day follow-up.",
      },
      {
        key: "approve_full",
        label: "Approve full refund",
        hotkey: "2",
        actionPrompt:
          "Issue the full $2,400 refund via Stripe. Draft a gracious offboarding email to jane@acme.com and surface it for one-click send. Close the Linear deal as churned · full-refund.",
      },
      {
        key: "draft_starter",
        label: "Draft Starter migration",
        hotkey: "3",
        actionPrompt:
          "Draft a Starter plan migration proposal for Acme — keep 6 seats, move from $600/mo to $240/mo, offer a $1,200 credit as migration incentive. Surface the draft for one-click send.",
      },
      {
        key: "decline",
        label: "Decline",
        hotkey: "4",
        actionPrompt:
          "Decline the refund request. Draft a clear, empathetic email to jane@acme.com citing the terms and offering a support call. Surface the draft for one-click send.",
      },
    ],
    signalPayload: {
      id: "evt_1QxRt2Kj8mP3z",
      type: "refund.requested",
      created: 1712658432,
      data: {
        customer: "cus_Nf9aK2",
        amount: 240000,
        currency: "usd",
        reason: "unused_seats",
        requested_by: "jane@acme.com",
        note: "Downsizing after restructure. Thanks.",
      },
    },
  },
  {
    id: "seed-sequoia-reschedule",
    status: "awaiting_decision",
    priority: "high",
    urgent: true,
    sourceProvider: "calendar",
    sourceEventType: "conflict.detected",
    title: "Sarah Chen wants to move tomorrow's 2pm — protect your prep block?",
    recommendation: "Offer Friday 11am — but it will cost you a prep block",
    analysisMarkdown: [
      "Sarah Chen at Sequoia just requested a reschedule for tomorrow's 2pm. She's flying to LA Friday afternoon and before that only Friday 11am works on her side.",
      "",
      "The problem: **Friday 11am lands on a 60-minute prep window** you marked as protected three months ago. You've broken that rule **3 times in 90 days**, all for investor meetings.",
      "",
      "Historical pattern: Sarah's last reschedule took 11 days to land. If you decline Friday, the next realistic slot is Mon 10am — 4 days later and inside her LA trip.",
      "",
      "This is a values call, not a data call. I'm not going to pick for you.",
    ].join("\n"),
    confidence: 0.74,
    confidenceLabel: "values trade-off",
    agentName: "Argus default",
    plan: [
      {
        step: 1,
        description: "Cancel the Friday 11am prep block on your calendar",
        tool: "calendar.events.delete",
        estimate: "~1s",
        reversibility: "reversible",
      },
      {
        step: 2,
        description: "Send Sarah a calendar invite for Friday 11am confirming the move",
        tool: "calendar.events.create",
        estimate: "~2s",
        reversibility: "reversible",
      },
      {
        step: 3,
        description: "Draft a short reply to Sarah acknowledging the move and surface it for one-click send",
        tool: "argus mail · gpt-5",
        estimate: "~3s",
        reversibility: "reversible",
      },
      {
        step: 4,
        description: "Log the broken prep-block rule for your weekly reflection",
        tool: "insights.log",
        estimate: "instant",
        reversibility: "auto",
      },
    ],
    actions: [
      {
        key: "send_fri_11",
        label: "Send Fri 11am",
        hotkey: "1",
        actionPrompt:
          "Cancel the Friday 11am prep block and send Sarah Chen a confirmed invite for Friday 11am. Draft a short reply acknowledging the move and surface for one-click send.",
      },
      {
        key: "send_mon_10",
        label: "Send Mon 10am",
        hotkey: "2",
        actionPrompt:
          "Decline Friday 11am, preserve the prep block, and offer Sarah Chen Monday 10am instead. Send the invite and draft a short apology note for one-click send.",
      },
      {
        key: "suggest_30",
        label: "Suggest 30-min call",
        hotkey: "3",
        actionPrompt:
          "Offer Sarah Chen a 30-minute call Friday 11:30am so the prep block survives. Draft a short reply surfacing this option and send the invite on confirm.",
      },
    ],
    signalPayload: {
      source: "google.calendar",
      type: "conflict.detected",
      requested_by: "sarah.chen@sequoiacap.com",
      conflict_with: "prep-block-apr-18-11-00",
      proposed_slot: "2026-04-17T18:00:00Z",
      note: "Flying LA Friday afternoon, 11am would work.",
    },
  },
  {
    id: "seed-pr-merge",
    status: "awaiting_decision",
    priority: "normal",
    urgent: false,
    sourceProvider: "github",
    sourceEventType: "pull_request",
    title: "PR #891 fixes a real bug — but breaks the public scoring API",
    recommendation: "Ship as two PRs — deprecation notice first, then the fix",
    analysisMarkdown: [
      "PR #891 is a valid cache invalidation fix on `Brin.score()`. Tests pass. Type check passes.",
      "",
      "The issue: the fix changes the signature of `Brin.score()`. That affects **4 downstream services** in the monorepo, and a public endpoint that sees roughly **340 external calls per day**.",
      "",
      "Pattern from your past work: your team has used a two-step deprecation path **6 times before** without a single customer complaint. The cost is ~2 weeks of extra runtime; the upside is no external breakage.",
    ].join("\n"),
    confidence: 0.82,
    confidenceLabel: "api impact",
    agentName: "Argus Code · grok",
    plan: [
      {
        step: 1,
        description: "Split PR #891 into two branches: deprecation notice + actual fix",
        tool: "github.branch.create",
        estimate: "~5s",
        reversibility: "reversible",
      },
      {
        step: 2,
        description: "Open PR A: deprecation notice with JSDoc @deprecated and runtime warning",
        tool: "github.pulls.create",
        estimate: "~3s",
        reversibility: "reversible",
      },
      {
        step: 3,
        description: "Open PR B: the actual fix, targeting the post-deprecation release",
        tool: "github.pulls.create",
        estimate: "~3s",
        reversibility: "reversible",
      },
      {
        step: 4,
        description: "Notify #engineering with the deprecation timeline and release window",
        tool: "slack.chat.postMessage",
        estimate: "~1s",
        reversibility: "attention",
      },
    ],
    actions: [
      {
        key: "open_deprecation",
        label: "Open deprecation PR",
        hotkey: "1",
        actionPrompt:
          "Split PR #891 into a deprecation notice PR and a fix PR. Open the deprecation PR first with JSDoc @deprecated and a runtime warning. Post a summary to Slack #engineering.",
      },
      {
        key: "merge_asis",
        label: "Merge as-is",
        hotkey: "2",
        actionPrompt:
          "Merge PR #891 as-is on main and immediately cut a patch release. Post a breaking-change note to Slack #engineering.",
      },
      {
        key: "block_v2",
        label: "Block until v2",
        hotkey: "3",
        actionPrompt:
          "Add a blocking review on PR #891 requesting it wait for the v2 API release. Leave an explanation referencing the 340 external calls/day risk.",
      },
    ],
    signalPayload: {
      action: "opened",
      number: 891,
      pull_request: {
        title: "fix: invalidate Brin.score cache on tenure change",
        user: { login: "dana" },
        html_url: "https://github.com/brinlabs/brin-core/pull/891",
      },
    },
  },
  {
    id: "seed-flight-booking",
    status: "awaiting_decision",
    priority: "normal",
    urgent: false,
    sourceProvider: "flights",
    sourceEventType: "conflict.detected",
    title: "SFO flight conflict: your daughter's regional track finals are Jun 14 morning",
    recommendation: "Book Jun 15 outbound for $612 — you'd make both",
    analysisMarkdown: [
      "GOT → SFO dropped below your $500 threshold on Jun 14 morning. Normally I'd book it.",
      "",
      "Except the departure conflicts with your daughter's **1,000m regional finals**. She's been training for this qualifier for months — you flagged it on the family calendar in January.",
      "",
      "The Jun 15 morning option is $612 ($126 more) and still gets you to the YC dinner that evening. Confidence is lower here because this is a values call, not a data call — I won't override a parent.",
    ].join("\n"),
    confidence: 0.68,
    confidenceLabel: "values call",
    agentName: "Argus default",
    plan: [
      {
        step: 1,
        description: "Book the Jun 15 07:10 GOT → SFO flight for $612",
        tool: "flights.book",
        estimate: "~6s",
        reversibility: "attention",
      },
      {
        step: 2,
        description: "Block Jun 14 morning on your calendar for the regional finals",
        tool: "calendar.events.create",
        estimate: "~1s",
        reversibility: "reversible",
      },
      {
        step: 3,
        description: "Confirm arrival with the YC dinner organizer",
        tool: "argus mail · gpt-5",
        estimate: "~3s",
        reversibility: "reversible",
      },
    ],
    actions: [
      {
        key: "book_15",
        label: "Book Jun 15 · $612",
        hotkey: "1",
        actionPrompt:
          "Book the Jun 15 07:10 GOT → SFO flight for $612, block Jun 14 morning on the family calendar for the regional finals, and confirm the YC dinner organizer that I'll still make it.",
      },
      {
        key: "book_14",
        label: "Book Jun 14 · $486",
        hotkey: "2",
        actionPrompt:
          "Book the Jun 14 morning GOT → SFO flight for $486. Draft a note to family explaining the conflict and surface it for one-click send.",
      },
      {
        key: "skip",
        label: "Don't book yet",
        hotkey: "3",
        actionPrompt:
          "Hold off on booking anything. Schedule a daily price watch on GOT → SFO for Jun 14-15 with a $500 alert threshold.",
      },
    ],
    signalPayload: {
      source: "kiwi.flights",
      type: "price.drop",
      origin: "GOT",
      destination: "SFO",
      depart_date: "2026-06-14",
      price_usd: 486,
      threshold_usd: 500,
    },
  },
]

/**
 * Seeds the four example missions from the screenshots when `MISSION_SEED_DEMO=1`
 * is set and no missions exist yet. Safe to call on every boot — noops if the
 * env flag is missing or if any seed mission already exists.
 */
async function seedDemoMissions(db: DB) {
  if (process.env.MISSION_SEED_DEMO !== "1") return

  const existing = await db.select({ id: missions.id }).from(missions)
  if (existing.length > 0) return

  let index = 0

  for (const seed of SEED_MISSIONS) {
    const offsetMinutes = [2, 18, 42, 180][index] ?? index * 30
    const createdAt = new Date(Date.now() - offsetMinutes * 60_000).toISOString()

    const [inserted] = await db
      .insert(githubWebhookEvents)
      .values({
        integrationId: "seed",
        repositoryId: null,
        deliveryId: `seed-${seed.id}-${crypto.randomUUID()}`,
        eventType: seed.sourceEventType,
        source: seed.sourceProvider,
        payloadJson: JSON.stringify(seed.signalPayload),
        receivedAt: createdAt,
      })
      .returning({ id: githubWebhookEvents.id })

    await db.insert(missions).values({
      id: seed.id,
      status: seed.status,
      priority: seed.priority,
      urgent: seed.urgent,
      sourceProvider: seed.sourceProvider,
      sourceEventType: seed.sourceEventType,
      triggerWebhookEventId: inserted?.id ?? null,
      title: seed.title,
      analysisMarkdown: seed.analysisMarkdown,
      recommendation: seed.recommendation,
      confidence: seed.confidence,
      confidenceLabel: seed.confidenceLabel,
      agentName: seed.agentName,
      // Legacy columns retained as nullable/empty — the UI no longer uses
      // either. Real status/priority come from dedicated columns; channel
      // routing for missions isn't wired yet.
      channelHint: null,
      planJson: JSON.stringify(seed.plan),
      actionsJson: JSON.stringify(seed.actions),
      metadataJson: "[]",
      createdAt,
      updatedAt: createdAt,
    })

    if (inserted) {
      await db.insert(missionSignals).values({
        missionId: seed.id,
        webhookEventId: inserted.id,
        label: "trigger",
        createdAt,
      })
    }

    index += 1
  }

  console.log(`Seeded ${SEED_MISSIONS.length} demo missions (MISSION_SEED_DEMO=1).`)
}

export { seedDemoMissions }

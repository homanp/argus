import type { ComponentProps, ReactNode } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ActivitySparkIcon,
  AiBrain02Icon,
  Airplane01Icon,
  Calendar03Icon,
  ChartUpIcon,
  ConnectIcon,
  Github01Icon,
  Mail01Icon,
  Notification03Icon,
  Pulse02Icon,
  SlackIcon,
  StripeIcon,
  Task01Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons"

type AppIcon = ComponentProps<typeof HugeiconsIcon>["icon"]

type NavigationItem = {
  title: string
  icon: AppIcon
  count?: string
  href?: string
  highlighted?: boolean
}

type TaskItem = {
  title: string
  toneClassName: string
}

type DecisionCardData = {
  id: string
  urgent?: boolean
  source: string
  sourceIcon: AppIcon
  event: string
  channel: string
  channelIcon: AppIcon
  taskId: string
  time: string
  title: string
  recommendation: string
  reasoning: ReactNode
  confidence: number
  confidenceLabel: string
  agent: string
  agentToneClassName?: string
  actions: [string, string, string]
}

const primaryNavigation: NavigationItem[] = [
  {
    title: "Missions",
    icon: ActivitySparkIcon,
    count: "4",
    href: "/",
    highlighted: true,
  },
  {
    title: "Pulse",
    icon: Pulse02Icon,
    count: "3",
  },
  {
    title: "Activity",
    icon: Task01Icon,
    count: "247",
  },
  {
    title: "Insights",
    icon: ChartUpIcon,
  },
]

const workspaceNavigation: NavigationItem[] = [
  {
    title: "Connectors",
    icon: ConnectIcon,
    count: "1",
    href: "/connectors",
  },
  {
    title: "Triggers",
    icon: ZapIcon,
    count: "12",
  },
  {
    title: "Channels",
    icon: Notification03Icon,
    count: "6",
  },
  {
    title: "Schedules",
    icon: Calendar03Icon,
    count: "7",
  },
  {
    title: "Agents",
    icon: AiBrain02Icon,
    count: "5",
  },
]

const openTasks: TaskItem[] = [
  {
    title: "Acme Corp refund",
    toneClassName: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]",
  },
  {
    title: "Sequoia reschedule",
    toneClassName: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.45)]",
  },
  {
    title: "PR #891 merge",
    toneClassName: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.45)]",
  },
  {
    title: "SFO flight booking",
    toneClassName: "bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.4)]",
  },
]

const decisionCards: DecisionCardData[] = [
  {
    id: "acme-refund",
    urgent: true,
    source: "Stripe",
    sourceIcon: StripeIcon,
    event: "refund.requested",
    channel: "push + sms",
    channelIcon: Notification03Icon,
    taskId: "TASK-1284",
    time: "2m ago",
    title: "Acme Corp wants a $2,400 refund - what should I do?",
    recommendation: "Offer a 50% credit instead of a full refund",
    reasoning: (
      <>
        Acme reduced seats from 14 to 6 after restructuring on Apr 1, so the unused seats claim is verifiable. Of{" "}
        <strong>23 similar churn cases</strong> in the last 12 months, 61% got credits with an average{" "}
        <code className="rounded bg-white/6 px-1 py-0.5 text-[11px] text-white/90">$1,200</code> recovered as future
        MRR. They are a healthy four-month customer with strong retained upside.
      </>
    ),
    confidence: 0.91,
    confidenceLabel: "brin verified",
    agent: "Argus default",
    actions: ["Offer 50% credit", "Approve full refund", "Decline"],
  },
  {
    id: "sequoia-reschedule",
    urgent: true,
    source: "Calendar",
    sourceIcon: Calendar03Icon,
    event: "conflict.detected",
    channel: "push",
    channelIcon: Notification03Icon,
    taskId: "TASK-1283",
    time: "18m ago",
    title: "Sarah Chen wants to move tomorrow's 2pm - protect your prep block?",
    recommendation: "Offer Friday 11am - but it will cost you a prep block",
    reasoning: (
      <>
        Friday 11am is the only good slot before Sarah leaves for LA. It lands on a{" "}
        <strong>60-minute prep window</strong> you marked as protected. You have broken that rule{" "}
        <strong>3 times in 90 days</strong>, all for investor meetings, and Sarah's last reschedule took 11 days to
        land.
      </>
    ),
    confidence: 0.74,
    confidenceLabel: "values trade-off",
    agent: "Argus default",
    actions: ["Send Fri 11am", "Send Mon 10am", "Suggest 30-min call"],
  },
  {
    id: "pr-merge",
    source: "GitHub",
    sourceIcon: Github01Icon,
    event: "api.breaking_change",
    channel: "slack #engineering",
    channelIcon: SlackIcon,
    taskId: "TASK-1282",
    time: "42m ago",
    title: "PR #891 fixes a real bug - but breaks the public scoring API",
    recommendation: "Ship as two PRs - deprecation notice first, then the fix",
    reasoning: (
      <>
        The cache invalidation fix is real and tests pass, but it changes the signature of{" "}
        <code className="rounded bg-white/6 px-1 py-0.5 text-[11px] text-white/90">Brin.score()</code>. That affects{" "}
        <strong>4 downstream services</strong> and roughly 340 public calls per day. Your team has used the two-step
        deprecation path six times before without customer fallout.
      </>
    ),
    confidence: 0.82,
    confidenceLabel: "api impact",
    agent: "Argus Code · grok",
    agentToneClassName: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    actions: ["Open deprecation PR", "Merge as-is", "Block until v2"],
  },
  {
    id: "flight-booking",
    source: "Flights",
    sourceIcon: Airplane01Icon,
    event: "conflict.detected",
    channel: "email digest",
    channelIcon: Mail01Icon,
    taskId: "TASK-1281",
    time: "3h ago",
    title: "SFO flight conflict: your daughter's regional track finals are Jun 14 morning",
    recommendation: "Book Jun 15 outbound for $612 - you'd make both",
    reasoning: (
      <>
        GOT to SFO dropped below your threshold on Jun 14, but the departure conflicts with your daughter's{" "}
        <strong>1000m regional finals</strong>. The Jun 15 morning option is more expensive, yet it protects the family
        moment and still gets you to the YC dinner that evening.
      </>
    ),
    confidence: 0.68,
    confidenceLabel: "values call",
    agent: "Argus default",
    actions: ["Book Jun 15 · $612", "Book Jun 14 · $486", "Don't book yet"],
  },
]

const missionsHeader = {
  title: "Missions",
  subtitle: "4 waiting · ~2 min to clear · routed to your channels",
}

export { decisionCards, openTasks, primaryNavigation, missionsHeader, workspaceNavigation }
export type { DecisionCardData, NavigationItem, TaskItem }

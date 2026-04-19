import type { ComponentProps } from "react"

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
  warning?: boolean
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
    href: "/triggers",
  },
  {
    title: "Channels",
    icon: Notification03Icon,
    count: "4",
    href: "/channels",
  },
  {
    title: "Schedules",
    icon: Calendar03Icon,
    href: "/schedules",
  },
  {
    title: "Agents",
    icon: AiBrain02Icon,
    href: "/agents",
  },
]

const missionsHeader = {
  title: "Missions",
  subtitle: "Agent-generated decisions waiting on you",
}

const PROVIDER_ICON_MAP: Record<string, AppIcon> = {
  stripe: StripeIcon,
  github: Github01Icon,
  calendar: Calendar03Icon,
  flights: Airplane01Icon,
  slack: SlackIcon,
  email: Mail01Icon,
  gmail: Mail01Icon,
}

function iconForProvider(provider: string): AppIcon {
  const key = provider.toLowerCase()
  return PROVIDER_ICON_MAP[key] ?? ConnectIcon
}

export { PROVIDER_ICON_MAP, iconForProvider, missionsHeader, primaryNavigation, workspaceNavigation }
export type { AppIcon, NavigationItem }

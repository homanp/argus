import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  ConnectIcon,
  Github01Icon,
  Mail01Icon,
  SlackIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons"

type AppIcon = ComponentProps<typeof HugeiconsIcon>["icon"]
type IntegrationCategory =
  | "All connectors"
  | "Developer tools"
  | "Communication"
  | "Productivity"
  | "Browser tools"
  | "Custom connectors"

type IntegrationCatalogItem = {
  provider: string
  title: string
  domain: string
  description: string
  category: IntegrationCategory
  available: boolean
  icon: AppIcon
}

const integrationCategories: IntegrationCategory[] = [
  "All connectors",
  "Developer tools",
  "Communication",
  "Productivity",
  "Browser tools",
  "Custom connectors",
]

const integrationCatalog: IntegrationCatalogItem[] = [
  {
    provider: "github",
    title: "GitHub",
    domain: "github.com",
    description: "Receive repository webhooks, connect repos, and monitor developer activity.",
    category: "Developer tools",
    available: true,
    icon: Github01Icon,
  },
  {
    provider: "linear",
    title: "Linear",
    domain: "linear.app",
    description: "Streamline software projects, sprint planning, and bug tracking with Linear.",
    category: "Developer tools",
    available: false,
    icon: Task01Icon,
  },
  {
    provider: "slack",
    title: "Slack",
    domain: "slack.com",
    description: "Route team communication and message activity into Argus workflows.",
    category: "Communication",
    available: false,
    icon: SlackIcon,
  },
  {
    provider: "gmail",
    title: "Gmail",
    domain: "mail.google.com",
    description: "Manage inbox events and automate email-aware decisions.",
    category: "Productivity",
    available: false,
    icon: Mail01Icon,
  },
  {
    provider: "calendar",
    title: "Calendar",
    domain: "calendar.google.com",
    description: "Track schedules, meeting changes, and conflicts that require intervention.",
    category: "Productivity",
    available: false,
    icon: Calendar03Icon,
  },
  {
    provider: "custom",
    title: "Custom webhook",
    domain: "your-domain.com",
    description: "Bring your own event source with custom webhook endpoints and payloads.",
    category: "Custom connectors",
    available: false,
    icon: ConnectIcon,
  },
]

export { integrationCatalog, integrationCategories }
export type { IntegrationCatalogItem, IntegrationCategory }

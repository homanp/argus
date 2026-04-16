import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ConnectIcon, Mail01Icon, Notification03Icon, SlackIcon } from "@hugeicons/core-free-icons"

import type { ChannelProvider } from "@/lib/relay-api"

type AppIcon = ComponentProps<typeof HugeiconsIcon>["icon"]

type ChannelCatalogItem = {
  provider: ChannelProvider
  title: string
  description: string
  icon: AppIcon
  image?: string
  imageClassName?: string
}

const channelCatalog: ChannelCatalogItem[] = [
  {
    provider: "slack",
    title: "Slack",
    description: "Post trigger notifications directly into a Slack channel with a bot token.",
    icon: SlackIcon,
    image: "/slack.svg",
    imageClassName: "size-5",
  },
  {
    provider: "telegram",
    title: "Telegram",
    description: "Send outbound updates to a Telegram chat using a bot token and chat ID.",
    icon: Notification03Icon,
    image: "/telegram.svg",
    imageClassName: "size-5",
  },
  {
    provider: "whatsapp",
    title: "WhatsApp",
    description: "Deliver trigger summaries over WhatsApp Cloud API with a configured recipient.",
    icon: ConnectIcon,
    image: "/whatsapp.svg",
    imageClassName: "size-5",
  },
  {
    provider: "email",
    title: "Email",
    description: "Send Resend-powered emails for important Argus decisions and trigger events.",
    icon: Mail01Icon,
    image: "/resend.svg",
    imageClassName: "size-5",
  },
]

export { channelCatalog }
export type { ChannelCatalogItem }

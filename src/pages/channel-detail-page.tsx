import { useEffect, useMemo, useState } from "react"
import { useRouterState } from "@tanstack/react-router"

import { badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Input } from "@/components/ui/input"
import { channelCatalog } from "@/lib/channel-catalog"
import {
  configureChannel,
  discoverTelegramChats,
  getChannel,
  removeChannel,
  type ChannelProvider,
  type ChannelState,
  type TelegramDiscoveryResponse,
} from "@/lib/relay-api"
import { cn } from "@/lib/utils"

type ChannelField = {
  key: string
  label: string
  placeholder: string
  helper: string
  sensitive?: boolean
}

const channelFields: Record<ChannelProvider, ChannelField[]> = {
  slack: [
    {
      key: "botToken",
      label: "Bot token",
      placeholder: "xoxb-...",
      helper: "Bot token used for chat.postMessage requests.",
      sensitive: true,
    },
    {
      key: "channelId",
      label: "Channel ID",
      placeholder: "C0123456789",
      helper: "Destination Slack channel ID where Argus posts notifications.",
    },
  ],
  telegram: [
    {
      key: "botToken",
      label: "Bot token",
      placeholder: "123456:ABCDEF",
      helper: "BotFather-issued token for Telegram Bot API requests.",
      sensitive: true,
    },
  ],
  whatsapp: [
    {
      key: "accessToken",
      label: "Access token",
      placeholder: "EAAG...",
      helper: "Meta access token for WhatsApp Cloud API.",
      sensitive: true,
    },
    {
      key: "phoneNumberId",
      label: "Phone number ID",
      placeholder: "123456789012345",
      helper: "Meta phone number ID used for outbound sends.",
    },
    {
      key: "recipient",
      label: "Recipient number",
      placeholder: "15551234567",
      helper: "E.164 number Argus should message.",
    },
  ],
  email: [
    {
      key: "apiKey",
      label: "Resend API key",
      placeholder: "re_...",
      helper: "API key used for direct Resend email sends.",
      sensitive: true,
    },
    {
      key: "fromEmail",
      label: "From email",
      placeholder: "argus@updates.example.com",
      helper: "Verified sender address in Resend.",
    },
    {
      key: "toEmail",
      label: "To email",
      placeholder: "alerts@example.com",
      helper: "Default recipient for trigger notifications.",
    },
  ],
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "connected":
      return badgeVariants({ size: "sm", variant: "success" })
    case "error":
      return badgeVariants({ size: "sm", variant: "danger" })
    default:
      return badgeVariants({ size: "sm", variant: "neutral" })
  }
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function ChannelDetailPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const provider = (pathname.split("/").filter(Boolean).at(1) ?? "slack") as ChannelProvider
  const channel = channelCatalog.find((item) => item.provider === provider) ?? channelCatalog[0]
  const fields = useMemo(() => channelFields[provider], [provider])

  const [channelState, setChannelState] = useState<ChannelState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [discoveringTelegram, setDiscoveringTelegram] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [telegramDiscovery, setTelegramDiscovery] = useState<TelegramDiscoveryResponse | null>(null)
  const isTelegram = provider === "telegram"
  const canSave = isTelegram ? Boolean(formValues.botToken?.trim() && formValues.chatId?.trim()) : true

  function syncNavbarBadge(status: string) {
    const badge = document.getElementById("channel-status-badge")
    if (!badge) return
    const label = capitalize(status.replaceAll("_", " "))
    badge.textContent = label
    badge.className = `ml-1 ${statusBadgeClasses(status)}`
  }

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    getChannel(provider)
      .then((state) => {
        if (cancelled) return
        setChannelState(state)
        setFormValues(state.config ?? {})
        setTelegramDiscovery(null)
        syncNavbarBadge(state.status)
        if (provider === "telegram" && state.config?.botToken) {
          void discoverTelegramChats(state.config.botToken)
            .then((result) => {
              if (!cancelled) setTelegramDiscovery(result)
            })
            .catch(() => {})
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load channel.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      const badge = document.getElementById("channel-status-badge")
      if (badge) badge.className = "ml-1 hidden"
    }
  }, [provider])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const state = await configureChannel(provider, formValues)
      setChannelState(state)
      setFormValues(state.config ?? {})
      syncNavbarBadge(state.status)
      setNotice(`${channel.title} configured and ready for outbound delivery.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save channel.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDiscoverTelegram() {
    const botToken = formValues.botToken?.trim() ?? ""
    if (!botToken) return

    setDiscoveringTelegram(true)
    setError(null)
    setNotice(null)
    try {
      const result = await discoverTelegramChats(botToken)
      setTelegramDiscovery(result)
      if (result.chats.length > 0) {
        const currentChatId = formValues.chatId?.trim()
        const nextChatId =
          currentChatId && result.chats.some((chat) => chat.id === currentChatId)
            ? currentChatId
            : (result.chats[0]?.id ?? "")
        setFormValues((current) => ({ ...current, chatId: nextChatId }))
        setNotice("Telegram bot paired. Pick the chat that should receive Argus messages.")
      } else {
        setFormValues((current) => ({ ...current, chatId: "" }))
        setNotice("Bot verified. Open it in Telegram, send /start, then refresh chats.")
      }
    } catch (discoverError) {
      setTelegramDiscovery(null)
      setError(discoverError instanceof Error ? discoverError.message : "Failed to discover Telegram chats.")
    } finally {
      setDiscoveringTelegram(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    setNotice(null)
    try {
      await removeChannel(provider)
      const state = await getChannel(provider)
      setChannelState(state)
      setFormValues({})
      syncNavbarBadge(state.status)
      setNotice(`${channel.title} configuration cleared.`)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove channel.")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {notice && <p className="text-[13px] text-emerald-200/85">{notice}</p>}
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        {loading ? (
          <div className="rounded-lg border border-white/8 px-5 py-8 text-center text-[13px] text-white/40">
            Loading...
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-white/8">
              <div className="border-b border-white/6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                    {channel.image ? (
                      <img
                        src={channel.image}
                        alt={channel.title}
                        className={cn("size-5 object-contain", channel.imageClassName)}
                      />
                    ) : (
                      <HugeIcon icon={channel.icon} size={18} className="text-white/70" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white/80">{channel.title}</p>
                    <p className="text-[12px] text-white/40">{channel.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-[12px] font-medium text-white/60">{field.label}</label>
                    <Input
                      type={field.sensitive ? "password" : "text"}
                      value={formValues[field.key] ?? ""}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setFormValues((current) => ({ ...current, [field.key]: value }))
                      }}
                      placeholder={field.placeholder}
                    />
                    <p className="text-[11px] text-white/30">{field.helper}</p>
                  </div>
                ))}

                {isTelegram && (
                  <div className="space-y-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleDiscoverTelegram()}
                        disabled={discoveringTelegram || !formValues.botToken?.trim()}
                        className="border-white/10 bg-transparent text-[11px] font-normal text-white/60 hover:bg-white/[0.04] hover:text-white/80"
                      >
                        {discoveringTelegram ? "Refreshing..." : "Refresh chats"}
                      </Button>
                      {telegramDiscovery?.bot.username && (
                        <a
                          href={`https://t.me/${telegramDiscovery.bot.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-violet-200/80 hover:text-violet-100"
                        >
                          Open @{telegramDiscovery.bot.username}
                        </a>
                      )}
                    </div>

                    <p className="text-[11px] text-white/30">
                      Start the bot in Telegram first, then refresh to discover chats you can send to.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-white/60">Chat</label>
                      <select
                        value={formValues.chatId ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value
                          setFormValues((current) => ({ ...current, chatId: value }))
                        }}
                        className="flex h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[13px] text-white/70"
                      >
                        <option value="">Select a Telegram chat...</option>
                        {telegramDiscovery?.chats.map((chat) => (
                          <option key={chat.id} value={chat.id}>
                            {chat.title} ({chat.type})
                          </option>
                        ))}
                      </select>
                      {telegramDiscovery?.chats.length ? (
                        <p className="text-[11px] text-white/30">
                          Choose the chat or group where Argus should post updates.
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/30">
                          No chats discovered yet. Open the bot, send /start, then refresh.
                        </p>
                      )}
                      {formValues.chatId && !telegramDiscovery?.chats.some((chat) => chat.id === formValues.chatId) && (
                        <p className="text-[11px] text-white/30">Current selected chat ID: {formValues.chatId}</p>
                      )}
                    </div>
                  </div>
                )}

                {channelState?.lastValidatedAt && (
                  <p className="text-[11px] text-white/30">
                    Last updated {new Date(channelState.lastValidatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => void handleSave()}
                disabled={saving || !canSave}
                className="bg-violet-300 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              {channelState?.status === "connected" && (
                <Button
                  variant="outline"
                  onClick={() => void handleRemove()}
                  disabled={removing}
                  className="border-white/10 bg-transparent text-[11px] font-normal text-rose-300/60 hover:bg-rose-400/10 hover:text-rose-300"
                >
                  {removing ? "Clearing..." : "Clear configuration"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default ChannelDetailPage

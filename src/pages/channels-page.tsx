import { useEffect, useState } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { channelCatalog } from "@/lib/channel-catalog"
import { getChannels, type ChannelState } from "@/lib/relay-api"
import { cn } from "@/lib/utils"

function ChannelsPage() {
  const navigate = useNavigate()
  const [channelsState, setChannelsState] = useState<ChannelState[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getChannels()
      .then((data) => {
        if (!cancelled) setChannelsState(data)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to reach the local relay.")
      })

    return () => {
      cancelled = true
    }
  }, [])

  function resolveStatus(provider: ChannelState["provider"]) {
    return channelsState.find((item) => item.provider === provider)?.status ?? "not_connected"
  }

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        <div className="overflow-hidden rounded-lg border border-white/8">
          {channelCatalog.map((channel, index) => {
            const isLast = index === channelCatalog.length - 1
            const status = resolveStatus(channel.provider)

            return (
              <button
                key={channel.provider}
                type="button"
                onClick={() => navigate({ to: "/channels/$provider", params: { provider: channel.provider } })}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]",
                  !isLast && "border-b border-white/6",
                )}
              >
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

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/85">{channel.title}</p>
                  <p className="truncate text-[12px] text-white/40">{channel.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {status === "connected" ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <span className="text-[12px] text-white/40">Configure</span>
                  )}
                  <HugeIcon icon={ArrowRight01Icon} size={14} className="text-white/20" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ChannelsPage

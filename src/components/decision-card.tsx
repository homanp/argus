import { useState } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { iconForProvider } from "@/lib/app-shell-data"
import { decideMission } from "@/lib/relay-api"
import type { MissionSummary } from "@/lib/relay-api"
import { cn } from "@/lib/utils"

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const filledPips = Math.round(confidence * 5)

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-5 rounded-full bg-white/10",
            index < filledPips && "bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.45)]",
          )}
        />
      ))}
    </div>
  )
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function MissionCard({
  mission,
  agentName,
  onDecided,
}: {
  mission: MissionSummary
  agentName: string | null
  onDecided?: () => void
}) {
  const [pending, setPending] = useState(false)
  const [decidedKey, setDecidedKey] = useState<string | null>(mission.decidedActionKey ?? null)
  const isDecided = mission.status !== "awaiting_decision" || decidedKey !== null

  const sourceIcon = iconForProvider(mission.sourceProvider)
  const actions = mission.actions.length > 0 ? mission.actions : []

  async function handleAction(actionKey: string) {
    if (pending || isDecided || !actionKey) return
    setPending(true)
    try {
      await decideMission(mission.id, actionKey)
      setDecidedKey(actionKey)
      onDecided?.()
    } catch {
      // swallow — toast surface lives on the detail page
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden rounded-lg border border-white/8 bg-white/[0.025] py-0 text-white shadow-none ring-0 transition-colors hover:bg-white/[0.04]",
        mission.urgent && "shadow-[inset_1px_0_0_0_rgba(244,114,182,0.9)]",
        isDecided && "opacity-60",
      )}
    >
      <CardContent className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
          <Badge variant="subtle" size="md" className="text-white/80">
            <HugeIcon icon={sourceIcon} size={14} className="text-white/60" />
            <span className="font-medium text-white capitalize">{mission.sourceProvider}</span>
            <span className="text-white/35">{mission.sourceEventType}</span>
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            {agentName && (
              <Badge variant="violet" size="md" className="text-violet-50">
                {agentName}
              </Badge>
            )}
            <span>{timeAgo(mission.createdAt)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="max-w-4xl text-[22px] leading-tight font-semibold tracking-[-0.02em] text-white">
            {mission.title}
          </h2>

          <div className="rounded-md border border-violet-300/15 bg-violet-300/[0.08] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.65)]" />
              <p className="text-sm font-medium text-violet-50">{mission.recommendation}</p>
            </div>

            <p className="text-[13px] leading-6 text-white/72">
              {mission.analysisMarkdown
                .split(/\n\n+/)[0]
                .replace(/[*_`#>]/g, "")
                .slice(0, 280)}
              {mission.analysisMarkdown.length > 280 ? "…" : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
              <span>Confidence</span>
              <ConfidenceMeter confidence={mission.confidence} />
              <span>
                {mission.confidence.toFixed(2)}
                {mission.confidenceLabel ? ` · ${mission.confidenceLabel}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.slice(0, 3).map((action, index) => {
            const isPrimary = index === 0
            const hotkey = action.hotkey || String(index + 1)
            return (
              <Button
                key={action.key}
                disabled={pending || isDecided}
                onClick={() => handleAction(action.key)}
                variant={isPrimary ? "default" : "outline"}
                className={cn(
                  "h-8 rounded-lg px-3 text-[12px]",
                  isPrimary
                    ? "bg-violet-300 font-semibold text-violet-950 hover:bg-violet-200"
                    : "border-white/10 bg-transparent text-white/72 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {action.label}
                <Badge
                  size="sm"
                  className={cn(
                    "ml-1 border-transparent",
                    isPrimary ? "bg-black/12 text-black/65" : "bg-white/[0.06] text-white/50",
                  )}
                >
                  {hotkey}
                </Badge>
              </Button>
            )
          })}

          <div className="ml-auto">
            <Button
              variant="ghost"
              render={<Link to="/missions/$missionId" params={{ missionId: mission.id }} />}
              className="h-8 rounded-lg px-2 text-[12px] text-white/55 hover:bg-white/[0.04] hover:text-white"
            >
              Open detail
              <HugeIcon icon={ArrowRight01Icon} size={14} className="text-white/50" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { MissionCard }

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { DecisionCardData } from "@/lib/app-shell-data"
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

function DecisionCard({ card }: { card: DecisionCardData }) {
  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden rounded-lg border border-white/8 bg-white/[0.025] py-0 text-white shadow-none ring-0 transition-colors hover:bg-white/[0.04]",
        card.urgent && "shadow-[inset_1px_0_0_0_rgba(244,114,182,0.9)]",
      )}
    >
      <CardContent className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
          <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-white/80">
            <HugeIcon icon={card.sourceIcon} size={14} className="text-white/60" />
            <span className="font-medium text-white">{card.source}</span>
            <span className="text-white/35">{card.event}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2 py-1">
              <HugeIcon icon={card.channelIcon} size={12} className="text-white/60" />
              <span>{card.channel}</span>
            </div>
            <span>{card.taskId}</span>
            <span>{card.time}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="max-w-4xl text-[22px] leading-tight font-semibold tracking-[-0.02em] text-white">
            {card.title}
          </h2>

          <div className="rounded-md border border-violet-300/15 bg-violet-300/[0.08] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.65)]" />
              <p className="text-sm font-medium text-violet-50">{card.recommendation}</p>
            </div>

            <div className="text-[13px] leading-6 text-white/72">{card.reasoning}</div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
              <span>Confidence</span>
              <ConfidenceMeter confidence={card.confidence} />
              <span>
                {card.confidence.toFixed(2)} · {card.confidenceLabel}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/[0.10] px-2 py-1 text-violet-50",
                  card.agentToneClassName,
                )}
              >
                {card.agent}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-8 rounded-lg bg-violet-300 px-3 text-[12px] font-semibold text-violet-950 hover:bg-violet-200">
            {card.actions[0]}
            <span className="ml-1 rounded-md bg-black/12 px-1.5 py-0.5 text-[10px] text-black/65">1</span>
          </Button>
          <Button
            variant="outline"
            className="h-8 rounded-lg border-white/10 bg-transparent px-3 text-[12px] text-white/72 hover:bg-white/[0.04] hover:text-white"
          >
            {card.actions[1]}
            <span className="ml-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/50">2</span>
          </Button>
          <Button
            variant="outline"
            className="h-8 rounded-lg border-white/10 bg-transparent px-3 text-[12px] text-white/72 hover:bg-white/[0.04] hover:text-white"
          >
            {card.actions[2]}
            <span className="ml-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/50">3</span>
          </Button>

          <div className="ml-auto">
            <Button
              variant="ghost"
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

export { DecisionCard }

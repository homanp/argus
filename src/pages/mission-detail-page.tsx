import { useCallback, useEffect, useState } from "react"
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Cursor01Icon,
  FullSignalIcon,
  Loading03Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { ProviderGlyph } from "@/components/provider-glyph"
import { JsonView } from "@/components/ui/json-view"
import { decideMission, dismissMission, getAgent, getMission } from "@/lib/relay-api"
import type { AgentConfig, MissionAction, MissionDetailResponse, MissionSignal } from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { cn } from "@/lib/utils"

function syncNavbar(mission: MissionDetailResponse["mission"] | null) {
  const nameEl = document.getElementById("mission-detail-name")
  if (nameEl) nameEl.textContent = mission ? mission.title : "Detail"

  const statusEl = document.getElementById("mission-detail-status")
  if (statusEl) {
    if (!mission) {
      statusEl.className = "ml-1 hidden"
      statusEl.textContent = ""
      return
    }
    const label =
      mission.status === "awaiting_decision"
        ? "Awaiting decision"
        : mission.status === "decided"
          ? "Decided"
          : "Dismissed"
    const variant = mission.status === "awaiting_decision" ? "violet" : "neutral"
    statusEl.textContent = label
    statusEl.className = `ml-1 ${badgeVariants({ size: "sm", variant })}`
  }
}

function clearNavbar() {
  syncNavbar(null)
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

const REVERSIBILITY_TEXT_CLASS = {
  reversible: "text-emerald-300",
  auto: "text-emerald-300/80",
  attention: "text-amber-300",
} as const

const REVERSIBILITY_DOT_CLASS = {
  reversible: "bg-emerald-400",
  auto: "bg-emerald-400/70",
  attention: "bg-amber-400",
} as const

const DEFAULT_REVERSIBILITY_LABEL = {
  reversible: "reversible",
  auto: "automatic",
  attention: "attention needed",
} as const

function PlanStepRow({
  step,
  description,
  tool,
  estimate,
  reversibility,
  reversibilityLabel,
  isLast,
}: {
  step: number
  description: string
  tool: string
  estimate: string
  reversibility: "reversible" | "auto" | "attention"
  reversibilityLabel?: string
  isLast: boolean
}) {
  const label = reversibilityLabel?.trim() || DEFAULT_REVERSIBILITY_LABEL[reversibility]

  return (
    <div className="relative flex items-start gap-4 pb-7 last:pb-0">
      {!isLast && <span className="absolute top-7 bottom-0 left-3.5 w-px bg-white/8" aria-hidden="true" />}
      <div className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0f0f10] text-[12px] font-medium text-white/55">
        {step}
      </div>
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
        <div className="text-[13px] leading-6 text-white [&_code]:inline-flex [&_code]:items-center [&_code]:rounded [&_code]:border [&_code]:border-white/10 [&_code]:bg-white/[0.04] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-white/90 [&_p]:my-0 [&_strong]:font-semibold [&_strong]:text-white">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
          {tool && (
            <Badge variant="subtle" size="sm" className="font-mono text-white/75">
              <HugeIcon icon={Settings01Icon} size={11} className="text-white/40" />
              {tool}
            </Badge>
          )}
          {estimate && <span className="text-white/45">{estimate}</span>}
          <span className={cn("flex items-center gap-1.5", REVERSIBILITY_TEXT_CLASS[reversibility])}>
            <span className={cn("size-1.5 rounded-full", REVERSIBILITY_DOT_CLASS[reversibility])} />
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

function SignalCard({ signal }: { signal: MissionSignal }) {
  const [expanded, setExpanded] = useState(true)
  const provider = signal.source ?? "argus"
  const comment = `${signal.source ? `${signal.source}/` : ""}${signal.eventType ?? "event"}`

  return (
    <div className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
        <Badge variant="subtle" size="md" className="text-white/80">
          <ProviderGlyph provider={provider} size={14} iconClassName="text-white/60" />
          <span className="font-medium text-white capitalize">{provider}</span>
          <span className="text-white/35">{signal.eventType ?? "webhook"}</span>
        </Badge>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-white/40">
          {signal.receivedAt && <span>{timeAgo(signal.receivedAt)}</span>}
          {signal.label && (
            <Badge size="sm" variant="neutral" className="text-[10px] uppercase tracking-wide">
              {signal.label}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-white/35 hover:text-white/70"
          >
            {expanded ? "collapse" : "view raw"}
          </button>
        </div>
      </div>
      {expanded && <JsonView value={signal.payload ?? {}} comment={comment} />}
    </div>
  )
}

const ARTIFACT_KIND_LABEL: Record<string, string> = {
  markdown: "Markdown",
  email: "Email draft",
  github_comment: "GitHub comment",
  slack_message: "Slack message",
}

const ARTIFACT_RECIPIENT_LABEL: Record<string, string> = {
  email: "To",
  github_comment: "On",
  slack_message: "In",
  markdown: "For",
}

function ArtifactCard({ action }: { action: MissionAction }) {
  const artifact = action.artifact
  if (!artifact) return null
  const kindLabel = ARTIFACT_KIND_LABEL[artifact.kind] ?? artifact.kind
  const recipientLabel = ARTIFACT_RECIPIENT_LABEL[artifact.kind] ?? "For"

  return (
    <div className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 border-b border-white/6 px-5 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="subtle" size="sm" className="text-[10px] text-white/80">
              {kindLabel}
            </Badge>
            <p className="truncate text-[13px] font-medium text-white">{action.label}</p>
          </div>
          {artifact.title && <p className="truncate text-[12px] text-white/55">{artifact.title}</p>}
        </div>
        {artifact.recipient && (
          <div className="shrink-0 text-right text-[11px] text-white/45">
            <p className="uppercase tracking-wide text-white/30">{recipientLabel}</p>
            <p className="font-mono text-white/70">{artifact.recipient}</p>
          </div>
        )}
      </div>
      <div className="px-5 py-4 text-[13px] leading-7 text-white/80 [&_code]:rounded [&_code]:bg-white/6 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-white/90 [&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-white [&_li]:mb-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-white">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.body}</ReactMarkdown>
      </div>
    </div>
  )
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock01Icon; textClass: string; iconClass: string }> = {
  awaiting_decision: {
    label: "Awaiting decision",
    icon: Clock01Icon,
    textClass: "text-amber-300",
    iconClass: "text-amber-300",
  },
  decided: {
    label: "Decided",
    icon: CheckmarkCircle02Icon,
    textClass: "text-emerald-300",
    iconClass: "text-emerald-300",
  },
  dismissed: {
    label: "Dismissed",
    icon: Cancel01Icon,
    textClass: "text-white/50",
    iconClass: "text-white/40",
  },
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "High priority",
  normal: "Normal priority",
  low: "Low priority",
}

function StatusPanel({ status, priority, urgent }: { status: string; priority: string; urgent: boolean }) {
  const statusMeta = STATUS_META[status] ?? {
    label: status,
    icon: Clock01Icon,
    textClass: "text-white/70",
    iconClass: "text-white/40",
  }
  const priorityText = urgent ? "Urgent" : (PRIORITY_LABEL[priority] ?? `${priority} priority`)
  const priorityTextClass = urgent ? "text-rose-300" : "text-white/80"
  const priorityIconClass = urgent ? "text-rose-300/80" : "text-white/40"

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-medium text-white/40">Status</p>
      <div className="space-y-2">
        <div className={cn("flex items-center gap-2 text-[12px]", statusMeta.textClass)}>
          <HugeIcon icon={statusMeta.icon} size={12} className={statusMeta.iconClass} />
          <span className="font-medium">{statusMeta.label}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <HugeIcon icon={FullSignalIcon} size={12} className={priorityIconClass} />
          <span className={priorityTextClass}>{priorityText}</span>
        </div>
      </div>
    </div>
  )
}

function MissionDetailPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const missionId = pathname.split("/").filter(Boolean).at(1) ?? ""

  const [data, setData] = useState<MissionDetailResponse | null>(null)
  const [agent, setAgent] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!missionId) return
    getMission(missionId)
      .then((result) => {
        setData(result)
        syncNavbar(result.mission)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load mission.")
      })
      .finally(() => setLoading(false))
  }, [missionId])

  useEffect(() => {
    reload()
    return clearNavbar
  }, [reload])

  // SSE drives refreshes. The relay emits `missions` on state changes,
  // including mission_executions going pending → running → completed/failed,
  // so the Decision history block updates live without polling.
  useRelayEvent("missions", reload)

  useEffect(() => {
    let cancelled = false
    getAgent()
      .then((result) => {
        if (!cancelled) setAgent(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleDismiss() {
      if (!missionId) return
      dismissMission(missionId)
        .then(() => navigate({ to: "/" }))
        .catch(() => {})
    }
    window.addEventListener("argus:dismiss-mission", handleDismiss)
    return () => window.removeEventListener("argus:dismiss-mission", handleDismiss)
  }, [missionId, navigate])

  const handleAction = useCallback(
    async (actionKey: string) => {
      if (!missionId || pendingKey) return
      setPendingKey(actionKey)
      try {
        await decideMission(missionId, actionKey)
        reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record decision.")
      } finally {
        setPendingKey(null)
      }
    },
    [missionId, pendingKey, reload],
  )

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!data) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      const action = data.mission.actions.find((item) => item.hotkey === event.key)
      if (action) {
        event.preventDefault()
        void handleAction(action.key)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [data, handleAction])

  if (loading && !data) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading mission...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-[13px] text-rose-200/85">{error ?? "Mission not found."}</p>
        </div>
      </section>
    )
  }

  const { mission, signals, executions } = data
  const isDecided = mission.status !== "awaiting_decision"

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
              <Badge variant="subtle" size="md" className="text-white/80">
                <ProviderGlyph provider={mission.sourceProvider} size={14} iconClassName="text-white/60" />
                <span className="font-medium text-white capitalize">{mission.sourceProvider}</span>
                <span className="text-white/35">{mission.sourceEventType}</span>
              </Badge>
              <span>{timeAgo(mission.createdAt)}</span>
              {agent && (
                <Badge variant="violet" size="md" className="text-violet-50">
                  {agent.name}
                </Badge>
              )}
            </div>
            <h1 className="text-lg leading-snug font-semibold tracking-[-0.01em] text-white">{mission.title}</h1>
          </div>

          <div className="space-y-3">
            <p className="text-[12px] font-medium text-white/40">Argus's analysis</p>
            <div className="space-y-3 text-[13px] leading-7 text-white/80 [&_code]:rounded [&_code]:bg-white/6 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-white/90 [&_p]:text-white/80 [&_strong]:font-semibold [&_strong]:text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{mission.analysisMarkdown}</ReactMarkdown>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[12px] font-medium text-white/40">Plan</p>
            <p className="text-[13px] leading-6 text-white/55">
              If you choose <span className="font-semibold text-white">"{mission.recommendation}"</span>, here's exactly
              what I'll do:
            </p>
            <div className="pt-2">
              {mission.plan.length > 0 ? (
                mission.plan.map((step, index) => (
                  <PlanStepRow
                    key={`${step.step}-${index}`}
                    step={step.step}
                    description={step.description}
                    tool={step.tool}
                    estimate={step.estimate}
                    reversibility={step.reversibility}
                    reversibilityLabel={step.reversibilityLabel}
                    isLast={index === mission.plan.length - 1}
                  />
                ))
              ) : (
                <p className="py-4 text-[13px] text-white/40">No plan steps returned for this mission.</p>
              )}
            </div>
          </div>

          {mission.actions.some((action) => action.artifact) && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <p className="text-[12px] font-medium text-white/40">Drafted outcomes</p>
                <p className="text-[11px] text-white/35">What happens if you approve — review before clicking.</p>
              </div>
              <div className="space-y-3">
                {mission.actions
                  .filter((action) => action.artifact)
                  .map((action) => (
                    <ArtifactCard key={action.key} action={action} />
                  ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-[12px] font-medium text-white/40">
                Signals · {signals.length} source{signals.length === 1 ? "" : "s"}
              </p>
            </div>
            {signals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-[13px] text-white/40">
                No signal payloads attached to this mission.
              </div>
            ) : (
              <div className="space-y-3">
                {signals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </div>

          {executions.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-white/8">
              <div className="border-b border-white/6 px-5 py-3">
                <p className="text-[12px] font-medium text-white/40">Decision history</p>
              </div>
              <div className="divide-y divide-white/5">
                {executions.map((exec) => (
                  <div key={exec.id} className="flex items-start gap-3 px-5 py-3 text-[13px] text-white/75">
                    <span
                      className={cn(
                        "mt-1 size-1.5 shrink-0 rounded-full",
                        exec.status === "pending" && "bg-amber-400",
                        exec.status === "running" && "bg-amber-400 animate-pulse",
                        exec.status === "completed" && "bg-emerald-400",
                        exec.status === "failed" && "bg-rose-400",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{exec.actionKey}</p>
                      <p className="text-[11px] text-white/40">
                        {timeAgo(exec.startedAt)} · {exec.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-2 lg:self-start lg:max-h-[calc(100svh-5rem)] lg:overflow-y-auto lg:pr-1">
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-white/40">Actions</p>
            <div className="space-y-1.5">
              {mission.actions.length > 0 ? (
                mission.actions.map((action, index) => {
                  const isPrimary = index === 0 && !isDecided
                  const isChosen = mission.decidedActionKey === action.key
                  const disabled = Boolean(pendingKey || isDecided)
                  return (
                    <Button
                      key={action.key}
                      disabled={disabled}
                      onClick={() => handleAction(action.key)}
                      variant={isPrimary ? "default" : "outline"}
                      className={cn(
                        "h-8 w-full justify-between rounded-lg px-3 text-[12px]",
                        isPrimary
                          ? "bg-violet-300 font-semibold text-violet-950 hover:bg-violet-200"
                          : "border-white/10 bg-transparent text-white/72 hover:bg-white/[0.04] hover:text-white",
                        isChosen && "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
                      )}
                    >
                      <span className="truncate text-left">{action.label}</span>
                      <Badge
                        size="sm"
                        className={cn(
                          "ml-1 border-transparent",
                          isPrimary ? "bg-black/12 text-black/65" : "bg-white/[0.06] text-white/50",
                        )}
                      >
                        {action.hotkey}
                      </Badge>
                    </Button>
                  )
                })
              ) : (
                <p className="text-[12px] text-white/40">No actions were proposed for this mission.</p>
              )}
            </div>
            {pendingKey && (
              <p className="flex items-center gap-1.5 text-[11px] text-white/40">
                <HugeIcon icon={Loading03Icon} size={11} className="animate-spin" />
                Recording decision...
              </p>
            )}
          </div>

          <StatusPanel status={mission.status} priority={mission.priority} urgent={mission.urgent} />

          <div className="space-y-3 border-t border-white/6 pt-5">
            <p className="text-[12px] font-medium text-white/40">Confidence</p>
            <div className="flex items-center gap-2 text-[12px] text-white/75">
              <HugeIcon icon={Cursor01Icon} size={12} className="text-white/40" />
              <span>{mission.confidence.toFixed(2)}</span>
              {mission.confidenceLabel && <span className="text-white/45">· {mission.confidenceLabel}</span>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default MissionDetailPage

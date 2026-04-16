import { useEffect, useState } from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TriggerSheet } from "@/components/trigger-sheet"
import {
  deleteTrigger,
  getChannels,
  getGitHubAvailableEvents,
  getTriggerExecutions,
  type AvailableEventsResponse,
  type ChannelState,
  type Trigger,
  type TriggerDetailResponse,
  type TriggerExecution,
} from "@/lib/relay-api"

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ")
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

function syncNavbar(name: string, enabled: boolean) {
  const nameEl = document.getElementById("trigger-detail-name")
  if (nameEl) nameEl.textContent = name

  const statusEl = document.getElementById("trigger-detail-status")
  if (statusEl) {
    statusEl.textContent = enabled ? "Enabled" : "Disabled"
    statusEl.className = `ml-1 ${badgeVariants({ size: "sm", variant: enabled ? "success" : "neutral" })}`
  }
}

function clearNavbar() {
  const nameEl = document.getElementById("trigger-detail-name")
  if (nameEl) nameEl.textContent = "Detail"
  const statusEl = document.getElementById("trigger-detail-status")
  if (statusEl) statusEl.className = "ml-1 hidden"
}

const statusDot: Record<string, string> = {
  completed: "bg-emerald-400/80",
  running: "bg-amber-400/80 animate-pulse",
  failed: "bg-rose-400/80",
  matched: "bg-white/30",
}

function ExecutionRow({ execution }: { execution: TriggerExecution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className={`size-1.5 shrink-0 rounded-full ${statusDot[execution.status] ?? statusDot.matched}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white/80">
            {execution.eventType ? formatEventType(execution.eventType) : "Unknown event"}
            {execution.repositoryId && <span className="ml-1.5 text-white/30">#{execution.repositoryId}</span>}
          </p>
          <p className="text-[11px] text-white/30">
            Matched {timeAgo(execution.matchedAt)}
            {execution.receivedAt && <> · received {timeAgo(execution.receivedAt)}</>}
            {execution.status !== "matched" && (
              <>
                {" "}
                ·{" "}
                <span className={execution.status === "failed" ? "text-rose-300/60" : "text-white/30"}>
                  {execution.status}
                </span>
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-white/20">{expanded ? "collapse" : "expand"}</span>
      </button>
      {expanded && (
        <div className="border-t border-white/5 bg-white/[0.015] px-4 py-3 space-y-3">
          {execution.resultMessage && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-white/35">Agent response</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-white/8 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/55">
                {execution.resultMessage}
              </pre>
            </div>
          )}
          {execution.payload && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-white/35">Webhook payload</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-white/8 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/55">
                {JSON.stringify(execution.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TriggerDetailPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const triggerId = pathname.split("/").filter(Boolean).at(1) ?? ""

  const [data, setData] = useState<TriggerDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [availableEvents, setAvailableEvents] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<ChannelState[]>([])
  const [eventsSource, setEventsSource] = useState<string>("static_fallback")
  const [page, setPage] = useState(0)

  function reload() {
    setLoading(true)
    getTriggerExecutions(triggerId)
      .then((result) => {
        setData(result)
        syncNavbar(result.trigger.name, result.trigger.enabled)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to reload trigger.")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  function openEditSheet() {
    getGitHubAvailableEvents()
      .then((r: AvailableEventsResponse) => {
        setAvailableEvents(r.events)
        setEventsSource(r.source)
      })
      .catch(() => {})
    getChannels()
      .then((channels) => setAvailableChannels(channels))
      .catch(() => {})
    setSheetOpen(true)
  }

  useEffect(() => {
    if (!triggerId) return

    let cancelled = false

    async function load() {
      try {
        const result = await getTriggerExecutions(triggerId)
        if (!cancelled) {
          setData(result)
          syncNavbar(result.trigger.name, result.trigger.enabled)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trigger.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      clearNavbar()
    }
  }, [triggerId])

  useEffect(() => {
    function handleEdit() {
      openEditSheet()
    }
    function handleDelete() {
      deleteTrigger(triggerId)
        .then(() => navigate({ to: "/triggers" }))
        .catch(() => {})
    }
    window.addEventListener("argus:edit-trigger", handleEdit)
    window.addEventListener("argus:delete-trigger", handleDelete)
    return () => {
      window.removeEventListener("argus:edit-trigger", handleEdit)
      window.removeEventListener("argus:delete-trigger", handleDelete)
    }
  }, [triggerId, navigate])

  if (loading) {
    return (
      <section className="px-5 py-5 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading trigger...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="px-5 py-5 md:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[13px] text-rose-200/85">{error ?? "Trigger not found."}</p>
        </div>
      </section>
    )
  }

  const { trigger, executions } = data

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(executions.length / PAGE_SIZE))
  const pagedExecutions = executions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="overflow-hidden rounded-lg border border-white/8">
          <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
            <Badge size="sm">{trigger.provider}</Badge>
            <Badge variant="violet" size="sm">
              {formatEventType(trigger.eventType)}
            </Badge>
          </div>

          {trigger.conditions.length > 0 && (
            <div className="border-b border-white/6 px-4 py-3">
              <p className="mb-1.5 text-[12px] font-medium text-white/40">Conditions</p>
              <div className="space-y-1">
                {trigger.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-1.5"
                  >
                    <code className="text-[11px] text-white/65">{condition.field}</code>
                    <span className="text-[11px] text-white/30">{condition.operator.replaceAll("_", " ")}</span>
                    <code className="text-[11px] text-white/65">{condition.value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trigger.actionPrompt && (
            <div className="px-4 py-3">
              <p className="mb-1.5 text-[12px] font-medium text-white/40">Action prompt</p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/60">{trigger.actionPrompt}</p>
            </div>
          )}

          {trigger.channelTargets.length > 0 && (
            <div className="border-t border-white/6 px-4 py-3">
              <p className="mb-1.5 text-[12px] font-medium text-white/40">Delivery channels</p>
              <div className="flex flex-wrap gap-1.5">
                {trigger.channelTargets.map((target) => (
                  <Badge key={target} size="sm">
                    {target}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {!trigger.conditions.length && !trigger.actionPrompt && trigger.channelTargets.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-white/30">No conditions or action prompt configured.</div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-white/8">
          <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-white/80">Execution history</p>
              <p className="text-[12px] text-white/40">
                {executions.length > 0
                  ? `${executions.length} recent execution${executions.length !== 1 ? "s" : ""}`
                  : "This trigger has not fired yet."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={reload}
              className="border-white/10 bg-transparent text-[11px] font-normal text-white/40 hover:bg-white/[0.03] hover:text-white/70"
            >
              Refresh
            </Button>
          </div>

          {executions.length > 0 ? (
            <>
              <div className="divide-y divide-white/5">
                {pagedExecutions.map((execution) => (
                  <ExecutionRow key={execution.id} execution={execution} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/6 px-4 py-2.5">
                  <span className="text-[11px] tabular-nums text-white/30">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, executions.length)} of {executions.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="h-6 px-2 text-[11px] font-normal text-white/40 hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-30"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="h-6 px-2 text-[11px] font-normal text-white/40 hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-30"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-white/30">
              Waiting for matching webhook events...
            </div>
          )}
        </div>

        {data && (
          <TriggerSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            editingTrigger={
              {
                ...trigger,
                actionPrompt: trigger.actionPrompt ?? null,
                executionCount: executions.length,
                lastFiredAt: executions[0]?.matchedAt ?? null,
                createdAt: "",
                updatedAt: "",
              } satisfies Trigger
            }
            availableEvents={availableEvents}
            availableChannels={availableChannels}
            eventsSource={eventsSource}
            onSaved={reload}
          />
        )}
      </div>
    </section>
  )
}

export default TriggerDetailPage

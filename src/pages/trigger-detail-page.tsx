import { useEffect, useState } from "react"
import { useRouterState } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { getTriggerExecutions, type TriggerDetailResponse, type TriggerExecution } from "@/lib/relay-api"

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

function ExecutionRow({ execution }: { execution: TriggerExecution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="size-1.5 shrink-0 rounded-full bg-emerald-400/80" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white/80">
            {execution.eventType ? formatEventType(execution.eventType) : "Unknown event"}
            {execution.repositoryId && <span className="ml-1.5 text-white/35">#{execution.repositoryId}</span>}
          </p>
          <p className="text-[11px] text-white/35">
            Matched {timeAgo(execution.matchedAt)}
            {execution.receivedAt && <> · received {timeAgo(execution.receivedAt)}</>}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-white/25">{expanded ? "collapse" : "expand"}</span>
      </button>
      {expanded && execution.payload && (
        <div className="border-t border-white/5 bg-white/[0.015] px-3 py-3">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/60">
            {JSON.stringify(execution.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function TriggerDetailPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const triggerId = pathname.split("/").filter(Boolean).at(1) ?? ""

  const [data, setData] = useState<TriggerDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!triggerId) return

    let cancelled = false

    async function load() {
      try {
        const result = await getTriggerExecutions(triggerId)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trigger.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [triggerId])

  if (loading) {
    return (
      <section className="px-5 py-5 md:px-6">
        <div className="mx-auto max-w-3xl py-16 text-center text-[13px] text-white/45">Loading trigger...</div>
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

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-[13px] font-semibold text-white">{trigger.name}</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">
                  {trigger.provider}
                </span>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-0.5 text-[10px] text-violet-200">
                  {formatEventType(trigger.eventType)}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] tracking-[0.02em] ${
                trigger.enabled
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-white/55"
              }`}
            >
              {trigger.enabled ? "enabled" : "disabled"}
            </span>
          </div>

          {trigger.conditions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">Conditions</p>
              <div className="space-y-1">
                {trigger.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-3 py-1.5"
                  >
                    <code className="text-[11px] text-white/70">{condition.field}</code>
                    <span className="text-[11px] text-white/35">{condition.operator.replaceAll("_", " ")}</span>
                    <code className="text-[11px] text-white/70">{condition.value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trigger.actionPrompt && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">Action prompt</p>
              <p className="whitespace-pre-wrap rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/65">
                {trigger.actionPrompt}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-[13px] font-semibold text-white">Execution history</h2>
              <p className="text-[13px] text-white/45">
                {executions.length > 0
                  ? `${executions.length} recent execution${executions.length !== 1 ? "s" : ""}`
                  : "This trigger has not fired yet."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true)
                void getTriggerExecutions(triggerId).then((result) => {
                  setData(result)
                  setLoading(false)
                })
              }}
              className="h-7 border-white/10 bg-transparent px-2.5 text-[11px] font-normal text-white/40 hover:bg-white/[0.03] hover:text-white/70"
            >
              Refresh
            </Button>
          </div>

          {executions.length > 0 ? (
            <div className="divide-y divide-white/5 rounded-lg border border-white/8">
              {executions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center text-[13px] text-white/35">
              Waiting for matching webhook events...
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default TriggerDetailPage

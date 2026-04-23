import { useEffect, useState } from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JsonView, tryParseJson } from "@/components/ui/json-view"
import { ScheduleSheet } from "@/components/schedule-sheet"
import {
  deleteSchedule,
  getScheduleExecutions,
  type Schedule,
  type ScheduleDetailResponse,
  type ScheduleExecution,
} from "@/lib/relay-api"
import { duration, humanCron, relativeTime, timeAgo } from "@/lib/schedule-utils"

function syncNavbar(name: string, enabled: boolean) {
  const nameEl = document.getElementById("schedule-detail-name")
  if (nameEl) nameEl.textContent = name

  const statusEl = document.getElementById("schedule-detail-status")
  if (statusEl) {
    statusEl.textContent = enabled ? "Enabled" : "Disabled"
    statusEl.className = `ml-1 ${badgeVariants({ size: "sm", variant: enabled ? "success" : "neutral" })}`
  }
}

function clearNavbar() {
  const nameEl = document.getElementById("schedule-detail-name")
  if (nameEl) nameEl.textContent = "Detail"
  const statusEl = document.getElementById("schedule-detail-status")
  if (statusEl) statusEl.className = "ml-1 hidden"
}

function ExecutionRow({ execution }: { execution: ScheduleExecution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/30"
      >
        <div
          className={`size-1.5 shrink-0 rounded-full ${
            execution.status === "completed"
              ? "bg-emerald-400/80"
              : execution.status === "running"
                ? "bg-amber-400/80 animate-pulse"
                : "bg-rose-400/80"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-white/80">
            {execution.status === "completed" ? "Executed" : execution.status === "running" ? "Running" : "Failed"}
            {!expanded && execution.resultMessage && (
              <span className="ml-1.5 text-white/30">{execution.resultMessage.slice(0, 80)}</span>
            )}
          </p>
          <p className="text-[11px] text-white/30">
            {timeAgo(execution.startedAt)}
            {execution.finishedAt && execution.finishedAt !== execution.startedAt && (
              <> · {duration(execution.startedAt, execution.finishedAt)}</>
            )}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-white/20">{expanded ? "collapse" : "expand"}</span>
      </button>
      {expanded && execution.resultMessage && (
        <div className="border-t border-white/5 bg-white/[0.015] px-4 py-3">
          <p className="mb-1.5 text-[11px] font-medium text-white/35">Agent response</p>
          <JsonView
            value={tryParseJson(execution.resultMessage) ?? execution.resultMessage}
            maxHeightClassName="max-h-64"
            preClassName="rounded-md border border-white/8"
          />
        </div>
      )}
    </div>
  )
}

function ScheduleDetailPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const scheduleId = pathname.split("/").filter(Boolean).at(1) ?? ""

  const [data, setData] = useState<ScheduleDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)

  function reload() {
    setLoading(true)
    getScheduleExecutions(scheduleId)
      .then((result) => {
        setData(result)
        setError(null)
        syncNavbar(result.schedule.name, result.schedule.enabled)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to reload schedule.")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!scheduleId) return

    let cancelled = false

    async function load() {
      try {
        const result = await getScheduleExecutions(scheduleId)
        if (!cancelled) {
          setData(result)
          syncNavbar(result.schedule.name, result.schedule.enabled)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load schedule.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      clearNavbar()
    }
  }, [scheduleId])

  useEffect(() => {
    function handleEdit() {
      setSheetOpen(true)
    }
    function handleDelete() {
      deleteSchedule(scheduleId)
        .then(() => navigate({ to: "/schedules" }))
        .catch(() => {})
    }
    window.addEventListener("argus:edit-schedule", handleEdit)
    window.addEventListener("argus:delete-schedule", handleDelete)
    return () => {
      window.removeEventListener("argus:edit-schedule", handleEdit)
      window.removeEventListener("argus:delete-schedule", handleDelete)
    }
  }, [scheduleId, navigate])

  if (loading) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading schedule...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[13px] text-rose-200/85">{error ?? "Schedule not found."}</p>
        </div>
      </section>
    )
  }

  const { schedule, executions } = data

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
          <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
            <Badge variant="violet" size="sm">
              {humanCron(schedule.cronExpression)}
            </Badge>
            <Badge size="sm">{schedule.timezone}</Badge>
            {schedule.nextRunAt && schedule.enabled && (
              <span className="text-[10px] text-white/30">Next: {relativeTime(schedule.nextRunAt)}</span>
            )}
          </div>

          {schedule.description && (
            <div className="border-b border-white/6 px-4 py-3">
              <p className="mb-1.5 text-[12px] font-medium text-white/40">Description</p>
              <p className="text-[13px] leading-relaxed text-white/60">{schedule.description}</p>
            </div>
          )}

          <div className="px-4 py-3">
            <p className="mb-1.5 text-[12px] font-medium text-white/40">Prompt</p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/60">{schedule.prompt}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
          <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-white/80">Execution history</p>
              <p className="text-[12px] text-white/40">
                {executions.length > 0
                  ? `${executions.length} recent execution${executions.length !== 1 ? "s" : ""}`
                  : "This schedule has not run yet."}
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
            <div className="divide-y divide-white/5">
              {executions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-white/30">Waiting for the next scheduled run...</div>
          )}
        </div>

        {data && (
          <ScheduleSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            editingSchedule={
              {
                ...schedule,
                executionCount: executions.length,
                createdAt: "",
                updatedAt: "",
              } satisfies Schedule
            }
            onSaved={reload}
          />
        )}
      </div>
    </section>
  )
}

export default ScheduleDetailPage

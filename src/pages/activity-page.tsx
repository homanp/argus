import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight02Icon, Loading03Icon, Task01Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import {
  ActivityRowItem,
  groupRowsByStatus,
  KindBadge,
  rowIdentifier,
  rowStatus,
  StatusIcon,
  type ActivityRow,
} from "@/components/activity-row"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getMissions, getRecentSessions } from "@/lib/relay-api"
import type { MissionSummary, RecentSession } from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { duration } from "@/lib/schedule-utils"

const SESSION_LIMIT = 200

// ── Page ──────────────────────────────────────────────────────────────────
//
// Merges agent sessions and missions into a single Linear-style list. Rows
// are bucketed by status (live work first, closed states below); clicking a
// row opens a right-side detail sheet without leaving the page. A footer
// link inside the sheet navigates to the full detail page.

function ActivityPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<RecentSession[] | null>(null)
  const [missions, setMissions] = useState<MissionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ActivityRow | null>(null)

  const refreshSessions = useCallback(() => {
    getRecentSessions({ limit: SESSION_LIMIT })
      .then((data) => {
        setSessions(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sessions."))
  }, [])

  const refreshMissions = useCallback(() => {
    getMissions()
      .then((data) => setMissions(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load missions."))
  }, [])

  useEffect(() => {
    refreshSessions()
    refreshMissions()
  }, [refreshSessions, refreshMissions])

  useRelayEvent("triggers", refreshSessions)
  useRelayEvent("schedules", refreshSessions)
  useRelayEvent("missions", refreshSessions)
  useRelayEvent("missions", refreshMissions)

  const allRows = useMemo<ActivityRow[]>(() => {
    const sessionRows: ActivityRow[] = (sessions ?? []).map((session) => ({
      kind: "session",
      id: `session-${session.id}`,
      at: session.startedAt,
      data: session,
    }))
    const missionRows: ActivityRow[] = (missions ?? []).map((mission) => ({
      kind: "mission",
      id: `mission-${mission.id}`,
      at: mission.createdAt,
      data: mission,
    }))
    return [...sessionRows, ...missionRows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [sessions, missions])

  const grouped = useMemo(() => groupRowsByStatus(allRows), [allRows])

  function openDetailPage(row: ActivityRow) {
    setSelected(null)
    if (row.kind === "mission") {
      navigate({ to: "/missions/$missionId", params: { missionId: row.data.id } })
      return
    }
    const { type, sourceId } = row.data
    if (type === "trigger") navigate({ to: "/triggers/$triggerId", params: { triggerId: sourceId } })
    else if (type === "schedule") navigate({ to: "/schedules/$scheduleId", params: { scheduleId: sourceId } })
    else navigate({ to: "/missions/$missionId", params: { missionId: sourceId } })
  }

  const loading = sessions === null || missions === null

  if (loading && !error) {
    return (
      <section className="px-6 pt-1 pb-5 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 py-16 text-[13px] text-white/45">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading activity...
        </div>
      </section>
    )
  }

  return (
    <section className="px-6 pt-1 pb-5 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        {allRows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-16">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
              <HugeIcon icon={Task01Icon} size={22} />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[13px] font-medium text-white/70">No activity yet</p>
              <p className="text-[13px] text-white/40">
                Trigger runs, schedule executions, and missions will appear here as they happen.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {grouped.map((group) => (
              <Fragment key={group.id}>
                {group.rows.map((row) => (
                  <ActivityRowItem key={row.id} row={row} onSelect={() => setSelected(row)} />
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <DetailSheet row={selected} onOpenChange={(open) => !open && setSelected(null)} onOpenDetail={openDetailPage} />
    </section>
  )
}

// ── Detail side panel ─────────────────────────────────────────────────────

function DetailSheet({
  row,
  onOpenChange,
  onOpenDetail,
}: {
  row: ActivityRow | null
  onOpenChange: (open: boolean) => void
  onOpenDetail: (row: ActivityRow) => void
}) {
  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full !max-w-lg flex-col gap-0 border-l border-white/10 bg-[#0f0f13] p-0 text-white"
      >
        {row && (
          <>
            <SheetHeader className="border-b border-white/8 p-5 pb-4">
              <div className="flex items-center gap-2">
                <StatusIcon status={rowStatus(row)} />
                <span className="font-mono text-[11px] tabular-nums text-white/35">{rowIdentifier(row)}</span>
                <KindBadge row={row} />
              </div>
              <SheetTitle className="text-[13px] font-medium text-white/90">
                {row.kind === "session" ? row.data.name : row.data.title}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5">
              {row.kind === "session" ? <SessionDetail row={row.data} /> : <MissionDetail row={row.data} />}
            </div>

            <div className="border-t border-white/8 p-4">
              <Button
                onClick={() => onOpenDetail(row)}
                variant="outline"
                className="w-full justify-center gap-1.5 border-white/10 bg-transparent text-[12px] font-normal text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                Open full detail
                <HugeIcon icon={ArrowRight02Icon} size={12} />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[12px] text-white/40">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[12px] text-white/75">{children}</span>
    </div>
  )
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ")
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function SessionDetail({ row }: { row: RecentSession }) {
  const dur = row.finishedAt ? duration(row.startedAt, row.finishedAt) : row.status === "running" ? "running…" : "—"
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <MetaRow label="Status">
          <span className="capitalize">{formatStatus(row.status)}</span>
        </MetaRow>
        <MetaRow label="Started">{formatTimestamp(row.startedAt)}</MetaRow>
        <MetaRow label="Finished">{formatTimestamp(row.finishedAt)}</MetaRow>
        <MetaRow label="Duration">{dur}</MetaRow>
        <MetaRow label="Kind">
          <span className="capitalize">{row.type}</span>
        </MetaRow>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium tracking-[0.02em] text-white/40">Result</p>
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          {row.resultMessage ? (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/75">{row.resultMessage}</p>
          ) : (
            <p className="text-[12px] text-white/35">
              {row.status === "running" ? "Agent still working…" : "No output was recorded."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MissionDetail({ row }: { row: MissionSummary }) {
  const analysisPreview =
    row.analysisMarkdown.length > 600 ? `${row.analysisMarkdown.slice(0, 600).trim()}…` : row.analysisMarkdown

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <MetaRow label="Status">
          <span className="capitalize">{formatStatus(row.status)}</span>
        </MetaRow>
        <MetaRow label="Source">
          <span className="capitalize">{row.sourceProvider}</span>
          <span className="mx-1 text-white/25">·</span>
          <span className="text-white/55">{row.sourceEventType}</span>
        </MetaRow>
        {row.confidenceLabel && <MetaRow label="Confidence">{row.confidenceLabel}</MetaRow>}
        {row.priority && (
          <MetaRow label="Priority">
            <span className="capitalize">{row.priority}</span>
            {row.urgent && <span className="ml-1.5 text-amber-300/80">urgent</span>}
          </MetaRow>
        )}
        <MetaRow label="Created">{formatTimestamp(row.createdAt)}</MetaRow>
        {row.decidedAt && <MetaRow label="Decided">{formatTimestamp(row.decidedAt)}</MetaRow>}
      </div>

      {row.recommendation && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium tracking-[0.02em] text-white/40">Recommendation</p>
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[12px] leading-relaxed text-white/75">{row.recommendation}</p>
          </div>
        </div>
      )}

      {analysisPreview && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium tracking-[0.02em] text-white/40">Analysis</p>
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/70">{analysisPreview}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityPage

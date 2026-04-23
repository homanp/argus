import { ActivitySparkIcon, Calendar03Icon, ZapIcon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import type { MissionSummary, RecentSession } from "@/lib/relay-api"
import { timeAgo } from "@/lib/schedule-utils"

// ── Shared row model ──────────────────────────────────────────────────────
//
// Both the Activity feed and the Missions home page render the same row
// shape. The Activity feed mixes agent sessions and missions; the Missions
// page restricts itself to mission rows. Keeping the union here lets both
// call sites share the StatusIcon, identifier, and row chrome.

type ActivityRow =
  | { kind: "session"; id: string; at: string; data: RecentSession }
  | { kind: "mission"; id: string; at: string; data: MissionSummary }

type StatusId = "running" | "awaiting" | "matched" | "completed" | "failed" | "dismissed"

function rowStatus(row: ActivityRow): StatusId {
  if (row.kind === "mission") {
    switch (row.data.status) {
      case "awaiting_decision":
        return "awaiting"
      case "decided":
        return "completed"
      case "dismissed":
        return "dismissed"
      default:
        return "awaiting"
    }
  }
  switch (row.data.status) {
    case "running":
      return "running"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "matched":
      return "matched"
    default:
      return "completed"
  }
}

function rowIdentifier(row: ActivityRow): string {
  if (row.kind === "mission") {
    return `MIS-${row.data.id.slice(0, 6)}`
  }
  // session.id is `${type}-${numericId}` from the relay. Extract the number
  // so we can prefix it with a short domain label.
  const parts = row.data.id.split("-")
  const num = parts[parts.length - 1] ?? "?"
  if (row.data.type === "trigger") return `TRG-${num}`
  if (row.data.type === "schedule") return `SCH-${num}`
  return `RUN-${num}`
}

// Groups rendered top-to-bottom in this fixed order. Anything "live" sits at
// the top so the user sees in-flight work first; closed states go below.
const GROUP_ORDER: StatusId[] = ["running", "awaiting", "matched", "completed", "failed", "dismissed"]

function groupRowsByStatus(rows: ActivityRow[]): Array<{ id: StatusId; rows: ActivityRow[] }> {
  const map = new Map<StatusId, ActivityRow[]>()
  for (const row of rows) {
    const key = rowStatus(row)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return GROUP_ORDER.flatMap((id) => {
    const list = map.get(id)
    return list && list.length > 0 ? [{ id, rows: list }] : []
  })
}

// ── Visual status icon (Linear-style circle) ──────────────────────────────

function StatusIcon({ status }: { status: StatusId }) {
  // Custom SVGs so the glyphs match Linear's status-circle aesthetic
  // (filled-green check, amber progress-pie, red X, hollow grey). Hugeicons'
  // stroke style reads too light at this size.
  if (status === "completed") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="#34d399" />
        <path
          d="M4 7l2 2 4-4"
          stroke="#052e18"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    )
  }
  if (status === "running") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-hidden
        className="animate-spin"
        style={{ animationDuration: "2s" }}
      >
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.3" />
        <path d="M7 1.5 a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === "awaiting" || status === "matched") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="2.25" fill="#fbbf24" />
      </svg>
    )
  }
  if (status === "failed") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="#f87171" />
        <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#3f0a0a" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  // dismissed — hollow grey
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
    </svg>
  )
}

// ── Kind badge (right-aligned pill) ───────────────────────────────────────

function KindBadge({ row }: { row: ActivityRow }) {
  if (row.kind === "mission") {
    return (
      <Badge size="sm" variant="violet" className="gap-1">
        <HugeIcon icon={ActivitySparkIcon} size={10} />
        Mission
      </Badge>
    )
  }
  const t = row.data.type
  if (t === "trigger") {
    return (
      <Badge size="sm" className="gap-1">
        <HugeIcon icon={ZapIcon} size={10} />
        Trigger
      </Badge>
    )
  }
  if (t === "schedule") {
    return (
      <Badge size="sm" className="gap-1">
        <HugeIcon icon={Calendar03Icon} size={10} />
        Schedule
      </Badge>
    )
  }
  return (
    <Badge size="sm" className="gap-1">
      <HugeIcon icon={ActivitySparkIcon} size={10} />
      Mission run
    </Badge>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────

function ActivityRowItem({ row, onSelect }: { row: ActivityRow; onSelect: () => void }) {
  const status = rowStatus(row)
  const identifier = rowIdentifier(row)
  const title = row.kind === "session" ? row.data.name : row.data.title

  return (
    <button type="button" onClick={onSelect} className="group relative flex w-full items-center text-left">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 inset-y-1 rounded-md transition-colors group-hover:bg-white/[0.04] md:inset-x-8"
      />
      <span className="relative flex w-full items-center gap-3 px-8 py-2 md:px-10">
        <StatusIcon status={status} />
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-white/35">
          {identifier}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          <KindBadge row={row} />
          <span className="w-14 text-right text-[11px] tabular-nums text-white/30">{timeAgo(row.at)}</span>
        </span>
      </span>
    </button>
  )
}

export { ActivityRowItem, groupRowsByStatus, KindBadge, rowIdentifier, rowStatus, StatusIcon }
export type { ActivityRow, StatusId }

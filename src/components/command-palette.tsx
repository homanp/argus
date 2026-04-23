import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Calendar03Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { ProviderGlyph } from "@/components/provider-glyph"
import { missionStatusToStatusId, sessionStatusToStatusId, StatusIcon } from "@/components/activity-row"
import { channelCatalog } from "@/lib/channel-catalog"
import { integrationCatalog } from "@/lib/integration-catalog"
import {
  getChannels,
  getMissions,
  getRecentSessions,
  getSchedules,
  getTriggers,
  type ChannelState,
  type MissionSummary,
  type RecentSession,
  type Schedule,
  type Trigger,
} from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { timeAgo } from "@/lib/schedule-utils"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────

type GroupId = "Recent" | "Missions" | "Activity" | "Triggers" | "Schedules" | "Connectors" | "Channels"

type PaletteResult = {
  id: string
  group: GroupId
  identifier: string
  title: string
  subtitle: string | null
  meta: string | null
  icon: React.ReactNode
  haystack: string
  onSelect: () => void
}

const GROUP_ORDER: GroupId[] = ["Recent", "Missions", "Activity", "Triggers", "Schedules", "Connectors", "Channels"]

// ── Palette ───────────────────────────────────────────────────────────────

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [channels, setChannels] = useState<ChannelState[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const reloadAll = useCallback(() => {
    void Promise.allSettled([
      getMissions(),
      getRecentSessions({ limit: 50 }),
      getTriggers(),
      getSchedules(),
      getChannels(),
    ]).then((results) => {
      if (results[0].status === "fulfilled") setMissions(results[0].value)
      if (results[1].status === "fulfilled") setSessions(results[1].value)
      if (results[2].status === "fulfilled") setTriggers(results[2].value)
      if (results[3].status === "fulfilled") setSchedules(results[3].value)
      if (results[4].status === "fulfilled") setChannels(results[4].value)
      setLoaded(true)
    })
  }, [])

  // Lazy-load the first time the palette opens; subsequent opens use cached
  // data with SSE keeping it fresh in the background.
  useEffect(() => {
    if (open && !loaded) reloadAll()
  }, [open, loaded, reloadAll])

  // Reset query + selection whenever the dialog closes. Wrapping
  // `onOpenChange` (instead of reacting in an effect) avoids the
  // `react-hooks/set-state-in-effect` cascade-render pattern. All close
  // paths — Esc, backdrop click, selecting a result via `go` — flow
  // through here so there's a single source of truth for "on close".
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("")
        setActiveIndex(0)
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const go = useCallback(
    (fn: () => void) => {
      handleOpenChange(false)
      // Defer navigation until after the dialog close animation starts so
      // base-ui's focus management doesn't fight the route transition.
      setTimeout(fn, 0)
    },
    [handleOpenChange],
  )

  const handleRelayRefresh = useCallback(() => {
    if (loaded) reloadAll()
  }, [loaded, reloadAll])
  useRelayEvent("missions", handleRelayRefresh)
  useRelayEvent("triggers", handleRelayRefresh)
  useRelayEvent("schedules", handleRelayRefresh)
  useRelayEvent("channels", handleRelayRefresh)

  // ── Build the flat result list. When the query is empty we show a
  // lightweight "Recent" bucket (missions + sessions interleaved by time)
  // since the rest of the groups don't have a meaningful "recent" concept.

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase()

    const missionsResults: PaletteResult[] = missions.map((m) => ({
      id: `mission-${m.id}`,
      group: "Missions",
      identifier: `MIS-${m.id.slice(0, 6)}`,
      title: m.title,
      subtitle: m.recommendation || null,
      meta: timeAgo(m.createdAt),
      icon: <StatusIcon status={missionStatusToStatusId(m.status)} />,
      haystack: [m.title, m.recommendation, m.sourceProvider, m.sourceEventType, `MIS-${m.id.slice(0, 6)}`]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      onSelect: () => go(() => navigate({ to: "/missions/$missionId", params: { missionId: m.id } })),
    }))

    const sessionsResults: PaletteResult[] = sessions.map((s) => {
      const num = s.id.split("-").at(-1) ?? "?"
      const identifier = s.type === "trigger" ? `TRG-${num}` : s.type === "schedule" ? `SCH-${num}` : `RUN-${num}`
      const target =
        s.type === "trigger"
          ? () => navigate({ to: "/triggers/$triggerId", params: { triggerId: s.sourceId } })
          : s.type === "schedule"
            ? () => navigate({ to: "/schedules/$scheduleId", params: { scheduleId: s.sourceId } })
            : () => navigate({ to: "/missions/$missionId", params: { missionId: s.sourceId } })
      return {
        id: `session-${s.id}`,
        group: "Activity",
        identifier,
        title: s.name,
        subtitle: s.resultMessage,
        meta: timeAgo(s.startedAt),
        icon: <StatusIcon status={sessionStatusToStatusId(s.status)} />,
        haystack: [s.name, s.resultMessage, s.type, s.status, identifier].filter(Boolean).join(" ").toLowerCase(),
        onSelect: () => go(target),
      }
    })

    const triggersResults: PaletteResult[] = triggers.map((t, i) => ({
      id: `trigger-${t.id}`,
      group: "Triggers",
      identifier: `TRG-${i + 1}`,
      title: t.name,
      subtitle: `${t.provider} · ${t.eventType.replaceAll("_", " ")}`,
      meta: t.enabled ? "enabled" : "disabled",
      icon: <ProviderGlyph provider={t.provider} size={14} iconClassName="text-white/60" />,
      haystack: [t.name, t.provider, t.eventType, t.actionPrompt ?? ""].join(" ").toLowerCase(),
      onSelect: () => go(() => navigate({ to: "/triggers/$triggerId", params: { triggerId: t.id } })),
    }))

    const schedulesResults: PaletteResult[] = schedules.map((s, i) => ({
      id: `schedule-${s.id}`,
      group: "Schedules",
      identifier: `SCH-${i + 1}`,
      title: s.name,
      subtitle: s.description || s.cronExpression,
      meta: s.enabled ? "enabled" : "disabled",
      icon: <HugeIcon icon={Calendar03Icon} size={14} className="text-white/60" />,
      haystack: [s.name, s.description ?? "", s.cronExpression, s.prompt].join(" ").toLowerCase(),
      onSelect: () => go(() => navigate({ to: "/schedules/$scheduleId", params: { scheduleId: s.id } })),
    }))

    const connectorsResults: PaletteResult[] = integrationCatalog
      .filter((item) => item.available)
      .map((item) => ({
        id: `connector-${item.provider}`,
        group: "Connectors",
        identifier: item.provider,
        title: item.title,
        subtitle: item.domain,
        meta: null,
        icon: <ProviderGlyph provider={item.provider} size={14} iconClassName="text-white/60" />,
        haystack: [item.title, item.provider, item.domain, item.description].join(" ").toLowerCase(),
        onSelect: () => go(() => navigate({ to: "/connectors/$provider", params: { provider: item.provider } })),
      }))

    const channelsResults: PaletteResult[] = channelCatalog.map((item) => {
      const state = channels.find((c) => c.provider === item.provider)
      return {
        id: `channel-${item.provider}`,
        group: "Channels" as const,
        identifier: item.provider,
        title: item.title,
        subtitle: state?.status ?? item.description,
        meta: null,
        icon: <ProviderGlyph provider={item.provider} size={14} iconClassName="text-white/60" />,
        haystack: [item.title, item.provider, item.description, state?.status ?? ""].join(" ").toLowerCase(),
        onSelect: () => go(() => navigate({ to: "/channels/$provider", params: { provider: item.provider } })),
      }
    })

    if (!q) {
      // Recent = most recent missions + sessions merged by timestamp, capped.
      const recent: PaletteResult[] = [...missionsResults, ...sessionsResults]
        .map((r) => ({
          r,
          ts:
            r.group === "Missions"
              ? new Date(missions.find((m) => `mission-${m.id}` === r.id)?.createdAt ?? 0).getTime()
              : new Date(sessions.find((s) => `session-${s.id}` === r.id)?.startedAt ?? 0).getTime(),
        }))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 8)
        .map(({ r }) => ({ ...r, group: "Recent" as const }))

      return recent
    }

    return [
      ...missionsResults,
      ...sessionsResults,
      ...triggersResults,
      ...schedulesResults,
      ...connectorsResults,
      ...channelsResults,
    ].filter((r) => r.haystack.includes(q))
  }, [query, missions, sessions, triggers, schedules, channels, navigate, go])

  // Group results preserving GROUP_ORDER.
  const groups = useMemo(() => {
    const map = new Map<GroupId, PaletteResult[]>()
    for (const r of results) {
      const list = map.get(r.group) ?? []
      list.push(r)
      map.set(r.group, list)
    }
    return GROUP_ORDER.flatMap((id) => {
      const rows = map.get(id)
      return rows && rows.length > 0 ? [{ id, rows }] : []
    })
  }, [results])

  // Derive the effective index: clamp to the current result range so we
  // never render an out-of-bounds highlight when the list shrinks. This
  // replaces a useEffect+setState clamp (which would cascade renders).
  const clampedIndex = results.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), results.length - 1)

  // Scroll the active item into view as it changes.
  useLayoutEffect(() => {
    const el = itemRefs.current[clampedIndex]
    if (el) el.scrollIntoView({ block: "nearest" })
  }, [clampedIndex])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(results.length === 0 ? 0 : (clampedIndex + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(results.length === 0 ? 0 : (clampedIndex - 1 + results.length) % results.length)
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(Math.max(0, results.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      results[clampedIndex]?.onSelect()
    }
  }

  // Flat index map for the active-highlight rendering.
  let flatIndex = -1

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed top-[18svh] left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121216]/95 text-white shadow-2xl ring-1 ring-white/5 backdrop-blur-xl transition-all duration-150 data-ending-style:opacity-0 data-starting-style:translate-y-[-8px] data-starting-style:opacity-0"
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search missions, activity, triggers, schedules, connectors, and channels.
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-white/8 px-4">
            <HugeIcon icon={Search01Icon} size={14} className="text-white/45" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search missions, activity, triggers, schedules..."
              spellCheck={false}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
            />
            <kbd className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/45">
              esc
            </kbd>
          </div>

          <div className="max-h-[min(60svh,420px)] overflow-y-auto py-1.5">
            {!loaded ? (
              <p className="px-4 py-8 text-center text-[12px] text-white/35">Loading…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-white/35">
                {query.trim() ? `No results for "${query.trim()}"` : "Nothing to show yet."}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="py-0.5">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-medium tracking-[0.06em] text-white/35 uppercase">
                    {group.id}
                  </p>
                  {group.rows.map((r) => {
                    flatIndex += 1
                    const idx = flatIndex
                    const isActive = idx === clampedIndex
                    return (
                      <button
                        key={r.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el
                        }}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => r.onSelect()}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center">{r.icon}</span>
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-white/35">
                          {r.identifier}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-white/85">{r.title}</span>
                          {r.subtitle && <span className="block truncate text-[11px] text-white/40">{r.subtitle}</span>}
                        </span>
                        {r.meta && <span className="shrink-0 text-[11px] tabular-nums text-white/35">{r.meta}</span>}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/20 px-4 py-2 text-[10.5px] text-white/40">
            <div className="flex items-center gap-3">
              <PaletteHint keys={["↑", "↓"]} label="navigate" />
              <PaletteHint keys={["↵"]} label="open" />
              <PaletteHint keys={["esc"]} label="close" />
            </div>
            <span className="text-white/30">
              {results.length} result{results.length === 1 ? "" : "s"}
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PaletteHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9.5px] text-white/55"
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Wires the global ⌘K / Ctrl+K shortcut to toggle the palette. Typing K inside
 * text fields still triggers — this matches Linear/Vercel/Raycast behavior
 * where the palette takes precedence over native input.
 *
 * Uses a latest-ref so the window listener is installed exactly once per
 * mount, even when the caller passes an inline arrow function that changes
 * identity on every render (e.g. from within a component that re-renders on
 * route changes).
 */
function useCommandPaletteShortcut(onToggle: () => void) {
  const ref = useRef(onToggle)
  useLayoutEffect(() => {
    ref.current = onToggle
  })
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K"
      if (!isK) return
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
}

/**
 * Subscribes to the `argus:open-command-palette` custom event so any component
 * (e.g. the sidebar "Search" item) can request the palette to open without
 * needing to thread the open-state prop.
 *
 * Same latest-ref pattern as `useCommandPaletteShortcut` so callers don't
 * need to memoize the callback to keep the listener stable.
 */
function useCommandPaletteEventOpen(onOpen: () => void) {
  const ref = useRef(onOpen)
  useLayoutEffect(() => {
    ref.current = onOpen
  })
  useEffect(() => {
    function handler() {
      ref.current()
    }
    window.addEventListener("argus:open-command-palette", handler)
    return () => window.removeEventListener("argus:open-command-palette", handler)
  }, [])
}

/**
 * Platform-aware label for the ⌘K / Ctrl K shortcut. Exported so sidebar/other
 * surfaces render the correct hint without duplicating the detection.
 */
function useCommandPaletteShortcutLabel() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return "⌘K"
    const isMac = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
    return isMac ? "⌘K" : "Ctrl K"
  }, [])
}

export { CommandPalette, useCommandPaletteEventOpen, useCommandPaletteShortcut, useCommandPaletteShortcutLabel }

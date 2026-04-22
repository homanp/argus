import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Loading03Icon, MoreHorizontalIcon, ZapIcon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TogglePill } from "@/components/ui/toggle-pill"
import { TriggerSheet } from "@/components/trigger-sheet"
import {
  deleteTrigger,
  getChannels,
  getGitHubAvailableEvents,
  getTriggers,
  updateTrigger,
  type AvailableEventsResponse,
  type ChannelState,
  type Trigger,
} from "@/lib/relay-api"
import { integrationCatalog } from "@/lib/integration-catalog"

function providerCatalogItem(provider: string) {
  return integrationCatalog.find((i) => i.provider === provider)
}

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ")
}

function RowMenu({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
    }
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [open])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right })
    }
    setOpen(!open)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="flex size-6 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-50"
      >
        <HugeIcon icon={MoreHorizontalIcon} size={14} />
      </button>
      {open &&
        createPortal(
          <div
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[100] -translate-x-full min-w-[120px] rounded-lg border border-white/10 bg-[#18181f] py-1 shadow-xl"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onEdit()
              }}
              className="flex w-full items-center px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onDelete()
              }}
              className="flex w-full items-center px-3 py-1.5 text-[12px] text-rose-300/80 transition-colors hover:bg-rose-400/10"
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

function TriggersPage() {
  const navigate = useNavigate()
  const [triggersList, setTriggersList] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
  const [availableEvents, setAvailableEvents] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<ChannelState[]>([])
  const [eventsSource, setEventsSource] = useState<string>("static_fallback")

  const loadTriggers = useCallback(async () => {
    try {
      const data = await getTriggers()
      setTriggersList(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load triggers.")
    } finally {
      setLoading(false)
    }
  }, [])

  function loadEvents() {
    getGitHubAvailableEvents()
      .then((data: AvailableEventsResponse) => {
        setAvailableEvents(data.events)
        setEventsSource(data.source)
      })
      .catch(() => {
        setAvailableEvents([])
      })
  }

  function loadChannels() {
    getChannels()
      .then((data) => setAvailableChannels(data))
      .catch(() => {})
  }

  function openCreateSheet() {
    setEditingTrigger(null)
    loadEvents()
    loadChannels()
    setSheetOpen(true)
  }

  const openCreateSheetRef = useRef(openCreateSheet)
  openCreateSheetRef.current = openCreateSheet

  useEffect(() => {
    void loadTriggers()
    loadChannels()
  }, [loadTriggers])

  useEffect(() => {
    function handleNewTrigger() {
      openCreateSheetRef.current()
    }
    function handleSearch(e: Event) {
      setSearch((e as CustomEvent<string>).detail)
    }
    window.addEventListener("argus:new-trigger", handleNewTrigger)
    window.addEventListener("argus:trigger-search", handleSearch)
    return () => {
      window.removeEventListener("argus:new-trigger", handleNewTrigger)
      window.removeEventListener("argus:trigger-search", handleSearch)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return triggersList
    return triggersList.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.provider.toLowerCase().includes(q) ||
        t.eventType.toLowerCase().includes(q) ||
        (t.actionPrompt ?? "").toLowerCase().includes(q),
    )
  }, [triggersList, search])

  function openEditSheet(trigger: Trigger) {
    setEditingTrigger(trigger)
    void loadEvents()
    loadChannels()
    setSheetOpen(true)
  }

  async function handleToggleEnabled(trigger: Trigger) {
    setBusy(trigger.id)
    try {
      await updateTrigger(trigger.id, { enabled: !trigger.enabled })
      await loadTriggers()
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(trigger: Trigger) {
    setBusy(trigger.id)
    try {
      await deleteTrigger(trigger.id)
      await loadTriggers()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-white/45">
            <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
            Loading triggers...
          </div>
        ) : triggersList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-black/30 px-5 py-16">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
              <HugeIcon icon={ZapIcon} size={22} />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[13px] font-medium text-white/70">No triggers yet</p>
              <p className="text-[13px] text-white/40">
                Create your first trigger to react to incoming webhook events.
              </p>
            </div>
            <Button onClick={openCreateSheet} className="bg-violet-300 text-violet-950 hover:bg-violet-200">
              Create your first trigger
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/8 bg-black/30">
                  <th className="px-3 py-2 text-[11px] font-medium text-white/35">Name</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-white/35">Event</th>
                  <th className="hidden px-3 py-2 text-[11px] font-medium text-white/35 lg:table-cell">Prompt</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-white/35">Fired</th>
                  <th className="w-20 px-3 py-2 text-right text-[11px] font-medium text-white/35" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((trigger) => (
                  <tr
                    key={trigger.id}
                    onClick={() =>
                      navigate({
                        to: "/triggers/$triggerId",
                        params: { triggerId: trigger.id },
                      })
                    }
                    className="cursor-pointer transition-colors hover:bg-black/30"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const catalog = providerCatalogItem(trigger.provider)
                          if (!catalog) return null
                          return catalog.image ? (
                            <img src={catalog.image} alt={catalog.title} className="size-4 shrink-0 opacity-60" />
                          ) : (
                            <HugeIcon icon={catalog.icon} size={14} className="shrink-0 text-white/40" />
                          )
                        })()}
                        <span className="text-[13px] font-medium text-white/80">{trigger.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="violet" size="sm">
                        {formatEventType(trigger.eventType)}
                      </Badge>
                      {trigger.conditions.length > 0 && (
                        <span className="ml-1.5 text-[10px] text-white/25">+{trigger.conditions.length}</span>
                      )}
                    </td>
                    <td className="hidden max-w-[260px] px-3 py-2 lg:table-cell">
                      <div className="flex min-w-0 items-center gap-2">
                        {trigger.actionPrompt ? (
                          <p className="min-w-0 flex-1 truncate text-[12px] text-white/35">{trigger.actionPrompt}</p>
                        ) : (
                          <span className="text-[11px] text-white/15">—</span>
                        )}
                        {trigger.channelTargets.length > 0 && (
                          <div className="flex shrink-0 items-center gap-1">
                            {trigger.channelTargets.map((target) => (
                              <Badge key={target} size="sm">
                                {target}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] tabular-nums text-white/35">
                      {trigger.executionCount > 0 ? (
                        <span>{trigger.executionCount}</span>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <TogglePill
                          active={trigger.enabled}
                          disabled={busy === trigger.id}
                          onClick={() => void handleToggleEnabled(trigger)}
                        />
                        <RowMenu
                          onEdit={() => openEditSheet(trigger)}
                          onDelete={() => void handleDelete(trigger)}
                          disabled={busy === trigger.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[13px] text-white/35">
                      No triggers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <TriggerSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editingTrigger={editingTrigger}
          availableEvents={availableEvents}
          availableChannels={availableChannels}
          eventsSource={eventsSource}
          onSaved={() => void loadTriggers()}
        />
      </div>
    </section>
  )
}

export default TriggersPage

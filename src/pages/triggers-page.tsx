import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Add01Icon, Delete02Icon, Github01Icon, MoreHorizontalIcon, ZapIcon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  createTrigger,
  deleteTrigger,
  getGitHubAvailableEvents,
  getTriggers,
  updateTrigger,
  type AvailableEventsResponse,
  type Trigger,
  type TriggerCondition,
} from "@/lib/relay-api"
import { integrationCatalog } from "@/lib/integration-catalog"
import { cn } from "@/lib/utils"

function providerCatalogItem(provider: string) {
  return integrationCatalog.find((i) => i.provider === provider)
}

const PROVIDER_OPTIONS = [{ value: "github", label: "GitHub", icon: Github01Icon }]
const OPERATOR_OPTIONS: { value: TriggerCondition["operator"]; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
]

function formatEventType(eventType: string) {
  return eventType.replaceAll("_", " ")
}

function TogglePill({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors",
        active ? "border-violet-300/40 bg-violet-300/90" : "border-white/10 bg-white/[0.08]",
        disabled && "opacity-50",
      )}
    >
      <div
        className={cn(
          "size-3.5 rounded-full bg-white transition-transform",
          active ? "translate-x-3.5" : "translate-x-0",
        )}
      />
    </button>
  )
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

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: TriggerCondition
  onChange: (updated: TriggerCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.currentTarget.value })}
        placeholder="field (e.g. action)"
        className="h-8 flex-1 text-[12px]"
      />
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.currentTarget.value as TriggerCondition["operator"] })}
        className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[12px] text-white/70"
      >
        {OPERATOR_OPTIONS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.currentTarget.value })}
        placeholder="value"
        className="h-8 flex-1 text-[12px]"
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
      >
        <HugeIcon icon={Delete02Icon} size={14} />
      </button>
    </div>
  )
}

function TriggerSheet({
  open,
  onOpenChange,
  editingTrigger,
  availableEvents,
  eventsSource,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTrigger: Trigger | null
  availableEvents: string[]
  eventsSource: string
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [provider, setProvider] = useState("github")
  const [eventType, setEventType] = useState("")
  const [conditions, setConditions] = useState<TriggerCondition[]>([])
  const [actionPrompt, setActionPrompt] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingTrigger) {
      setName(editingTrigger.name)
      setProvider(editingTrigger.provider)
      setEventType(editingTrigger.eventType)
      setConditions(editingTrigger.conditions)
      setActionPrompt(editingTrigger.actionPrompt ?? "")
      setEnabled(editingTrigger.enabled)
    } else {
      setName("")
      setProvider("github")
      setEventType("")
      setConditions([])
      setActionPrompt("")
      setEnabled(true)
    }
  }, [editingTrigger, open])

  async function handleSubmit() {
    if (!name.trim() || !eventType) return
    setSaving(true)

    try {
      if (editingTrigger) {
        await updateTrigger(editingTrigger.id, {
          name,
          provider,
          eventType,
          conditions,
          actionPrompt,
          enabled,
        })
      } else {
        await createTrigger({ name, provider, eventType, conditions, actionPrompt, enabled })
      }
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function addCondition() {
    setConditions((prev) => [...prev, { field: "", operator: "equals", value: "" }])
  }

  function updateCondition(index: number, updated: TriggerCondition) {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)))
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-white/8 bg-[#0d0d10] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white">{editingTrigger ? "Edit trigger" : "New trigger"}</SheetTitle>
          <SheetDescription className="text-white/45">
            Define a reactive rule that fires when a matching webhook event arrives.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. PR opened on argus"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.currentTarget.value)}
              className="flex h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[13px] text-white/70"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Event type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.currentTarget.value)}
              className="flex h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[13px] text-white/70"
            >
              <option value="">Select an event...</option>
              {availableEvents.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
            {eventsSource === "static_fallback" && (
              <p className="text-[11px] text-amber-300/70">
                Showing all GitHub event types. Grant{" "}
                <code className="rounded bg-white/6 px-1 text-[10px]">admin:repo_hook</code> scope to auto-detect
                subscribed events.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-white/60">
                Conditions <span className="text-white/30">(optional)</span>
              </label>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
              >
                <HugeIcon icon={Add01Icon} size={12} />
                Add
              </button>
            </div>
            {conditions.length > 0 ? (
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <ConditionRow
                    key={index}
                    condition={condition}
                    onChange={(updated) => updateCondition(index, updated)}
                    onRemove={() => removeCondition(index)}
                  />
                ))}
                <p className="text-[11px] text-white/30">All conditions must match (AND logic).</p>
              </div>
            ) : (
              <p className="text-[12px] text-white/30">No conditions — trigger fires on every matching event.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Action prompt</label>
            <textarea
              value={actionPrompt}
              onChange={(e) => setActionPrompt(e.currentTarget.value)}
              placeholder='Describe what should happen when this trigger fires, e.g. "Draft an apology email and flag the inbox" or "Run tests and auto-merge if clean"'
              rows={3}
              className="flex w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[13px] text-white/70 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-300/40"
            />
            <p className="text-[11px] text-white/30">
              Plain English instruction for the agent. Used when agents are connected.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-white/60">Enabled</label>
            <TogglePill active={enabled} onClick={() => setEnabled(!enabled)} />
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim() || !eventType}
            className="bg-violet-300 text-violet-950 hover:bg-violet-200 disabled:bg-violet-300/60"
          >
            {saving ? "Saving..." : editingTrigger ? "Save changes" : "Create trigger"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

  useEffect(() => {
    void loadTriggers()
  }, [loadTriggers])

  useEffect(() => {
    function handleNewTrigger() {
      openCreateSheet()
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
  })

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

  async function loadEvents() {
    try {
      const data: AvailableEventsResponse = await getGitHubAvailableEvents()
      setAvailableEvents(data.events)
      setEventsSource(data.source)
    } catch {
      setAvailableEvents([])
    }
  }

  function openCreateSheet() {
    setEditingTrigger(null)
    void loadEvents()
    setSheetOpen(true)
  }

  function openEditSheet(trigger: Trigger) {
    setEditingTrigger(trigger)
    void loadEvents()
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
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        {loading ? (
          <div className="py-16 text-center text-[13px] text-white/45">Loading triggers...</div>
        ) : triggersList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-16">
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
          <div className="overflow-hidden rounded-lg border border-white/8">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
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
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
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
                      <span className="inline-block rounded border border-violet-300/20 bg-violet-300/10 px-1.5 py-px text-[10px] text-violet-200">
                        {formatEventType(trigger.eventType)}
                      </span>
                      {trigger.conditions.length > 0 && (
                        <span className="ml-1.5 text-[10px] text-white/25">+{trigger.conditions.length}</span>
                      )}
                    </td>
                    <td className="hidden max-w-[260px] px-3 py-2 lg:table-cell">
                      {trigger.actionPrompt ? (
                        <p className="line-clamp-1 text-[12px] text-white/35">{trigger.actionPrompt}</p>
                      ) : (
                        <span className="text-[11px] text-white/15">—</span>
                      )}
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
          eventsSource={eventsSource}
          onSaved={() => void loadTriggers()}
        />
      </div>
    </section>
  )
}

export default TriggersPage

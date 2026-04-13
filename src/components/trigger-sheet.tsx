import { useEffect, useState } from "react"
import { Add01Icon, Delete02Icon, Github01Icon } from "@hugeicons/core-free-icons"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TogglePill } from "@/components/ui/toggle-pill"
import { createTrigger, updateTrigger, type Trigger, type TriggerCondition } from "@/lib/relay-api"

const PROVIDER_OPTIONS = [{ value: "github", label: "GitHub", icon: Github01Icon }]
const OPERATOR_OPTIONS: { value: TriggerCondition["operator"]; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
]

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
        className="flex-1"
      />
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.currentTarget.value as TriggerCondition["operator"] })}
        className="h-7 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[13px] text-white/70"
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
        className="flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
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
        await updateTrigger(editingTrigger.id, { name, provider, eventType, conditions, actionPrompt, enabled })
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

export { TriggerSheet }

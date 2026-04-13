import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createSchedule, updateSchedule, type Schedule } from "@/lib/relay-api"

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly on Monday", value: "0 9 * * 1" },
  { label: "Monthly on the 1st", value: "0 9 1 * *" },
]

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
]

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

function TogglePill({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors",
        active ? "border-violet-300/40 bg-violet-300/90" : "border-white/10 bg-white/[0.08]",
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

function ScheduleSheet({
  open,
  onOpenChange,
  editingSchedule,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSchedule: Schedule | null
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [prompt, setPrompt] = useState("")
  const [cronExpression, setCronExpression] = useState("0 9 * * *")
  const [customCron, setCustomCron] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [timezone, setTimezone] = useState(getBrowserTimezone())
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cronError, setCronError] = useState<string | null>(null)

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name)
      setDescription(editingSchedule.description ?? "")
      setPrompt(editingSchedule.prompt)
      setTimezone(editingSchedule.timezone)
      setEnabled(editingSchedule.enabled)

      const isPreset = CRON_PRESETS.some((p) => p.value === editingSchedule.cronExpression)
      if (isPreset) {
        setCronExpression(editingSchedule.cronExpression)
        setCustomCron("")
        setUseCustom(false)
      } else {
        setCronExpression("")
        setCustomCron(editingSchedule.cronExpression)
        setUseCustom(true)
      }
    } else {
      setName("")
      setDescription("")
      setPrompt("")
      setCronExpression("0 9 * * *")
      setCustomCron("")
      setUseCustom(false)
      setTimezone(getBrowserTimezone())
      setEnabled(true)
    }
    setCronError(null)
  }, [editingSchedule, open])

  const effectiveCron = useCustom ? customCron.trim() : cronExpression

  function validateCron(expr: string): boolean {
    const parts = expr.trim().split(/\s+/)
    return parts.length === 5
  }

  async function handleSubmit() {
    if (!name.trim() || !prompt.trim() || !effectiveCron) return

    if (!validateCron(effectiveCron)) {
      setCronError("Cron expression must have exactly 5 fields (minute hour day month weekday)")
      return
    }

    setSaving(true)
    setCronError(null)

    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, {
          name,
          description: description || undefined,
          prompt,
          cronExpression: effectiveCron,
          timezone,
          enabled,
        })
      } else {
        await createSchedule({
          name,
          description: description || undefined,
          prompt,
          cronExpression: effectiveCron,
          timezone,
          enabled,
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      if (err instanceof Error && err.message.includes("Invalid cron")) {
        setCronError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const timezoneOptions = COMMON_TIMEZONES.includes(timezone) ? COMMON_TIMEZONES : [timezone, ...COMMON_TIMEZONES]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-white/8 bg-[#0d0d10] sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white">{editingSchedule ? "Edit schedule" : "New schedule"}</SheetTitle>
          <SheetDescription className="text-white/45">
            Define a prompt that runs automatically on a recurring schedule.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Name</label>
            <Input value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g. Daily changelog" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">
              Description <span className="text-white/30">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              placeholder="Brief description of what this schedule does"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={'e.g. "Generate a changelog from yesterday\u2019s merged PRs and post it to #engineering"'}
              rows={3}
              className="flex w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[13px] text-white/70 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-300/40"
            />
            <p className="text-[11px] text-white/30">
              Plain English instruction for the agent. Executed on each scheduled run.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-white/60">Schedule</label>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setCronExpression(preset.value)
                    setUseCustom(false)
                    setCronError(null)
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    !useCustom && cronExpression === preset.value
                      ? "border-violet-300/40 bg-violet-300/15 text-violet-200"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70",
                  )}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setUseCustom(true)
                  setCronExpression("")
                  setCronError(null)
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                  useCustom
                    ? "border-violet-300/40 bg-violet-300/15 text-violet-200"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70",
                )}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <div className="space-y-1.5">
                <Input
                  value={customCron}
                  onChange={(e) => {
                    setCustomCron(e.currentTarget.value)
                    setCronError(null)
                  }}
                  placeholder="e.g. */30 * * * *  (every 30 minutes)"
                  className="font-mono"
                />
                <p className="text-[11px] text-white/30">
                  Standard 5-field cron: minute hour day-of-month month day-of-week
                </p>
              </div>
            )}
            {cronError && <p className="text-[11px] text-rose-300/80">{cronError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.currentTarget.value)}
              className="flex h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[13px] text-white/70"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-white/60">Enabled</label>
            <TogglePill active={enabled} onClick={() => setEnabled(!enabled)} />
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim() || !prompt.trim() || !effectiveCron}
            className="bg-violet-300 text-violet-950 hover:bg-violet-200 disabled:bg-violet-300/60"
          >
            {saving ? "Saving..." : editingSchedule ? "Save changes" : "Create schedule"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { ScheduleSheet }

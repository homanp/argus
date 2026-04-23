import { useCallback, useEffect, useState } from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TogglePill } from "@/components/ui/toggle-pill"
import { cn } from "@/lib/utils"
import { createSchedule, previewSchedule, updateSchedule, type Schedule } from "@/lib/relay-api"
import {
  buildCronExpression,
  DAY_LABELS,
  describeCron,
  FREQUENCY_LABELS,
  pad2,
  parseCronToFields,
  type Frequency,
} from "@/lib/schedule-utils"

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

function formatPreviewDate(iso: string, tz: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    })
  } catch {
    return iso
  }
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

  const [frequency, setFrequency] = useState<Frequency>("daily")
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)

  const [useAdvanced, setUseAdvanced] = useState(false)
  const [customCron, setCustomCron] = useState("")

  const [timezone, setTimezone] = useState(getBrowserTimezone())
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cronError, setCronError] = useState<string | null>(null)
  const [nextRuns, setNextRuns] = useState<string[]>([])

  const effectiveCron = useAdvanced
    ? customCron.trim()
    : buildCronExpression(frequency, hour, minute, dayOfWeek, dayOfMonth)

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name)
      setDescription(editingSchedule.description ?? "")
      setPrompt(editingSchedule.prompt)
      setTimezone(editingSchedule.timezone)
      setEnabled(editingSchedule.enabled)

      const parsed = parseCronToFields(editingSchedule.cronExpression)
      if (parsed) {
        setFrequency(parsed.frequency)
        setHour(parsed.hour)
        setMinute(parsed.minute)
        setDayOfWeek(parsed.dayOfWeek)
        setDayOfMonth(parsed.dayOfMonth)
        setUseAdvanced(false)
        setCustomCron("")
      } else {
        setUseAdvanced(true)
        setCustomCron(editingSchedule.cronExpression)
      }
    } else {
      setName("")
      setDescription("")
      setPrompt("")
      setFrequency("daily")
      setHour(9)
      setMinute(0)
      setDayOfWeek(1)
      setDayOfMonth(1)
      setUseAdvanced(false)
      setCustomCron("")
      setTimezone(getBrowserTimezone())
      setEnabled(true)
    }
    setCronError(null)
    setNextRuns([])
  }, [editingSchedule, open])

  const fetchPreview = useCallback((cron: string, tz: string) => {
    if (!cron) {
      setNextRuns([])
      return
    }
    previewSchedule(cron, tz)
      .then((data) => setNextRuns(data.runs))
      .catch(() => setNextRuns([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchPreview(effectiveCron, timezone), 300)
    return () => clearTimeout(timer)
  }, [effectiveCron, timezone, fetchPreview])

  async function handleSubmit() {
    if (!name.trim() || !prompt.trim() || !effectiveCron) return

    if (useAdvanced) {
      const parts = effectiveCron.split(/\s+/)
      if (parts.length !== 5) {
        setCronError("Cron expression must have exactly 5 fields (minute hour day month weekday)")
        return
      }
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
  const showTime = !useAdvanced && frequency !== "hourly"
  const showDayOfWeek = !useAdvanced && frequency === "weekly"
  const showDayOfMonth = !useAdvanced && frequency === "monthly"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/8 bg-transparent backdrop-blur-xl sm:max-w-md"
      >
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

          <div className="space-y-3">
            <label className="text-[12px] font-medium text-white/60">Schedule</label>

            {!useAdvanced ? (
              <div className="space-y-2.5">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="text-[11px] text-white/35">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}
                      className="flex h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[13px] text-white/70"
                    >
                      {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showTime && (
                    <div className="shrink-0 space-y-1">
                      <label className="text-[11px] text-white/35">At</label>
                      <div className="flex items-center gap-1">
                        <select
                          value={hour}
                          onChange={(e) => setHour(Number(e.currentTarget.value))}
                          className="flex h-7 w-[4.25rem] rounded-md border border-white/10 bg-white/[0.03] px-2 text-[13px] tabular-nums text-white/70"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {pad2(i)}
                            </option>
                          ))}
                        </select>
                        <span className="text-[13px] text-white/30">:</span>
                        <select
                          value={minute}
                          onChange={(e) => setMinute(Number(e.currentTarget.value))}
                          className="flex h-7 w-[4.25rem] rounded-md border border-white/10 bg-white/[0.03] px-2 text-[13px] tabular-nums text-white/70"
                        >
                          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                            <option key={m} value={m}>
                              {pad2(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {showDayOfWeek && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/35">On</label>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setDayOfWeek(i)}
                          className={cn(
                            "flex h-7 w-9 items-center justify-center rounded-md border text-[11px] transition-colors",
                            dayOfWeek === i
                              ? "border-violet-300/40 bg-violet-300/15 text-violet-200"
                              : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showDayOfMonth && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/35">Day of month</label>
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.currentTarget.value))}
                      className="flex h-7 w-20 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[13px] tabular-nums text-white/70"
                    >
                      {Array.from({ length: 28 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
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

            <button
              type="button"
              onClick={() => {
                if (!useAdvanced) {
                  setCustomCron(effectiveCron)
                } else {
                  const parsed = parseCronToFields(customCron.trim())
                  if (parsed) {
                    setFrequency(parsed.frequency)
                    setHour(parsed.hour)
                    setMinute(parsed.minute)
                    setDayOfWeek(parsed.dayOfWeek)
                    setDayOfMonth(parsed.dayOfMonth)
                  }
                }
                setUseAdvanced(!useAdvanced)
                setCronError(null)
              }}
              className="text-[11px] text-white/30 transition-colors hover:text-white/55"
            >
              {useAdvanced ? "Use simple editor" : "Use custom cron expression"}
            </button>

            {cronError && <p className="text-[11px] text-rose-300/80">{cronError}</p>}

            {effectiveCron && !cronError && (
              <div className="rounded-md border border-white/6 bg-black/30 px-3 py-2">
                <p className="text-[11px] font-medium text-white/45">{describeCron(effectiveCron)}</p>
                {nextRuns.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {nextRuns.map((run, i) => (
                      <p key={i} className="text-[11px] text-white/25">
                        {i === 0 ? "Next:" : ""} {formatPreviewDate(run, timezone)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            {saving ? (
              <>
                <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
                Saving...
              </>
            ) : editingSchedule ? (
              "Save changes"
            ) : (
              "Create schedule"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export { ScheduleSheet }

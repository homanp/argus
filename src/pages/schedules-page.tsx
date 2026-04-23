import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Calendar03Icon, Loading03Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { TogglePill } from "@/components/ui/toggle-pill"
import { ScheduleSheet } from "@/components/schedule-sheet"
import { deleteSchedule, getSchedules, updateSchedule, type Schedule } from "@/lib/relay-api"
import { humanCron, relativeTime } from "@/lib/schedule-utils"

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

function SchedulesPage() {
  const navigate = useNavigate()
  const [schedulesList, setSchedulesList] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

  const loadSchedules = useCallback(async () => {
    try {
      const data = await getSchedules()
      setSchedulesList(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedules.")
    } finally {
      setLoading(false)
    }
  }, [])

  function openCreateSheet() {
    setEditingSchedule(null)
    setSheetOpen(true)
  }

  const openCreateSheetRef = useRef(openCreateSheet)
  openCreateSheetRef.current = openCreateSheet

  useEffect(() => {
    void loadSchedules()
  }, [loadSchedules])

  useEffect(() => {
    function handleNewSchedule() {
      openCreateSheetRef.current()
    }
    function handleSearch(e: Event) {
      setSearch((e as CustomEvent<string>).detail)
    }
    window.addEventListener("argus:new-schedule", handleNewSchedule)
    window.addEventListener("argus:schedule-search", handleSearch)
    return () => {
      window.removeEventListener("argus:new-schedule", handleNewSchedule)
      window.removeEventListener("argus:schedule-search", handleSearch)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schedulesList
    return schedulesList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q) ||
        s.cronExpression.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    )
  }, [schedulesList, search])

  function openEditSheet(schedule: Schedule) {
    setEditingSchedule(schedule)
    setSheetOpen(true)
  }

  async function handleToggleEnabled(schedule: Schedule) {
    setBusy(schedule.id)
    try {
      await updateSchedule(schedule.id, { enabled: !schedule.enabled })
      await loadSchedules()
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(schedule: Schedule) {
    setBusy(schedule.id)
    try {
      await deleteSchedule(schedule.id)
      await loadSchedules()
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
            Loading schedules...
          </div>
        ) : schedulesList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-black/30 px-5 py-16">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
              <HugeIcon icon={Calendar03Icon} size={22} />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[13px] font-medium text-white/70">No schedules yet</p>
              <p className="text-[13px] text-white/40">
                Create your first schedule to run prompts on a recurring cadence.
              </p>
            </div>
            <Button onClick={openCreateSheet} className="bg-violet-300 text-violet-950 hover:bg-violet-200">
              Create your first schedule
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/8 bg-black/30">
                  <th className="px-3 py-2 text-[11px] font-medium text-white/35">Name</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-white/35">Schedule</th>
                  <th className="hidden px-3 py-2 text-[11px] font-medium text-white/35 lg:table-cell">Prompt</th>
                  <th className="px-3 py-2 text-[11px] font-medium text-white/35">Next run</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-white/35">Runs</th>
                  <th className="w-20 px-3 py-2 text-right text-[11px] font-medium text-white/35" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((schedule) => (
                  <tr
                    key={schedule.id}
                    onClick={() =>
                      navigate({
                        to: "/schedules/$scheduleId",
                        params: { scheduleId: schedule.id },
                      })
                    }
                    className="cursor-pointer transition-colors hover:bg-black/30"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <HugeIcon icon={Calendar03Icon} size={14} className="shrink-0 text-white/40" />
                        <span className="text-[13px] font-medium text-white/80">{schedule.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="violet" size="sm">
                        {humanCron(schedule.cronExpression)}
                      </Badge>
                      {schedule.timezone !== "UTC" && (
                        <span className="ml-1.5 text-[10px] text-white/25">{schedule.timezone}</span>
                      )}
                    </td>
                    <td className="hidden max-w-[260px] px-3 py-2 lg:table-cell">
                      <p className="line-clamp-1 text-[12px] text-white/35">{schedule.prompt}</p>
                    </td>
                    <td className="px-3 py-2">
                      {schedule.enabled && schedule.nextRunAt ? (
                        <span className="text-[12px] tabular-nums text-white/35">
                          {relativeTime(schedule.nextRunAt)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/15">{schedule.enabled ? "—" : "paused"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] tabular-nums text-white/35">
                      {schedule.executionCount > 0 ? (
                        <span>{schedule.executionCount}</span>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <TogglePill
                          active={schedule.enabled}
                          disabled={busy === schedule.id}
                          onClick={() => void handleToggleEnabled(schedule)}
                        />
                        <RowMenu
                          onEdit={() => openEditSheet(schedule)}
                          onDelete={() => void handleDelete(schedule)}
                          disabled={busy === schedule.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[13px] text-white/35">
                      No schedules match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <ScheduleSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editingSchedule={editingSchedule}
          onSaved={() => void loadSchedules()}
        />
      </div>
    </section>
  )
}

export default SchedulesPage

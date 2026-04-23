import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { ActivitySparkIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { ActivityRowItem, groupRowsByStatus, type ActivityRow } from "@/components/activity-row"
import { HugeIcon } from "@/components/ui/huge-icon"
import { getMissions } from "@/lib/relay-api"
import type { MissionSummary } from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"

// Missions home page. Uses the same Linear-style table as the Activity view
// but restricted to mission rows. Clicking a row navigates straight to the
// mission detail page where the user can approve/dismiss/decide.

function App() {
  const navigate = useNavigate()
  const [missions, setMissions] = useState<MissionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    getMissions()
      .then((result) => {
        setMissions(result)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load missions.")
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // SSE drives all subsequent refreshes — no polling needed. The relay emits
  // a `missions` event on create/update/delete/scan/execution state change.
  useRelayEvent("missions", reload)

  const rows = useMemo<ActivityRow[]>(
    () =>
      (missions ?? []).map((mission) => ({
        kind: "mission",
        id: `mission-${mission.id}`,
        at: mission.createdAt,
        data: mission,
      })),
    [missions],
  )

  // Grouping mirrors the Activity view: awaiting_decision first (lives in
  // the "awaiting" lane), then decided (completed), then dismissed.
  const grouped = useMemo(() => groupRowsByStatus(rows), [rows])

  if (missions === null && !error) {
    return (
      <section className="pt-1 pb-5">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading missions...
        </div>
      </section>
    )
  }

  return (
    <section className="pt-1 pb-5">
      <div className="flex w-full flex-col gap-4">
        {error && (
          <div className="rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-[13px] text-rose-100/85">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-black/30 px-5 py-16">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
              <HugeIcon icon={ActivitySparkIcon} size={22} />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[13px] font-medium text-white/70">No missions yet</p>
              <p className="text-[13px] text-white/40">
                Argus is watching. Missions appear here when the engine surfaces decisions worth your attention.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {grouped.map((group) => (
              <Fragment key={group.id}>
                {group.rows.map((row) => (
                  <ActivityRowItem
                    key={row.id}
                    row={row}
                    onSelect={() =>
                      row.kind === "mission"
                        ? navigate({ to: "/missions/$missionId", params: { missionId: row.data.id } })
                        : undefined
                    }
                  />
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default App

import { useCallback, useEffect, useState } from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { MissionCard } from "@/components/decision-card"
import { HugeIcon } from "@/components/ui/huge-icon"
import { getAgent, getMissions } from "@/lib/relay-api"
import type { AgentConfig, MissionSummary } from "@/lib/relay-api"

function App() {
  const [missions, setMissions] = useState<MissionSummary[] | null>(null)
  const [agent, setAgent] = useState<AgentConfig | null>(null)
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
    const interval = setInterval(reload, 15_000)
    return () => clearInterval(interval)
  }, [reload])

  useEffect(() => {
    let cancelled = false
    getAgent()
      .then((result) => {
        if (!cancelled) setAgent(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const awaiting = (missions ?? []).filter((mission) => mission.status === "awaiting_decision")

  if (missions === null && !error) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading missions...
        </div>
      </section>
    )
  }

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {error && (
          <div className="rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-[13px] text-rose-100/85">
            {error}
          </div>
        )}

        {awaiting.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-center text-sm text-white/45">
            No missions waiting. Argus is watching.
          </div>
        )}

        {awaiting.map((mission) => (
          <MissionCard key={mission.id} mission={mission} agentName={agent?.name ?? null} onDecided={reload} />
        ))}

        {awaiting.length > 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-center text-sm text-white/45">
            That's everything. Argus handled the rest.
          </div>
        )}
      </div>
    </section>
  )
}

export default App

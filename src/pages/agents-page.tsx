import { useEffect } from "react"

import { AgentSetupCard } from "@/components/agent-setup-card"
import { MissionEngineCard } from "@/components/mission-engine-card"
import { useAgentSetup } from "@/hooks/use-agent-setup"

function AgentsPage() {
  const model = useAgentSetup()
  const { configured, editing, handleRemove, setEditing } = model

  useEffect(() => {
    function onEdit() {
      setEditing(true)
    }
    function onDelete() {
      void handleRemove()
    }
    window.addEventListener("argus:edit-agent", onEdit)
    window.addEventListener("argus:delete-agent", onDelete)
    return () => {
      window.removeEventListener("argus:edit-agent", onEdit)
      window.removeEventListener("argus:delete-agent", onDelete)
    }
  }, [handleRemove, setEditing])

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <AgentSetupCard model={model} />
        {configured && !editing ? <MissionEngineCard /> : null}
      </div>
    </section>
  )
}

export default AgentsPage

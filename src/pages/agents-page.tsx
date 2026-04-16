import { useCallback, useEffect, useRef, useState } from "react"
import { AiBrain02Icon, CancelCircleIcon, CheckmarkCircle02Icon, Loading03Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  configureAgent,
  detectAgents,
  getAgent,
  removeAgent,
  validateAgent,
  type AgentConfig,
  type DetectedAgent,
} from "@/lib/relay-api"

function agentImage(name: string, detected: DetectedAgent[]): string | null {
  const match = detected.find((d) => d.name === name)
  return match?.image ?? null
}

function AgentLogo({ image, fallbackClassName }: { image: string | null; fallbackClassName?: string }) {
  if (image) {
    return <img src={image} alt="" className="size-5" />
  }
  return <HugeIcon icon={AiBrain02Icon} size={14} className={fallbackClassName ?? "text-white/50"} />
}

function AgentsPage() {
  const [configured, setConfigured] = useState<AgentConfig | null | undefined>(undefined)
  const [detected, setDetected] = useState<DetectedAgent[]>([])
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nameInput, setNameInput] = useState("")
  const [commandInput, setCommandInput] = useState("")
  const [editing, setEditing] = useState(false)
  const [validating, setValidating] = useState(false)

  type CheckStatus = "idle" | "checking" | "pass" | "fail"
  const [agentCheck, setAgentCheck] = useState<CheckStatus>("idle")
  const [skillCheck, setSkillCheck] = useState<CheckStatus>("idle")
  const [cliCheck, setCliCheck] = useState<CheckStatus>("idle")

  function applyPersistedChecks(data: AgentConfig) {
    if (data.lastCheckedAt) {
      setAgentCheck(data.checkAgentOk ? "pass" : "fail")
      setSkillCheck(data.checkSkillOk ? "pass" : "fail")
      setCliCheck(data.checkCliOk ? "pass" : "fail")
    }
  }

  const loadAgent = useCallback(async () => {
    try {
      const data = await getAgent()
      setConfigured(data)
      if (data) {
        setNameInput(data.name)
        setCommandInput(data.command)
        applyPersistedChecks(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the local relay.")
      setConfigured(null)
    }
  }, [])

  const loadDetected = useCallback(async () => {
    setDetecting(true)
    try {
      const data = await detectAgents()
      setDetected(data)
    } catch {
      // detection is optional
    } finally {
      setDetecting(false)
    }
  }, [])

  useEffect(() => {
    void loadAgent()
    void loadDetected()
  }, [loadAgent, loadDetected])

  function selectDetected(d: DetectedAgent) {
    setNameInput(d.name)
    setCommandInput(d.command)
    setEditing(true)
  }

  async function handleSave() {
    if (!nameInput.trim() || !commandInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await configureAgent(nameInput.trim(), commandInput.trim())
      setConfigured(result)
      setEditing(false)
      setAgentCheck("idle")
      setSkillCheck("idle")
      setCliCheck("idle")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await removeAgent()
      setConfigured(null)
      setNameInput("")
      setCommandInput("")
      setEditing(false)
      setAgentCheck("idle")
      setSkillCheck("idle")
      setCliCheck("idle")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove agent.")
    } finally {
      setRemoving(false)
    }
  }

  async function handleValidateAll() {
    setValidating(true)
    setAgentCheck("checking")
    setSkillCheck("checking")
    setCliCheck("checking")
    setError(null)

    try {
      const result = await validateAgent()
      setAgentCheck(result.agent.ok ? "pass" : "fail")
      setSkillCheck(result.skill.ok ? "pass" : "fail")
      setCliCheck(result.cli.ok ? "pass" : "fail")
      await loadAgent()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.")
      setAgentCheck("fail")
      setSkillCheck("fail")
      setCliCheck("fail")
    } finally {
      setValidating(false)
    }
  }

  const handleEditRef = useRef(() => setEditing(true))
  handleEditRef.current = () => setEditing(true)
  const handleRemoveRef = useRef(handleRemove)
  handleRemoveRef.current = handleRemove

  useEffect(() => {
    function onEdit() {
      handleEditRef.current()
    }
    function onDelete() {
      handleRemoveRef.current()
    }
    window.addEventListener("argus:edit-agent", onEdit)
    window.addEventListener("argus:delete-agent", onDelete)
    return () => {
      window.removeEventListener("argus:edit-agent", onEdit)
      window.removeEventListener("argus:delete-agent", onDelete)
    }
  }, [])

  if (configured === undefined) {
    return (
      <section className="px-5 py-5 md:px-6">
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-white/45">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading...
        </div>
      </section>
    )
  }

  const showForm = !configured || editing
  const detectedAvailable = detected.filter((d) => d.detected)

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        {configured && !editing ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-lg border border-white/8">
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                  <AgentLogo image={agentImage(configured.name, detected)} fallbackClassName="text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/85">{configured.name}</p>
                  <p className="font-mono text-[12px] text-white/40">{configured.command}</p>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              {configured.lastUsedAt && (
                <div className="border-t border-white/6 px-4 py-2.5">
                  <p className="text-[11px] text-white/30">
                    Last used {new Date(configured.lastUsedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-white/8">
              <div className="flex items-center justify-between border-b border-white/6 bg-white/[0.02] px-4 py-2">
                <p className="text-[12px] font-medium text-white/50">Setup checks</p>
                <Button
                  onClick={handleValidateAll}
                  disabled={validating}
                  variant="outline"
                  className="border-white/10 bg-transparent text-[11px] font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                >
                  {validating ? (
                    <>
                      <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Validate"
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-white/6 px-4 py-2.5">
                <div>
                  <p className="text-[12px] text-white/60">Agent CLI</p>
                  <p className="font-mono text-[11px] text-white/25">{configured.command}</p>
                </div>
                {agentCheck === "checking" && (
                  <HugeIcon icon={Loading03Icon} size={14} className="animate-spin text-white/30" />
                )}
                {agentCheck === "pass" && (
                  <HugeIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                )}
                {agentCheck === "fail" && <HugeIcon icon={CancelCircleIcon} size={16} className="text-rose-400" />}
                {agentCheck === "idle" && <span className="text-[10px] text-white/20">--</span>}
              </div>

              <div className="flex items-center justify-between border-b border-white/6 px-4 py-2.5">
                <div>
                  <p className="text-[12px] text-white/60">Argus skill</p>
                  <p className="font-mono text-[11px] text-white/25">npx skills add argus-ai/argus</p>
                </div>
                {skillCheck === "checking" && (
                  <HugeIcon icon={Loading03Icon} size={14} className="animate-spin text-white/30" />
                )}
                {skillCheck === "pass" && (
                  <HugeIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                )}
                {skillCheck === "fail" && <HugeIcon icon={CancelCircleIcon} size={16} className="text-rose-400" />}
                {skillCheck === "idle" && <span className="text-[10px] text-white/20">--</span>}
              </div>

              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-[12px] text-white/60">Argus CLI</p>
                  <p className="font-mono text-[11px] text-white/25">curl -fsSL https://argus.dev/install | bash</p>
                </div>
                {cliCheck === "checking" && (
                  <HugeIcon icon={Loading03Icon} size={14} className="animate-spin text-white/30" />
                )}
                {cliCheck === "pass" && (
                  <HugeIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
                )}
                {cliCheck === "fail" && <HugeIcon icon={CancelCircleIcon} size={16} className="text-rose-400" />}
                {cliCheck === "idle" && <span className="text-[10px] text-white/20">--</span>}
              </div>
            </div>
          </div>
        ) : null}

        {showForm && (
          <div className="flex flex-col gap-4">
            {detectedAvailable.length > 0 && !configured && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-white/50">Detected on your machine</p>
                <div className="overflow-hidden rounded-lg border border-white/8">
                  {detectedAvailable.map((d, index) => (
                    <button
                      key={d.slug}
                      type="button"
                      onClick={() => selectDetected(d)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                        index < detectedAvailable.length - 1 ? "border-b border-white/6" : ""
                      }`}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
                        <AgentLogo image={d.image} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-white/80">{d.name}</p>
                        <p className="font-mono text-[11px] text-white/35">{d.command}</p>
                      </div>
                      <span className="text-[11px] text-white/30">Select</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detecting && detectedAvailable.length === 0 && !configured && (
              <div className="flex items-center gap-2 text-[12px] text-white/35">
                <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
                Scanning for installed agent CLIs...
              </div>
            )}

            {!detecting && detectedAvailable.length === 0 && !configured && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
                  <HugeIcon icon={AiBrain02Icon} size={22} />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-[13px] font-medium text-white/70">No agent CLIs detected</p>
                  <p className="text-[13px] text-white/40">Enter a command below to configure your agent manually.</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {(detectedAvailable.length > 0 || configured) && (
                <p className="text-[12px] font-medium text-white/50">
                  {configured ? "Edit agent" : "Or configure manually"}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-white/40">Name</label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.currentTarget.value)}
                  placeholder="e.g. Claude Code"
                  className="h-7 rounded-md border-white/8 bg-white/[0.03] text-[13px] text-white/70 placeholder:text-white/25"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-white/40">Command</label>
                <Input
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.currentTarget.value)}
                  placeholder="e.g. claude -p"
                  className="h-7 rounded-md border-white/8 bg-white/[0.03] font-mono text-[13px] text-white/70 placeholder:text-white/25"
                />
                <p className="text-[11px] text-white/25">
                  The base command to invoke your agent. Argus appends the prompt as the final argument.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving || !nameInput.trim() || !commandInput.trim()}
                  className="bg-violet-300 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
                >
                  {saving ? (
                    <>
                      <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : configured ? (
                    "Update"
                  ) : (
                    "Save"
                  )}
                </Button>
                {editing && configured && (
                  <Button
                    onClick={() => {
                      setEditing(false)
                      setNameInput(configured.name)
                      setCommandInput(configured.command)
                    }}
                    variant="outline"
                    className="border-white/10 bg-transparent text-[11px] font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default AgentsPage

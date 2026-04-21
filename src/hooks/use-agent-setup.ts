import { useCallback, useEffect, useRef, useState } from "react"

import {
  configureAgent,
  detectAgents,
  getAgent,
  removeAgent,
  validateAgent,
  type AgentConfig,
  type DetectedAgent,
} from "@/lib/relay-api"

const CLI_INSTALL_COMMAND = "curl -fsSL https://argus.dev/install | bash"
const CLI_RELEASES_URL = "https://github.com/homanp/argus/releases"

type CheckStatus = "idle" | "checking" | "pass" | "fail"

type UseAgentSetupOptions = {
  initialConfigured?: AgentConfig | null
  onConfiguredChange?: (config: AgentConfig | null) => void
}

function useAgentSetup({ initialConfigured, onConfiguredChange }: UseAgentSetupOptions = {}) {
  const [configured, setConfigured] = useState<AgentConfig | null | undefined>(initialConfigured)
  const [detected, setDetected] = useState<DetectedAgent[]>([])
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [commandInput, setCommandInput] = useState("")
  const [editing, setEditing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [agentCheck, setAgentCheck] = useState<CheckStatus>("idle")
  const [skillCheck, setSkillCheck] = useState<CheckStatus>("idle")
  const [cliCheck, setCliCheck] = useState<CheckStatus>("idle")
  const [cliPath, setCliPath] = useState<string | null>(null)
  const [cliVersion, setCliVersion] = useState<string | null>(null)
  const [cliCopied, setCliCopied] = useState(false)
  const cliCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoValidatedRef = useRef(false)
  const initialLoadRef = useRef(false)

  const applyPersistedChecks = useCallback((data: AgentConfig) => {
    if (data.lastCheckedAt) {
      setAgentCheck(data.checkAgentOk ? "pass" : "fail")
      setSkillCheck(data.checkSkillOk ? "pass" : "fail")
      setCliCheck(data.checkCliOk ? "pass" : "fail")
    } else {
      setAgentCheck("idle")
      setSkillCheck("idle")
      setCliCheck("idle")
    }
    setCliPath(data.cliPath)
    setCliVersion(data.cliVersion)
  }, [])

  const syncConfigured = useCallback(
    (data: AgentConfig | null) => {
      setConfigured(data)
      onConfiguredChange?.(data)
    },
    [onConfiguredChange],
  )

  const loadAgent = useCallback(async () => {
    try {
      const data = await getAgent()
      syncConfigured(data)
      if (data) {
        setNameInput(data.name)
        setCommandInput(data.command)
        applyPersistedChecks(data)
      } else {
        setNameInput("")
        setCommandInput("")
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the local relay.")
      syncConfigured(null)
    }
  }, [applyPersistedChecks, syncConfigured])

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
    if (initialConfigured !== undefined) {
      syncConfigured(initialConfigured)
      if (initialConfigured) {
        setNameInput(initialConfigured.name)
        setCommandInput(initialConfigured.command)
        applyPersistedChecks(initialConfigured)
      }
    }
  }, [applyPersistedChecks, initialConfigured, syncConfigured])

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    if (initialConfigured === undefined) void loadAgent()
    void loadDetected()
  }, [initialConfigured, loadAgent, loadDetected])

  useEffect(() => {
    return () => {
      if (cliCopyTimerRef.current) clearTimeout(cliCopyTimerRef.current)
    }
  }, [])

  const handleCopyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CLI_INSTALL_COMMAND)
      setCliCopied(true)
      if (cliCopyTimerRef.current) clearTimeout(cliCopyTimerRef.current)
      cliCopyTimerRef.current = setTimeout(() => setCliCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }, [])

  const selectDetected = useCallback((detectedAgent: DetectedAgent) => {
    setNameInput(detectedAgent.name)
    setCommandInput(detectedAgent.command)
    setEditing(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!nameInput.trim() || !commandInput.trim()) return null
    setSaving(true)
    setError(null)

    try {
      const result = await configureAgent(nameInput.trim(), commandInput.trim())
      syncConfigured(result)
      setEditing(false)
      setAgentCheck("idle")
      setSkillCheck("idle")
      setCliCheck("idle")
      setCliPath(result.cliPath)
      setCliVersion(result.cliVersion)
      autoValidatedRef.current = false
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent.")
      return null
    } finally {
      setSaving(false)
    }
  }, [commandInput, nameInput, syncConfigured])

  const handleRemove = useCallback(async () => {
    setRemoving(true)
    setError(null)

    try {
      await removeAgent()
      syncConfigured(null)
      setNameInput("")
      setCommandInput("")
      setEditing(false)
      setAgentCheck("idle")
      setSkillCheck("idle")
      setCliCheck("idle")
      setCliPath(null)
      setCliVersion(null)
      autoValidatedRef.current = false
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove agent.")
      return false
    } finally {
      setRemoving(false)
    }
  }, [syncConfigured])

  const handleValidateAll = useCallback(async () => {
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
      setCliPath(result.cli.path)
      setCliVersion(result.cli.version)
      await loadAgent()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.")
      setAgentCheck("fail")
      setSkillCheck("fail")
      setCliCheck("fail")
      return null
    } finally {
      setValidating(false)
    }
  }, [loadAgent])

  useEffect(() => {
    if (autoValidatedRef.current) return
    if (configured && !validating) {
      autoValidatedRef.current = true
      void handleValidateAll()
    }
  }, [configured, handleValidateAll, validating])

  const cancelEditing = useCallback(() => {
    if (!configured) return
    setEditing(false)
    setNameInput(configured.name)
    setCommandInput(configured.command)
  }, [configured])

  const showForm = !configured || editing
  const detectedAvailable = detected.filter((item) => item.detected)

  return {
    agentCheck,
    cancelEditing,
    cliCheck,
    cliCopied,
    cliPath,
    cliVersion,
    commandInput,
    configured,
    detecting,
    detected,
    detectedAvailable,
    editing,
    error,
    handleCopyInstall,
    handleRemove,
    handleSave,
    handleValidateAll,
    loadAgent,
    loadDetected,
    nameInput,
    removing,
    saving,
    selectDetected,
    setCommandInput,
    setEditing,
    setError,
    setNameInput,
    showForm,
    skillCheck,
    validating,
  }
}

export { CLI_INSTALL_COMMAND, CLI_RELEASES_URL, useAgentSetup }
export type { CheckStatus }

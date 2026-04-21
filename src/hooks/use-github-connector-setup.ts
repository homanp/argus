import { useCallback, useEffect, useRef, useState } from "react"

import { buildEmptyGitHubState } from "@/lib/github-integration"
import {
  connectGitHub,
  getGitHubIntegration,
  syncGitHubRepositories,
  type GitHubIntegrationState,
} from "@/lib/relay-api"

type UseGitHubConnectorSetupOptions = {
  enabled?: boolean
  initialState?: GitHubIntegrationState | null
  onStateChange?: (state: GitHubIntegrationState) => void
}

function useGitHubConnectorSetup({ enabled = true, initialState, onStateChange }: UseGitHubConnectorSetupOptions = {}) {
  const [githubState, setGithubState] = useState<GitHubIntegrationState | null>(initialState ?? null)
  const [loading, setLoading] = useState(enabled && initialState === undefined)
  const [submittingApiKey, setSubmittingApiKey] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialLoadRef = useRef(false)

  const syncState = useCallback(
    (state: GitHubIntegrationState) => {
      setGithubState(state)
      onStateChange?.(state)
    },
    [onStateChange],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const state = await getGitHubIntegration()
      syncState(state)
      setError(null)
      return state
    } catch (loadError) {
      const fallback = buildEmptyGitHubState()
      syncState(fallback)
      setError(loadError instanceof Error ? loadError.message : "Failed to reach the local relay.")
      return fallback
    } finally {
      setLoading(false)
    }
  }, [syncState])

  useEffect(() => {
    if (initialState !== undefined) {
      if (initialState) syncState(initialState)
      setLoading(false)
    }
  }, [initialState, syncState])

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    if (!enabled) {
      setLoading(false)
      return
    }
    if (initialState === undefined) void load()
  }, [enabled, initialState, load])

  const handleConnect = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Enter a GitHub API key to connect the integration.")
      return null
    }

    setSubmittingApiKey(true)
    setError(null)
    setNotice(null)

    try {
      const state = await connectGitHub(apiKey.trim())
      syncState(state)
      setNotice("GitHub connected. Select the repos you want to configure webhooks for.")
      setApiKey("")
      return state
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Failed to connect GitHub.")
      return null
    } finally {
      setSubmittingApiKey(false)
    }
  }, [apiKey, syncState])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)
    setNotice(null)

    try {
      const state = await syncGitHubRepositories()
      syncState(state)
      setNotice("GitHub repositories refreshed from the local relay.")
      return state
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync GitHub repositories.")
      return null
    } finally {
      setSyncing(false)
    }
  }, [syncState])

  return {
    apiKey,
    error,
    githubState,
    handleConnect,
    handleSync,
    loading,
    load,
    notice,
    setApiKey,
    setError,
    setGithubState: syncState,
    setNotice,
    submittingApiKey,
    syncing,
  }
}

export { useGitHubConnectorSetup }

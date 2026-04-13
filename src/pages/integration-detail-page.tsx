import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown01Icon, ArrowUp01Icon, Copy01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { useRouterState } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { integrationCatalog } from "@/lib/integration-catalog"
import {
  connectGitHub,
  getGitHubIntegration,
  RELAY_BASE_URL,
  sendGitHubWebhookTest,
  setGitHubRepositorySelected,
  syncGitHubRepositories,
  type GitHubIntegrationRepository,
  type GitHubIntegrationState,
} from "@/lib/relay-api"

function buildEmptyGitHubState(): GitHubIntegrationState {
  return {
    provider: "github",
    displayName: "GitHub",
    status: "not_connected",
    apiKeyConfigured: false,
    relayBaseUrl: RELAY_BASE_URL,
    supportedEvents: ["push", "pull_request", "issues", "issue_comment"],
    account: null,
    repositories: [],
    recentEvents: [],
  }
}

function statusClasses(status: string) {
  switch (status) {
    case "connected":
      return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    case "error":
      return "border-rose-300/30 bg-rose-300/10 text-rose-100"
    case "offline":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100"
    default:
      return "border-white/10 bg-white/[0.04] text-white/60"
  }
}

function webhookStatusBadge(status: string) {
  switch (status) {
    case "active":
    case "test_passed":
    case "ready":
      return "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
    case "not_configured":
      return "border-white/10 bg-white/[0.04] text-white/50"
    default:
      return "border-white/10 bg-white/[0.04] text-white/50"
  }
}

function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 transition-colors hover:bg-white/[0.06]"
    >
      {copied ? (
        <HugeIcon icon={Tick02Icon} size={14} className="text-emerald-400" />
      ) : (
        <HugeIcon icon={Copy01Icon} size={12} className="text-white/50" />
      )}
    </button>
  )
}

function ExpandableRepoRow({
  repository,
  expanded,
  busy,
  testSuccess,
  onToggleSelect,
  onToggleExpand,
  onTestWebhook,
}: {
  repository: GitHubIntegrationRepository
  expanded: boolean
  busy: boolean
  testSuccess: boolean
  onToggleSelect: (enabled: boolean) => void
  onToggleExpand: () => void
  onTestWebhook: () => void
}) {
  return (
    <div className={`transition-colors ${repository.selected ? "bg-violet-300/[0.04]" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-2">
        <input
          type="checkbox"
          checked={repository.selected}
          disabled={busy}
          onChange={(event) => onToggleSelect(event.currentTarget.checked)}
          className="size-4 shrink-0 rounded border-white/15 bg-transparent accent-violet-300"
        />
        <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{repository.fullName}</p>
            <p className="text-[12px] text-white/40">
              {repository.private ? "Private" : "Public"} · {repository.defaultBranch ?? "main"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {repository.selected ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.02em] ${webhookStatusBadge(repository.webhookStatus)}`}
              >
                {repository.webhookStatus.replaceAll("_", " ")}
              </span>
            ) : null}
            <HugeIcon icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} size={14} className="shrink-0 text-white/30" />
          </div>
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-white/5 px-3 py-3 pl-10">
          {repository.selected && repository.webhookUrl ? (
            <>
              {repository.webhookManaged ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2">
                  <HugeIcon icon={Tick02Icon} size={14} className="shrink-0 text-emerald-400" />
                  <p className="text-[13px] text-emerald-200/80">
                    Webhook auto-managed by Argus. URL updates automatically when the relay restarts.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-white/50">
                  Add this webhook in your GitHub repo settings. Use{" "}
                  <span className="text-white/70">application/json</span> as the content type. Grant{" "}
                  <code className="rounded bg-white/6 px-1 text-[11px] text-white/70">admin:repo_hook</code> scope on
                  your token to let Argus manage this automatically.
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">Payload URL</p>
                    <p className="truncate font-mono text-[11px] text-white/80">{repository.webhookUrl}</p>
                  </div>
                  <CopyIconButton value={repository.webhookUrl!} />
                </div>
                {!repository.webhookManaged && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-white/35">Secret</p>
                      <p className="truncate font-mono text-[11px] text-white/80">{repository.webhookSecret}</p>
                    </div>
                    <CopyIconButton value={repository.webhookSecret!} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={onTestWebhook}
                  disabled={busy}
                  size="sm"
                  className="bg-violet-300 text-violet-950 hover:bg-violet-200 disabled:bg-violet-300/60"
                >
                  {busy ? "Testing..." : "Test webhook"}
                </Button>
                {testSuccess ? (
                  <span className="flex items-center gap-1 text-[12px] text-emerald-400">
                    <HugeIcon icon={Tick02Icon} size={14} />
                    Success
                  </span>
                ) : null}
              </div>
            </>
          ) : repository.selected ? (
            <p className="text-[13px] text-white/45">Generating webhook credentials...</p>
          ) : (
            <p className="text-[13px] text-white/45">Enable this repo to generate its webhook URL and secret.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function IntegrationDetailPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const provider = pathname.split("/").filter(Boolean).at(1) ?? "github"
  const integration = integrationCatalog.find((item) => item.provider === provider) ?? integrationCatalog[0]

  const [githubState, setGithubState] = useState<GitHubIntegrationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingApiKey, setSubmittingApiKey] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [busyRepositoryId, setBusyRepositoryId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [expandedRepoIds, setExpandedRepoIds] = useState<Set<string>>(new Set())
  const [repoSearch, setRepoSearch] = useState("")
  const [testSuccessRepoId, setTestSuccessRepoId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (provider !== "github") {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const state = await getGitHubIntegration()
        if (!cancelled) {
          setGithubState(state)
        }
      } catch (loadError) {
        if (!cancelled) {
          setGithubState(buildEmptyGitHubState())
          setError(loadError instanceof Error ? loadError.message : "Failed to reach the local relay.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [provider])

  async function handleConnectGitHub() {
    if (!apiKey.trim()) {
      setError("Enter a GitHub API key to connect the integration.")
      return
    }

    setSubmittingApiKey(true)
    setError(null)
    setNotice(null)

    try {
      const state = await connectGitHub(apiKey.trim())
      setGithubState(state)
      setNotice("GitHub connected. Select the repos you want to configure webhooks for.")
      setApiKey("")
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Failed to connect GitHub.")
    } finally {
      setSubmittingApiKey(false)
    }
  }

  async function handleSyncRepos() {
    setSyncing(true)
    setError(null)
    setNotice(null)

    try {
      const state = await syncGitHubRepositories()
      setGithubState(state)
      setNotice("GitHub repositories refreshed from the local relay.")
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync GitHub repositories.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleToggleRepository(repositoryId: string, enabled: boolean) {
    setBusyRepositoryId(repositoryId)
    setError(null)

    try {
      const nextState = await setGitHubRepositorySelected(repositoryId, enabled)
      setGithubState(nextState)
      if (enabled) {
        setExpandedRepoIds((current) => new Set([...current, repositoryId]))
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update repository selection.")
    } finally {
      setBusyRepositoryId(null)
    }
  }

  async function handleTestWebhook(repositoryId: string) {
    setBusyRepositoryId(repositoryId)
    setError(null)
    setNotice(null)

    try {
      const state = await sendGitHubWebhookTest(repositoryId)
      setGithubState(state)
      setTestSuccessRepoId(repositoryId)
      setTimeout(() => setTestSuccessRepoId((current) => (current === repositoryId ? null : current)), 3000)
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to send a webhook test.")
    } finally {
      setBusyRepositoryId(null)
    }
  }

  function toggleExpanded(repositoryId: string) {
    setExpandedRepoIds((current) => {
      const next = new Set(current)
      if (next.has(repositoryId)) {
        next.delete(repositoryId)
      } else {
        next.add(repositoryId)
      }
      return next
    })
  }

  const filteredRepositories = useMemo(() => {
    const repos = githubState?.repositories ?? []
    const query = repoSearch.trim().toLowerCase()
    if (!query) {
      return repos
    }

    return repos.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(query) ||
        repo.name.toLowerCase().includes(query) ||
        repo.owner.toLowerCase().includes(query),
    )
  }, [githubState?.repositories, repoSearch])

  const selectedCount = githubState?.repositories.filter((repo) => repo.selected).length ?? 0

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-white">{integration.title}</h1>
            <p className="text-[13px] text-white/45">{integration.description}</p>
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] tracking-[0.02em] ${
              provider === "github"
                ? statusClasses(githubState?.status ?? "offline")
                : "border-white/10 bg-white/[0.04] text-white/55"
            }`}
          >
            {provider === "github"
              ? (githubState?.status?.replaceAll("_", " ") ?? "offline")
              : integration.available
                ? "available"
                : "coming soon"}
          </span>
        </div>

        {notice ? <p className="text-[13px] text-emerald-200/85">{notice}</p> : null}
        {error ? <p className="text-[13px] text-rose-200/85">{error}</p> : null}

        {provider !== "github" ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center text-[13px] text-white/45">
            {integration.title} is not implemented yet. This page is reserved for its configuration flow once the relay
            supports that provider.
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <div className="space-y-1">
                <h2 className="text-[13px] font-semibold text-white">API key</h2>
                <p className="text-[13px] text-white/45">
                  Paste a GitHub personal access token to load repositories this relay can monitor.
                </p>
              </div>
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                placeholder="ghp_..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleConnectGitHub}
                  disabled={submittingApiKey}
                  className="bg-violet-300 text-violet-950 hover:bg-violet-200 disabled:bg-violet-300/60"
                >
                  {submittingApiKey
                    ? "Connecting..."
                    : githubState?.apiKeyConfigured
                      ? "Update API key"
                      : "Connect GitHub"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSyncRepos}
                  disabled={syncing || !githubState?.apiKeyConfigured}
                  className="border-white/10 bg-transparent text-white/75 hover:bg-white/[0.04] hover:text-white"
                >
                  {syncing ? "Syncing..." : "Sync repos"}
                </Button>
              </div>
            </div>

            {selectedCount > 0 ? (
              <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="space-y-1">
                  <h2 className="text-[13px] font-semibold text-white">Connected repositories</h2>
                  <p className="text-[13px] text-white/45">Repositories with active webhook configurations.</p>
                </div>
                <div className="divide-y divide-white/5 rounded-lg border border-white/8">
                  {githubState?.repositories
                    .filter((repository) => repository.selected)
                    .map((repository) => (
                      <ExpandableRepoRow
                        key={`connected-${repository.id}`}
                        repository={repository}
                        expanded={expandedRepoIds.has(repository.id)}
                        busy={busyRepositoryId === repository.id}
                        testSuccess={testSuccessRepoId === repository.id}
                        onToggleSelect={(enabled) => void handleToggleRepository(repository.id, enabled)}
                        onToggleExpand={() => toggleExpanded(repository.id)}
                        onTestWebhook={() => void handleTestWebhook(repository.id)}
                      />
                    ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-[13px] font-semibold text-white">All repositories</h2>
                  <p className="text-[13px] text-white/45">
                    Select a repo to enable webhooks. Each selected repo gets its own webhook URL and secret you
                    configure in GitHub.
                  </p>
                </div>
                {selectedCount > 0 ? (
                  <span className="shrink-0 rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-0.5 text-[11px] text-violet-200">
                    {selectedCount} active
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <HugeIcon
                  icon={Search01Icon}
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-white/35"
                />
                <Input
                  value={repoSearch}
                  onChange={(event) => setRepoSearch(event.currentTarget.value)}
                  placeholder="Search repositories..."
                  className="pl-8 text-[12px]"
                />
              </div>

              <div className="max-h-[600px] divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/8">
                {loading ? (
                  <div className="py-6 text-center text-[13px] text-white/45">Loading repositories...</div>
                ) : filteredRepositories.length ? (
                  filteredRepositories.map((repository) => (
                    <ExpandableRepoRow
                      key={repository.id}
                      repository={repository}
                      expanded={expandedRepoIds.has(repository.id)}
                      busy={busyRepositoryId === repository.id}
                      testSuccess={testSuccessRepoId === repository.id}
                      onToggleSelect={(enabled) => void handleToggleRepository(repository.id, enabled)}
                      onToggleExpand={() => toggleExpanded(repository.id)}
                      onTestWebhook={() => void handleTestWebhook(repository.id)}
                    />
                  ))
                ) : githubState?.repositories.length ? (
                  <div className="py-6 text-center text-[13px] text-white/45">No repositories match your search.</div>
                ) : (
                  <div className="py-6 text-center text-[13px] text-white/45">
                    Connect GitHub to load repositories into this list.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default IntegrationDetailPage

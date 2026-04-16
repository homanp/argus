import { useEffect, useState } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { integrationCatalog } from "@/lib/integration-catalog"
import { getGitHubIntegration, RELAY_BASE_URL, type GitHubIntegrationState } from "@/lib/relay-api"
import { cn } from "@/lib/utils"

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

function IntegrationsPage() {
  const navigate = useNavigate()
  const [githubState, setGithubState] = useState<GitHubIntegrationState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const state = await getGitHubIntegration()
        if (!cancelled) setGithubState(state)
      } catch (loadError) {
        if (!cancelled) {
          setGithubState(buildEmptyGitHubState())
          setError(loadError instanceof Error ? loadError.message : "Failed to reach the local relay.")
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function resolveStatus(provider: string) {
    if (provider !== "github") return null
    if (!githubState) return null
    if (githubState.status === "connected") return "connected" as const
    if (githubState.status === "error") return "error" as const
    return null
  }

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {error && <p className="text-[13px] text-rose-200/85">{error}</p>}

        <div className="overflow-hidden rounded-lg border border-white/8">
          {integrationCatalog.map((integration, index) => {
            const status = resolveStatus(integration.provider)
            const isLast = index === integrationCatalog.length - 1

            return (
              <button
                key={integration.provider}
                type="button"
                onClick={() => navigate({ to: "/connectors/$provider", params: { provider: integration.provider } })}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]",
                  !isLast && "border-b border-white/6",
                  !integration.available && "opacity-50",
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                  {integration.image ? (
                    <img src={integration.image} alt={integration.title} className="size-5" />
                  ) : (
                    <HugeIcon icon={integration.icon} size={18} className="text-white/70" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/85">{integration.title}</p>
                  <p className="truncate text-[12px] text-white/40">{integration.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {status === "connected" ? (
                    <Badge variant="success">Connected</Badge>
                  ) : status === "error" ? (
                    <Badge variant="danger">Error</Badge>
                  ) : integration.available ? (
                    <span className="text-[12px] text-white/40">Connect</span>
                  ) : (
                    <span className="text-[11px] text-white/25">Coming soon</span>
                  )}
                  <HugeIcon icon={ArrowRight01Icon} size={14} className="text-white/20" />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default IntegrationsPage

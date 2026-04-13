import { useEffect, useState } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useNavigate } from "@tanstack/react-router"

import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function statusLabel(state: GitHubIntegrationState | null) {
  if (!state) {
    return "offline"
  }

  if (state.status === "connected") {
    return "connected"
  }

  if (state.status === "error") {
    return "error"
  }

  return "not connected"
}

function TogglePill({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "relative flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors",
        active ? "border-violet-300/40 bg-violet-300/90" : "border-white/10 bg-white/[0.08]",
      )}
    >
      <div
        className={cn(
          "size-3.5 rounded-full bg-white transition-transform",
          active ? "translate-x-3.5" : "translate-x-0",
        )}
      />
    </div>
  )
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
          // no-op, load completion only clears error fallback
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const githubCardStatus = statusLabel(githubState)

  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        {error ? <p className="text-[13px] text-rose-200/85">{error}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrationCatalog.map((integration) => {
            const isGitHub = integration.provider === "github"
            const connected = isGitHub ? githubCardStatus === "connected" : false

            return (
              <Card
                key={integration.provider}
                className="border border-white/8 bg-white/[0.025] text-white shadow-none transition-colors"
              >
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-white">{integration.title}</CardTitle>
                      <CardDescription className="text-white/45">{integration.domain}</CardDescription>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/80 ring-1 ring-white/10">
                      {integration.image ? (
                        <img src={integration.image} alt={integration.title} className="size-6" />
                      ) : (
                        <HugeIcon icon={integration.icon} size={22} />
                      )}
                    </div>
                  </div>
                  <p className="min-h-12 text-[13px] leading-6 text-white/65">{integration.description}</p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate({ to: "/connectors/$provider", params: { provider: integration.provider } })
                    }
                    className="border-white/10 bg-transparent text-white/75 hover:bg-white/[0.04] hover:text-white"
                  >
                    View integration
                    <HugeIcon icon={ArrowRight01Icon} size={14} className="text-white/45" />
                  </Button>
                  <TogglePill active={connected} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default IntegrationsPage

import { RELAY_BASE_URL, type GitHubIntegrationState } from "@/lib/relay-api"

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

function isGitHubIntegrationConnected(state: GitHubIntegrationState | null | undefined) {
  return state?.status === "connected"
}

export { buildEmptyGitHubState, isGitHubIntegrationConnected }

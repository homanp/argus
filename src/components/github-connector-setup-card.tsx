import { ArrowRight01Icon, Github01Icon, Loading03Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Input } from "@/components/ui/input"
import { useGitHubConnectorSetup } from "@/hooks/use-github-connector-setup"
import { isGitHubIntegrationConnected } from "@/lib/github-integration"
import { cn } from "@/lib/utils"

function GitHubConnectorSetupCard({
  model,
  variant = "page",
  title,
  description,
}: {
  model: ReturnType<typeof useGitHubConnectorSetup>
  variant?: "page" | "wizard"
  title?: string
  description?: string
}) {
  const compact = variant === "wizard"
  const connected = isGitHubIntegrationConnected(model.githubState)

  return (
    <div className="flex flex-col gap-4">
      {title || description ? (
        <div className="space-y-1">
          {title ? <p className="text-[12px] font-medium text-white/62">{title}</p> : null}
          {description ? <p className="text-[13px] text-white/40">{description}</p> : null}
        </div>
      ) : null}

      {model.notice ? <p className="text-[13px] text-emerald-200/85">{model.notice}</p> : null}
      {model.error ? <p className="text-[13px] text-rose-200/85">{model.error}</p> : null}

      <div
        className={cn(
          "overflow-hidden",
          compact ? "rounded-none border-0 bg-transparent" : "rounded-lg border border-white/8 bg-sidebar",
          connected && compact && "border-emerald-300/12 bg-emerald-300/[0.04]",
        )}
      >
        <div className={cn("px-4 py-3", !compact && "border-b border-white/6")}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
              <img src="/github.svg" alt="GitHub" className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white/85">{title ?? "GitHub connector"}</p>
              <p className="text-[12px] text-white/40">
                {connected
                  ? model.githubState?.account?.login
                    ? `Connected as ${model.githubState.account.login}.`
                    : "Connected and ready for repository setup."
                  : (description ?? "Connect GitHub so Argus can receive repository events.")}
              </p>
            </div>
            {connected ? (
              <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                Connected
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3">
          <Input
            type="password"
            value={model.apiKey}
            onChange={(event) => model.setApiKey(event.currentTarget.value)}
            placeholder="ghp_..."
            className="border-white/8 bg-white/[0.03]"
          />
          {!compact ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void model.handleConnect()}
                disabled={model.submittingApiKey}
                className="bg-violet-300 text-violet-950 hover:bg-violet-200 disabled:bg-violet-300/60"
              >
                {model.submittingApiKey ? (
                  <>
                    <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
                    Connecting...
                  </>
                ) : connected ? (
                  "Update API key"
                ) : (
                  <>
                    <HugeIcon icon={Github01Icon} size={14} />
                    Connect GitHub
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => void model.handleSync()}
                disabled={model.syncing || !model.githubState?.apiKeyConfigured}
                className="border-white/10 bg-transparent text-white/65 hover:bg-white/[0.04] hover:text-white"
              >
                {model.syncing ? "Syncing..." : "Sync repos"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {compact ? (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => void model.handleConnect()}
            disabled={model.submittingApiKey}
            size="icon-lg"
            className="rounded-full bg-violet-300 text-violet-950 shadow-[0_10px_30px_rgba(196,181,253,0.18)] hover:bg-violet-200 disabled:bg-violet-300/60"
          >
            {model.submittingApiKey ? (
              <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
            ) : (
              <HugeIcon icon={ArrowRight01Icon} size={16} />
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export { GitHubConnectorSetupCard }

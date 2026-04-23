import {
  AiBrain02Icon,
  ArrowRight01Icon,
  ArrowUpRight02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Input } from "@/components/ui/input"
import { CLI_INSTALL_COMMAND, CLI_RELEASES_URL, type CheckStatus, useAgentSetup } from "@/hooks/use-agent-setup"

function agentImage(name: string, detected: ReturnType<typeof useAgentSetup>["detected"]): string | null {
  const match = detected.find((item) => item.name === name)
  return match?.image ?? null
}

function AgentLogo({ image, fallbackClassName }: { image: string | null; fallbackClassName?: string }) {
  if (image) {
    return <img src={image} alt="" className="size-5" />
  }
  return <HugeIcon icon={AiBrain02Icon} size={14} className={fallbackClassName ?? "text-white/50"} />
}

function CheckIndicator({ status }: { status: CheckStatus }) {
  if (status === "checking") {
    return <HugeIcon icon={Loading03Icon} size={14} className="animate-spin text-white/30" />
  }
  if (status === "pass") {
    return <HugeIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-400" />
  }
  if (status === "fail") {
    return <HugeIcon icon={CancelCircleIcon} size={16} className="text-rose-400" />
  }
  return <span className="text-[10px] text-white/20">--</span>
}

function AgentSetupCard({
  model,
  variant = "page",
  title,
  description,
}: {
  model: ReturnType<typeof useAgentSetup>
  variant?: "page" | "wizard"
  title?: string
  description?: string
}) {
  if (model.configured === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-white/45">
        <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
        Loading...
      </div>
    )
  }

  const compact = variant === "wizard"

  return (
    <div className="flex flex-col gap-4">
      {title || description ? (
        <div className="space-y-1">
          {title ? <p className="text-[12px] font-medium text-white/62">{title}</p> : null}
          {description ? <p className="text-[13px] text-white/40">{description}</p> : null}
        </div>
      ) : null}

      {model.error && <p className="text-[13px] text-rose-200/85">{model.error}</p>}

      {model.configured && !model.editing ? (
        compact ? (
          <div className="overflow-hidden rounded-2xl bg-transparent">
            <div className="flex items-center gap-4 px-1 py-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                <AgentLogo
                  image={agentImage(model.configured.name, model.detected)}
                  fallbackClassName="text-violet-300"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-white/85">{model.configured.name}</p>
                <p className="truncate font-mono text-[11px] text-white/40">{model.configured.command}</p>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
            <div className="flex items-center gap-2 px-1 py-2">
              <Button
                variant="outline"
                onClick={() => model.setEditing(true)}
                className="border-white/10 bg-transparent text-[11px] font-normal text-white/55 hover:bg-white/[0.04] hover:text-white/75"
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                  <AgentLogo
                    image={agentImage(model.configured.name, model.detected)}
                    fallbackClassName="text-violet-300"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/85">{model.configured.name}</p>
                  <p className="font-mono text-[12px] text-white/40">{model.configured.command}</p>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              {model.configured.lastUsedAt ? (
                <div className="border-t border-white/6 px-4 py-2.5">
                  <p className="text-[11px] text-white/30">
                    Last used {new Date(model.configured.lastUsedAt).toLocaleString()}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-white/8 bg-sidebar">
              <div className="flex items-center justify-between border-b border-white/6 bg-black/30 px-4 py-2">
                <p className="text-[12px] font-medium text-white/50">Setup checks</p>
                <Button
                  onClick={() => void model.handleValidateAll()}
                  disabled={model.validating}
                  variant="outline"
                  className="border-white/10 bg-transparent text-[11px] font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                >
                  {model.validating ? (
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
                  <p className="font-mono text-[11px] text-white/25">{model.configured.command}</p>
                </div>
                <CheckIndicator status={model.agentCheck} />
              </div>

              <div className="flex items-center justify-between border-b border-white/6 px-4 py-2.5">
                <div>
                  <p className="text-[12px] text-white/60">Argus skill</p>
                  <p className="font-mono text-[11px] text-white/25">npx skills add argus-ai/argus</p>
                </div>
                <CheckIndicator status={model.skillCheck} />
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] text-white/60">Argus CLI</p>
                    {model.cliCheck === "pass" && model.cliVersion ? (
                      <span className="rounded-sm bg-white/[0.05] px-1 py-[1px] font-mono text-[10px] text-white/45">
                        v{model.cliVersion}
                      </span>
                    ) : null}
                  </div>
                  {model.cliCheck === "pass" && model.cliPath ? (
                    <p className="truncate font-mono text-[11px] text-white/25">{model.cliPath}</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-[11px] text-white/25">{CLI_INSTALL_COMMAND}</p>
                      <button
                        type="button"
                        onClick={() => void model.handleCopyInstall()}
                        title="Copy install command"
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                      >
                        {model.cliCopied ? (
                          <HugeIcon icon={Tick02Icon} size={11} className="text-emerald-400" />
                        ) : (
                          <HugeIcon icon={Copy01Icon} size={11} />
                        )}
                      </button>
                      <a
                        href={CLI_RELEASES_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="View releases on GitHub"
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                      >
                        <HugeIcon icon={ArrowUpRight02Icon} size={11} />
                      </a>
                    </div>
                  )}
                </div>
                <CheckIndicator status={model.cliCheck} />
              </div>
            </div>
          </div>
        )
      ) : null}

      {model.showForm ? (
        <div className="flex flex-col gap-4">
          {model.detectedAvailable.length > 0 && !model.configured ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-medium text-white/50">Detected on your machine</p>
              <div className="overflow-hidden">
                {model.detectedAvailable.map((detectedAgent, index) => (
                  <button
                    key={detectedAgent.slug}
                    type="button"
                    onClick={() => model.selectDetected(detectedAgent)}
                    className={`flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                      index < model.detectedAvailable.length - 1 ? "border-b border-white/6" : ""
                    }`}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
                      <AgentLogo image={detectedAgent.image} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white/80">{detectedAgent.name}</p>
                      <p className="font-mono text-[11px] text-white/35">{detectedAgent.command}</p>
                    </div>
                    <span className="text-[11px] text-white/30">Select</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {model.detecting && model.detectedAvailable.length === 0 && !model.configured ? (
            <div className="flex items-center gap-2 text-[12px] text-white/35">
              <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
              Scanning for installed agent CLIs...
            </div>
          ) : null}

          {!model.detecting && model.detectedAvailable.length === 0 && !model.configured ? (
            <div
              className={
                compact
                  ? "flex flex-col items-center gap-4 px-1 py-6"
                  : "flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-black/30 px-5 py-12"
              }
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40 ring-1 ring-white/10">
                <HugeIcon icon={AiBrain02Icon} size={22} />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[13px] font-medium text-white/70">No agent CLIs detected</p>
                <p className="text-[13px] text-white/40">Enter a command below to configure your agent manually.</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {model.detectedAvailable.length > 0 || model.configured ? (
              <p className="text-[12px] font-medium text-white/50">
                {model.configured ? "Edit agent" : "Or configure manually"}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-white/40">Name</label>
              <Input
                value={model.nameInput}
                onChange={(event) => model.setNameInput(event.currentTarget.value)}
                placeholder="e.g. Claude Code"
                className="h-7 rounded-md border-white/8 bg-white/[0.03] text-[13px] text-white/70 placeholder:text-white/25"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-white/40">Command</label>
              <Input
                value={model.commandInput}
                onChange={(event) => model.setCommandInput(event.currentTarget.value)}
                placeholder="e.g. claude -p"
                className="h-7 rounded-md border-white/8 bg-white/[0.03] font-mono text-[13px] text-white/70 placeholder:text-white/25"
              />
              <p className="text-[11px] text-white/25">
                The base command to invoke your agent. Argus appends the prompt as the final argument.
              </p>
            </div>
            {compact ? (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Button
                  onClick={() => void model.handleSave()}
                  disabled={model.saving || !model.nameInput.trim() || !model.commandInput.trim()}
                  size="icon-lg"
                  className="rounded-full bg-violet-300 text-violet-950 shadow-[0_10px_30px_rgba(196,181,253,0.18)] hover:bg-violet-200 disabled:bg-violet-300/60"
                >
                  {model.saving ? (
                    <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
                  ) : (
                    <HugeIcon icon={ArrowRight01Icon} size={16} />
                  )}
                </Button>
                {model.editing && model.configured ? (
                  <Button
                    onClick={model.cancelEditing}
                    variant="ghost"
                    className="text-[11px] font-normal text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={() => void model.handleSave()}
                  disabled={model.saving || !model.nameInput.trim() || !model.commandInput.trim()}
                  className="bg-violet-300 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
                >
                  {model.saving ? (
                    <>
                      <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : model.configured ? (
                    "Update"
                  ) : (
                    "Save"
                  )}
                </Button>
                {model.editing && model.configured ? (
                  <Button
                    onClick={model.cancelEditing}
                    variant="outline"
                    className="border-white/10 bg-transparent text-[11px] font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { AgentSetupCard }

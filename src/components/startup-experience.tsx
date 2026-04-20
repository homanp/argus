import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckmarkCircle02Icon, RefreshIcon } from "@hugeicons/core-free-icons"

import { AgentSetupCard } from "@/components/agent-setup-card"
import { ArgusLogo } from "@/components/argus-logo"
import { GitHubConnectorSetupCard } from "@/components/github-connector-setup-card"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { useAgentSetup } from "@/hooks/use-agent-setup"
import { useGitHubConnectorSetup } from "@/hooks/use-github-connector-setup"
import { isGitHubIntegrationConnected } from "@/lib/github-integration"
import { getAgent, getGitHubIntegration, type AgentConfig, type GitHubIntegrationState } from "@/lib/relay-api"

type StartupPhase = "intro" | "welcome" | "error" | "closing" | "closed"

type StartupReadiness = {
  agent: AgentConfig | null
  github: GitHubIntegrationState
}

type OnboardingStep = "agent" | "connector" | "done"

const INTRO_MIN_MS = 1250
const CLOSE_MS = 520
const LOGO_LAYOUT_TRANSITION = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 0.95,
} as const

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function ProgressDots({ step }: { step: OnboardingStep }) {
  const currentIndex = step === "agent" ? 0 : step === "connector" ? 1 : 2
  const dots: OnboardingStep[] = ["agent", "connector", "done"]

  return (
    <div className="flex items-center justify-center gap-1.5">
      {dots.map((dot, index) => {
        const isComplete = index < currentIndex
        const isActive = index === currentIndex && step !== "done"
        const dotClassName = isComplete
          ? "bg-white/82 shadow-[0_0_16px_rgba(255,255,255,0.22)]"
          : isActive
            ? "bg-white/65 shadow-[0_0_16px_rgba(255,255,255,0.16)]"
            : "bg-white/14"

        return (
          <div
            key={dot}
            className={`size-2 rounded-full transition-all duration-500 ${dotClassName} ${isActive ? "scale-125" : ""}`}
          />
        )
      })}
    </div>
  )
}

function StartupWelcomeContent({
  initialReadiness,
  onClose,
}: {
  initialReadiness: StartupReadiness
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const agentModel = useAgentSetup({ initialConfigured: initialReadiness.agent })
  const githubModel = useGitHubConnectorSetup({ enabled: true, initialState: initialReadiness.github })

  const agentReady = Boolean(agentModel.configured)
  const githubReady = isGitHubIntegrationConnected(githubModel.githubState)
  const step: OnboardingStep = !agentReady ? "agent" : !githubReady ? "connector" : "done"

  useEffect(() => {
    if (step !== "done") return
    const timer = window.setTimeout(onClose, 900)
    return () => window.clearTimeout(timer)
  }, [step, onClose])

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.72, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full flex-col items-center"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          {step === "agent" ? (
            <AgentSetupCard model={agentModel} variant="wizard" />
          ) : step === "connector" ? (
            <GitHubConnectorSetupCard model={githubModel} variant="wizard" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/78 ring-1 ring-white/10">
                <HugeIcon icon={CheckmarkCircle02Icon} size={22} />
              </div>
              <p className="text-[13px] text-white/62">Argus is ready</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-7 flex flex-col items-center gap-7">
        <ProgressDots step={step} />
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-white/32 transition-colors hover:text-white/60"
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  )
}

function StartupError({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
      <ArgusLogo sizeClassName="w-28" markClassName="relative" />
      <div className="w-full max-w-sm space-y-2">
        <p className="text-[13px] font-medium text-white/72">Could not reach the local relay</p>
        <p className="text-[13px] text-white/42">{error}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onRetry} className="bg-white/88 text-neutral-900 hover:bg-white">
          <HugeIcon icon={RefreshIcon} size={13} />
          Retry
        </Button>
        <Button variant="ghost" onClick={onClose} className="text-white/55 hover:bg-white/[0.04] hover:text-white/80">
          Continue to app
        </Button>
      </div>
    </div>
  )
}

function StartupExperience() {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<StartupPhase>("intro")
  const [logoVisible, setLogoVisible] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [initialReadiness, setInitialReadiness] = useState<StartupReadiness | null>(null)

  const overlayVisible = phase !== "closed"

  useEffect(() => {
    const frame = window.setTimeout(() => setLogoVisible(true), 40)
    return () => window.clearTimeout(frame)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function runStartup() {
      setPhase("intro")
      setError(null)

      const start = performance.now()
      const [agentResult, githubResult] = await Promise.allSettled([getAgent(), getGitHubIntegration()])
      const waitForIntro = Math.max(0, INTRO_MIN_MS - (performance.now() - start))
      if (waitForIntro > 0) await sleep(waitForIntro)
      if (cancelled) return

      if (agentResult.status === "rejected" || githubResult.status === "rejected") {
        const messages = [
          agentResult.status === "rejected" ? agentResult.reason : null,
          githubResult.status === "rejected" ? githubResult.reason : null,
        ]
          .map((value) => (value instanceof Error ? value.message : null))
          .filter(Boolean)
        setError(messages[0] ?? "The local relay is unavailable.")
        setPhase("error")
        return
      }

      const readiness = {
        agent: agentResult.value,
        github: githubResult.value,
      }
      setInitialReadiness(readiness)

      if (readiness.agent && isGitHubIntegrationConnected(readiness.github)) {
        setPhase("closing")
        window.setTimeout(() => {
          if (!cancelled) setPhase("closed")
        }, CLOSE_MS)
        return
      }

      setPhase("welcome")
    }

    void runStartup()

    return () => {
      cancelled = true
    }
  }, [runKey])

  const introMotion = useMemo(() => {
    if (phase === "closing") return "opacity-0"
    return logoVisible ? "opacity-100" : "opacity-0"
  }, [logoVisible, phase])

  function handleClose() {
    setPhase("closing")
    window.setTimeout(() => setPhase("closed"), CLOSE_MS)
  }

  if (!overlayVisible) return null

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden transition-opacity duration-500 ${
        phase === "closing" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="absolute inset-0 bg-black/78 backdrop-blur-lg" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-[-18%] left-1/2 h-[56vmax] w-[82vmax] -translate-x-1/2 rounded-full bg-white/[0.14] blur-[120px]"
          animate={
            reduceMotion
              ? { opacity: 0.85 }
              : {
                  opacity: [0.56, 0.98, 0.56],
                  scale: [1, 1.12, 1],
                }
          }
          transition={{ duration: 11, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-26%] left-1/2 h-[44vmax] w-[68vmax] -translate-x-1/2 rounded-full bg-white/[0.08] blur-[110px]"
          animate={
            reduceMotion
              ? { opacity: 0.7 }
              : {
                  opacity: [0.28, 0.72, 0.28],
                  scale: [1.04, 0.96, 1.04],
                }
          }
          transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05)_16%,rgba(255,255,255,0)_36%)]" />

      <div className="relative h-svh overflow-y-auto overscroll-contain px-6 py-10 md:px-10">
        <div className="flex min-h-full w-full items-center justify-center">
          {phase === "welcome" && initialReadiness ? (
            <motion.div
              layout
              transition={LOGO_LAYOUT_TRANSITION}
              className="mx-auto flex w-full max-w-md flex-col items-center gap-8"
            >
              <motion.div layout="position" transition={LOGO_LAYOUT_TRANSITION} className="relative">
                <motion.div
                  className="pointer-events-none absolute inset-[-85%] rounded-full bg-white/[0.18] blur-[96px]"
                  animate={
                    reduceMotion
                      ? { opacity: 0.72 }
                      : {
                          scale: [1, 1.08, 1],
                          opacity: [0.4, 0.92, 0.4],
                        }
                  }
                  transition={{
                    duration: 5.8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <ArgusLogo sizeClassName="w-28" markClassName="relative" />
              </motion.div>
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <StartupWelcomeContent initialReadiness={initialReadiness} onClose={handleClose} />
              </motion.div>
            </motion.div>
          ) : phase === "error" && error ? (
            <StartupError error={error} onRetry={() => setRunKey((current) => current + 1)} onClose={handleClose} />
          ) : (
            <motion.div
              layout
              transition={LOGO_LAYOUT_TRANSITION}
              className="mx-auto flex w-full max-w-md flex-col items-center gap-8"
            >
              <motion.div
                layout="position"
                transition={LOGO_LAYOUT_TRANSITION}
                initial={{ opacity: 0 }}
                animate={{ opacity: logoVisible ? 1 : 0 }}
                className={`relative ${introMotion}`}
              >
                <motion.div
                  className="pointer-events-none absolute inset-[-85%] rounded-full bg-white/[0.2] blur-[92px]"
                  animate={
                    reduceMotion
                      ? { opacity: 0.78 }
                      : {
                          scale: [1, 1.08, 1],
                          opacity: [0.42, 1, 0.42],
                        }
                  }
                  transition={{ duration: 5.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <ArgusLogo sizeClassName="w-32" markClassName="relative" />
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export { StartupExperience }

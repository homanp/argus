import { useCallback, useEffect, useState } from "react"
import { Loading03Icon, RefreshIcon, SparklesIcon } from "@hugeicons/core-free-icons"
import { Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { getMissionSettings, scanMissionsNow, updateMissionSettings } from "@/lib/relay-api"
import type { MissionSettings } from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { cn } from "@/lib/utils"

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "24 hours" },
]

const LOOKBACK_OPTIONS = [
  { value: 60, label: "60 minutes" },
  { value: 120, label: "2 hours" },
  { value: 360, label: "6 hours" },
  { value: 1440, label: "24 hours" },
  { value: 10080, label: "7 days" },
]

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never"
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 0) return "just now"
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function inUntil(iso: string | null | undefined) {
  if (!iso) return "—"
  const seconds = Math.floor((new Date(iso).getTime() - Date.now()) / 1000)
  if (seconds <= 0) return "now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d`
}

function MissionEngineCard() {
  const [settings, setSettings] = useState<MissionSettings | null>(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const s = await getMissionSettings()
      setSettings(s)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mission engine settings.")
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useRelayEvent("missions", reload)

  async function patch(update: Partial<Pick<MissionSettings, "enabled" | "intervalMinutes" | "lookbackMinutes">>) {
    if (!settings) return
    setSaving(true)
    try {
      const next = await updateMissionSettings(update)
      setSettings(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  async function handleScan() {
    setScanning(true)
    try {
      await scanMissionsNow()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.")
    } finally {
      setScanning(false)
    }
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <p className="flex items-center gap-1.5 text-[12px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
          Loading mission engine…
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/8">
      <div className="flex items-start justify-between gap-4 border-b border-white/6 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 ring-1 ring-violet-300/20">
            <HugeIcon icon={SparklesIcon} size={16} className="text-violet-200" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium text-white/85">Mission engine</p>
            <p className="text-[12px] text-white/45">
              Periodically asks the agent to surface missions worth your attention.
            </p>
          </div>
        </div>
        <Badge variant={settings.enabled ? "success" : "neutral"} size="md">
          {settings.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {error && (
        <div className="border-b border-white/6 bg-rose-300/[0.04] px-4 py-2 text-[12px] text-rose-200/85">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 px-4 py-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/40">Scan every</label>
          <select
            value={settings.intervalMinutes}
            disabled={saving}
            onChange={(e) => void patch({ intervalMinutes: Number(e.target.value) })}
            className="h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2 text-[12px] text-white/75 focus:border-violet-300/40 focus:outline-none"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-neutral-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/40">Lookback window</label>
          <select
            value={settings.lookbackMinutes}
            disabled={saving}
            onChange={(e) => void patch({ lookbackMinutes: Number(e.target.value) })}
            className="h-7 w-full rounded-md border border-white/10 bg-white/[0.03] px-2 text-[12px] text-white/75 focus:border-violet-300/40 focus:outline-none"
          >
            {LOOKBACK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-neutral-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/6 px-4 py-3 text-[11px] text-white/45">
        <span>Last scan {timeAgo(settings.lastScanAt)}</span>
        <span className="text-white/20">·</span>
        <span>Next {inUntil(settings.nextScanAt)}</span>
        {settings.lastScanSummary && (
          <>
            <span className="text-white/20">·</span>
            <span>
              <span
                className={cn(
                  "font-medium",
                  settings.lastScanSummary.surfacedCount > 0 ? "text-violet-200" : "text-white/60",
                )}
              >
                {settings.lastScanSummary.surfacedCount}
              </span>{" "}
              surfaced, <span className="font-medium text-white/60">{settings.lastScanSummary.suppressedCount}</span>{" "}
              suppressed
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/6 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void patch({ enabled: !settings.enabled })}
            disabled={saving}
            className="border-white/10 bg-transparent text-[11px] font-normal text-white/60 hover:bg-white/[0.04] hover:text-white"
          >
            {settings.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            variant="ghost"
            render={<Link to="/insights" />}
            className="h-7 rounded-md px-2.5 text-[11px] font-normal text-white/45 hover:bg-white/[0.04] hover:text-white/70"
          >
            View insights →
          </Button>
        </div>
        <Button
          onClick={handleScan}
          disabled={!settings.enabled || scanning}
          className="h-7 gap-1.5 rounded-md bg-violet-300 px-2.5 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
        >
          {scanning ? (
            <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
          ) : (
            <HugeIcon icon={RefreshIcon} size={12} />
          )}
          Scan now
        </Button>
      </div>
    </div>
  )
}

export { MissionEngineCard }

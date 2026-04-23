import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChartUpIcon,
  Loading03Icon,
  PencilEdit02Icon,
  SearchVisualIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeIcon } from "@/components/ui/huge-icon"
import { JsonView } from "@/components/ui/json-view"
import {
  getMissionSettings,
  getMissionSuppressions,
  getOperatingDoc,
  getOperatingDocUpdates,
  revertOperatingDocUpdate,
  scanMissionsNow,
  updateOperatingDoc,
} from "@/lib/relay-api"
import type {
  MissionScanSummary,
  MissionSettings,
  MissionSuppression,
  OperatingDoc,
  OperatingDocUpdate,
} from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { cn } from "@/lib/utils"

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never"
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 0) return `in ${Math.abs(Math.floor(seconds / 60))}m`
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

function OperatingDocEditor({ doc, onSaved }: { doc: OperatingDoc; onSaved: (next: OperatingDoc) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.markdown)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setDraft(doc.markdown)
  }, [doc.markdown, editing])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const next = await updateOperatingDoc(draft)
      onSaved(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-medium text-white/40">Operating doc</p>
          <Badge variant="subtle" size="sm" className="text-[10px] text-white/55">
            Updated {timeAgo(doc.updatedAt)} by {doc.updatedBy}
          </Badge>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false)
                setDraft(doc.markdown)
                setError(null)
              }}
              disabled={saving}
              className="border-white/10 bg-transparent text-[11px] font-normal text-white/60 hover:bg-white/[0.04] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || draft === doc.markdown}
              className="h-7 gap-1.5 rounded-md bg-violet-300 px-2.5 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
            >
              {saving ? <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            className="border-white/10 bg-transparent text-[11px] font-normal text-white/60 hover:bg-white/[0.04] hover:text-white"
          >
            <HugeIcon icon={PencilEdit02Icon} size={12} />
            Edit
          </Button>
        )}
      </div>
      {error && <p className="text-[12px] text-rose-300/85">{error}</p>}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="h-[320px] w-full resize-y rounded-lg border border-white/10 bg-black/20 p-4 font-mono text-[12px] leading-relaxed text-white/80 focus:border-violet-300/40 focus:outline-none"
        />
      ) : (
        <div className="rounded-lg border border-white/8 bg-black/30 p-5 text-[13px] leading-7 text-white/80 [&_code]:rounded [&_code]:bg-white/6 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:text-white/90 [&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:text-white [&_li]:mb-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-white">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown || "_empty_"}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

function ScanSummaryCard({
  settings,
  scanning,
  onScan,
}: {
  settings: MissionSettings | null
  scanning: boolean
  onScan: () => void
}) {
  const summary = settings?.lastScanSummary ?? null
  const disabled = !settings?.enabled
  return (
    <div className="rounded-lg border border-white/8 bg-black/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[12px] font-medium text-white/40">Last scan</p>
          <ScanHeadline summary={summary} settings={settings} />
        </div>
        <Button
          onClick={onScan}
          disabled={disabled || scanning}
          className="h-7 gap-1.5 rounded-md bg-violet-300 px-2.5 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
        >
          {scanning ? (
            <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" />
          ) : (
            <HugeIcon icon={SearchVisualIcon} size={12} />
          )}
          Scan now
        </Button>
      </div>

      {summary && summary.error && <p className="mt-4 text-[12px] text-rose-300/85">Error: {summary.error}</p>}

      <div className="mt-4 grid grid-cols-4 gap-3 text-[12px]">
        <Stat label="Events" value={summary?.eventCount ?? 0} />
        <Stat label="Candidates" value={summary?.candidateCount ?? 0} />
        <Stat label="Surfaced" value={summary?.surfacedCount ?? 0} highlight={(summary?.surfacedCount ?? 0) > 0} />
        <Stat label="Suppressed" value={summary?.suppressedCount ?? 0} />
      </div>

      <div className="mt-4 flex items-center gap-3 text-[11px] text-white/40">
        <span>Next scan {inUntil(settings?.nextScanAt)}</span>
        <span className="text-white/20">·</span>
        <span>
          Every {settings?.intervalMinutes ?? 0}m over a {settings?.lookbackMinutes ?? 0}m window
        </span>
        {!settings?.enabled && (
          <>
            <span className="text-white/20">·</span>
            <Badge variant="neutral" size="sm" className="text-amber-300/85">
              disabled
            </Badge>
          </>
        )}
      </div>
    </div>
  )
}

function ScanHeadline({ summary, settings }: { summary: MissionScanSummary | null; settings: MissionSettings | null }) {
  if (!summary) {
    return <p className="text-[13px] text-white/55">No scans yet. Click "Scan now" to run one.</p>
  }
  return (
    <p className="text-[13px] leading-6 text-white/75">
      Scanned <span className="font-medium text-white">{summary.eventCount}</span> event
      {summary.eventCount === 1 ? "" : "s"} {timeAgo(settings?.lastScanAt)}.{" "}
      <span className="font-medium text-white">{summary.surfacedCount}</span> surfaced,{" "}
      <span className="font-medium text-white">{summary.suppressedCount}</span> suppressed.
    </p>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-white/8 bg-black/30 px-3 py-2">
      <p className="text-[11px] text-white/40">{label}</p>
      <p
        className={cn(
          "text-[13px] leading-snug font-semibold tabular-nums",
          highlight ? "text-violet-200" : "text-white/85",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SuppressionRow({ suppression }: { suppression: MissionSuppression }) {
  const [expanded, setExpanded] = useState(false)
  const candidate = suppression.candidate as { title?: string; recommendation?: string } | null
  const title = candidate?.title ?? "Unknown candidate"

  return (
    <div className="overflow-hidden rounded-md border border-white/8 bg-black/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/30" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13px] font-medium text-white/85">{title}</p>
          <p className="line-clamp-2 text-[12px] text-white/55">{suppression.reason ?? "no reason given"}</p>
        </div>
        <div className="shrink-0 text-[11px] text-white/30">{timeAgo(suppression.createdAt)}</div>
      </button>
      {expanded && candidate && <JsonView value={candidate} maxHeightClassName="max-h-72" />}
    </div>
  )
}

function OperatingDocUpdateRow({
  update,
  onReverted,
}: {
  update: OperatingDocUpdate
  onReverted: (next: OperatingDoc) => void
}) {
  const [reverting, setReverting] = useState(false)

  async function handleRevert() {
    setReverting(true)
    try {
      const next = await revertOperatingDocUpdate(update.id)
      onReverted(next)
    } catch (err) {
      console.error("revert failed", err)
    } finally {
      setReverting(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-white/8 bg-black/30 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <Badge size="sm" variant="neutral" className="text-[10px] capitalize">
            {update.source}
          </Badge>
          <span>{timeAgo(update.createdAt)}</span>
        </div>
        <Button
          variant="outline"
          onClick={handleRevert}
          disabled={reverting}
          className="border-white/10 bg-transparent text-[11px] font-normal text-white/60 hover:bg-white/[0.04] hover:text-white"
        >
          {reverting ? <HugeIcon icon={Loading03Icon} size={12} className="animate-spin" /> : null}
          Revert
        </Button>
      </div>
      {update.diff && (
        <pre className="overflow-auto rounded-md border border-white/8 bg-black/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-300/90">
          {update.diff}
        </pre>
      )}
      {update.reason && <p className="text-[11px] text-white/45">{update.reason}</p>}
    </div>
  )
}

function InsightsPage() {
  const [settings, setSettings] = useState<MissionSettings | null>(null)
  const [doc, setDoc] = useState<OperatingDoc | null>(null)
  const [suppressions, setSuppressions] = useState<MissionSuppression[]>([])
  const [updates, setUpdates] = useState<OperatingDocUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [s, d, sup, upd] = await Promise.all([
        getMissionSettings(),
        getOperatingDoc(),
        getMissionSuppressions({ limit: 20 }),
        getOperatingDocUpdates(20),
      ])
      setSettings(s)
      setDoc(d)
      setSuppressions(sup)
      setUpdates(upd)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useRelayEvent("missions", reload)

  async function handleScan() {
    setScanning(true)
    try {
      await scanMissionsNow()
      // The relay emits a `missions` SSE event when the scan completes,
      // which triggers our subscribed `reload`. We just wait briefly so
      // the button shows spinning until at least one refresh happens.
      await new Promise((resolve) => setTimeout(resolve, 800))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.")
    } finally {
      setScanning(false)
    }
  }

  const suppressionsGrouped = useMemo(() => {
    const byScan = new Map<string, MissionSuppression[]>()
    for (const s of suppressions) {
      const list = byScan.get(s.scanId) ?? []
      list.push(s)
      byScan.set(s.scanId, list)
    }
    return [...byScan.entries()]
  }, [suppressions])

  if (loading && !doc) {
    return (
      <section className="px-6 py-5 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 py-16 text-[13px] text-white/40">
          <HugeIcon icon={Loading03Icon} size={14} className="animate-spin" />
          Loading insights...
        </div>
      </section>
    )
  }

  return (
    <section className="px-6 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {error && (
          <div className="rounded-md border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-[13px] text-rose-100/85">
            {error}
          </div>
        )}

        <ScanSummaryCard settings={settings} scanning={scanning} onScan={handleScan} />

        {doc && <OperatingDocEditor doc={doc} onSaved={setDoc} />}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium text-white/40">What Argus chose not to surface</p>
            <Badge variant="subtle" size="sm" className="text-[10px] text-white/55">
              {suppressions.length} suppression{suppressions.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {suppressionsGrouped.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 bg-black/30 px-4 py-4 text-[13px] text-white/40">
              No suppressions yet. After the next scan, Argus will show candidates it declined to surface, with reasons.
            </div>
          ) : (
            <div className="space-y-5">
              {suppressionsGrouped.map(([scanId, items]) => (
                <div key={scanId} className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-white/35">
                    <HugeIcon icon={SparklesIcon} size={12} />
                    <span>Scan {scanId.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{timeAgo(items[0].createdAt)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((s) => (
                      <SuppressionRow key={s.id} suppression={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {updates.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium text-white/40">Operating doc history</p>
              <Badge variant="subtle" size="sm" className="text-[10px] text-white/55">
                {updates.length} update{updates.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="space-y-2">
              {updates.map((u) => (
                <OperatingDocUpdateRow key={u.id} update={u} onReverted={setDoc} />
              ))}
            </div>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-white/30">
          <HugeIcon icon={ChartUpIcon} size={12} />
          Insights are a window into how the mission engine reasons about what reaches you.
        </p>
      </div>
    </section>
  )
}

export default InsightsPage

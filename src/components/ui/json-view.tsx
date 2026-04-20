import { Fragment, useMemo, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type JsonViewProps = {
  value: unknown
  /** Optional comment rendered above the JSON, prefixed with `// `. */
  comment?: string
  className?: string
  /** Inline style className applied to the outer <pre>. */
  preClassName?: string
  /** Max height classes (defaults match the mission signals styling). */
  maxHeightClassName?: string
}

/**
 * Renders a JSON value as a syntax-highlighted <pre> block.
 *
 * The highlighting regex is intentionally small; it only needs to handle the
 * JSON produced by `JSON.stringify(value, null, 2)`, which means well-formed
 * keys/values — no need to cope with comments, trailing commas, etc.
 */
function JsonView({ value, comment, className, preClassName, maxHeightClassName = "max-h-96" }: JsonViewProps) {
  const tokens = useMemo(() => tokenize(value), [value])

  return (
    <pre
      className={cn(
        "overflow-auto whitespace-pre-wrap bg-black/30 px-4 py-3 font-mono text-[11px] leading-relaxed text-white/70",
        maxHeightClassName,
        preClassName,
        className,
      )}
    >
      {comment && <span className="text-white/30">{`// ${comment}\n`}</span>}
      {tokens}
    </pre>
  )
}

function tokenize(value: unknown): ReactNode[] {
  const text = safeStringify(value)
  if (!text) return []

  const regex =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)/g

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIndex = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const [raw, key, str, num, bool, nul] = match
    if (key) {
      // The regex captures `"name":` including the colon; split so the
      // punctuation stays in the default-color stream.
      const colonAt = raw.lastIndexOf(":")
      const name = raw.slice(0, colonAt)
      const rest = raw.slice(colonAt)
      nodes.push(
        <span key={`k-${keyIndex++}`} className="text-cyan-300">
          {name}
        </span>,
      )
      nodes.push(rest)
    } else if (str) {
      nodes.push(
        <span key={`s-${keyIndex++}`} className="text-amber-200">
          {raw}
        </span>,
      )
    } else if (num) {
      nodes.push(
        <span key={`n-${keyIndex++}`} className="text-orange-300">
          {raw}
        </span>,
      )
    } else if (bool) {
      nodes.push(
        <span key={`b-${keyIndex++}`} className="text-violet-300">
          {raw}
        </span>,
      )
    } else if (nul) {
      nodes.push(
        <span key={`u-${keyIndex++}`} className="text-white/45">
          {raw}
        </span>,
      )
    }

    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.map((node, index) => (typeof node === "string" ? <Fragment key={`t-${index}`}>{node}</Fragment> : node))
}

function safeStringify(value: unknown): string {
  if (value === undefined) return ""
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    try {
      return String(value)
    } catch {
      return ""
    }
  }
}

/**
 * Parse a raw string that _might_ be JSON. Returns the parsed value when the
 * string starts with `{` or `[` and round-trips through `JSON.parse`,
 * otherwise returns `null`. Intended for agent responses that sometimes return
 * free text and sometimes structured JSON.
 */
function tryParseJson(raw: string | null | undefined): unknown {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

export { JsonView, tryParseJson }

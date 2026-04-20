function cleanAgentText(raw: string) {
  const trimmed = raw.trim()
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()
  }
  return trimmed
}

/**
 * Extracts a JSON object from a possibly noisy agent response.
 *
 * Agent CLIs frequently wrap JSON in markdown fences or emit leading/trailing
 * prose. This helper tries the cleaned response first, then falls back to the
 * first `{...}` block matched via regex.
 */
function extractAgentJson<T = unknown>(raw: string): T | null {
  const cleaned = cleanAgentText(raw)

  const attempts = [cleaned]
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch && objectMatch[0] !== cleaned) {
    attempts.push(objectMatch[0])
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      // try next parse strategy
    }
  }

  return null
}

export { extractAgentJson }

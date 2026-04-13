const CRON_LABELS: Record<string, string> = {
  "0 * * * *": "Every hour",
  "0 9 * * *": "Daily at 9 AM",
  "0 9 * * 1-5": "Weekdays at 9 AM",
  "0 9 * * 1": "Weekly on Monday",
  "0 9 1 * *": "Monthly on the 1st",
}

function humanCron(expression: string) {
  return CRON_LABELS[expression] ?? expression
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function relativeTime(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}

export { CRON_LABELS, humanCron, relativeTime, timeAgo }

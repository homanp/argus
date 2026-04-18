type Frequency = "hourly" | "daily" | "weekdays" | "weekly" | "monthly"

const FREQUENCY_LABELS: Record<Frequency, string> = {
  hourly: "Every hour",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  monthly: "Every month",
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function buildCronExpression(
  frequency: Frequency,
  hour: number,
  minute: number,
  dayOfWeek: number,
  dayOfMonth: number,
): string {
  const m = String(minute)
  const h = String(hour)

  switch (frequency) {
    case "hourly":
      return `${m} * * * *`
    case "daily":
      return `${m} ${h} * * *`
    case "weekdays":
      return `${m} ${h} * * 1-5`
    case "weekly":
      return `${m} ${h} * * ${dayOfWeek}`
    case "monthly":
      return `${m} ${h} ${dayOfMonth} * *`
  }
}

function parseCronToFields(expression: string): {
  frequency: Frequency
  hour: number
  minute: number
  dayOfWeek: number
  dayOfMonth: number
} | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minuteStr, hourStr, dom, , dow] = parts
  const minute = Number(minuteStr)
  const hour = hourStr === "*" ? 9 : Number(hourStr)

  if (minuteStr !== "0" && minuteStr !== String(minute)) return null

  if (hourStr === "*" && dom === "*" && dow === "*") {
    return { frequency: "hourly", hour: 9, minute, dayOfWeek: 1, dayOfMonth: 1 }
  }
  if (dom === "*" && dow === "*") {
    return { frequency: "daily", hour, minute, dayOfWeek: 1, dayOfMonth: 1 }
  }
  if (dom === "*" && dow === "1-5") {
    return { frequency: "weekdays", hour, minute, dayOfWeek: 1, dayOfMonth: 1 }
  }
  if (dom === "*" && /^[0-6]$/.test(dow)) {
    return { frequency: "weekly", hour, minute, dayOfWeek: Number(dow), dayOfMonth: 1 }
  }
  if (/^\d{1,2}$/.test(dom) && dow === "*") {
    return { frequency: "monthly", hour, minute, dayOfWeek: 1, dayOfMonth: Number(dom) }
  }

  return null
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function formatTime12(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const h = hour % 12 || 12
  return minute === 0 ? `${h} ${period}` : `${h}:${pad2(minute)} ${period}`
}

function describeCron(expression: string): string {
  const parsed = parseCronToFields(expression)
  if (!parsed) return expression

  const { frequency, hour, minute, dayOfWeek, dayOfMonth } = parsed
  const time = formatTime12(hour, minute)

  switch (frequency) {
    case "hourly":
      return minute === 0 ? "Every hour, on the hour" : `Every hour, at minute ${minute}`
    case "daily":
      return `Every day at ${time}`
    case "weekdays":
      return `Every weekday at ${time}`
    case "weekly":
      return `Every ${DAY_LABELS[dayOfWeek]} at ${time}`
    case "monthly": {
      const suffix = dayOfMonth === 1 ? "st" : dayOfMonth === 2 ? "nd" : dayOfMonth === 3 ? "rd" : "th"
      return `Monthly on the ${dayOfMonth}${suffix} at ${time}`
    }
  }
}

function humanCron(expression: string) {
  return describeCron(expression)
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

function duration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
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

export {
  buildCronExpression,
  DAY_LABELS,
  describeCron,
  duration,
  FREQUENCY_LABELS,
  humanCron,
  pad2,
  parseCronToFields,
  relativeTime,
  timeAgo,
}
export type { Frequency }

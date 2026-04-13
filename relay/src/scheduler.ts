import { eq, and, lte } from "drizzle-orm"
import { CronExpressionParser } from "cron-parser"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"

import type * as schema from "./db/schema.js"
import { schedules, scheduleExecutions } from "./db/schema.js"

type DB = BetterSQLite3Database<typeof schema>
type ScheduleRow = typeof schedules.$inferSelect

const TICK_INTERVAL_MS = 30_000

export function computeNextRunAt(cronExpression: string, timezone: string, after?: Date): string | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      tz: timezone,
      currentDate: after ?? new Date(),
    })
    return interval.next().toISOString()
  } catch {
    return null
  }
}

export function isValidCron(expression: string): boolean {
  try {
    CronExpressionParser.parse(expression)
    return true
  } catch {
    return false
  }
}

function refreshStaleSchedules(db: DB) {
  const now = new Date()
  const enabledSchedules: ScheduleRow[] = db.select().from(schedules).where(eq(schedules.enabled, true)).all()

  for (const schedule of enabledSchedules) {
    if (!schedule.nextRunAt || new Date(schedule.nextRunAt) <= now) {
      const nextRunAt = computeNextRunAt(schedule.cronExpression, schedule.timezone, now)
      if (nextRunAt) {
        db.update(schedules).set({ nextRunAt, updatedAt: now.toISOString() }).where(eq(schedules.id, schedule.id)).run()
      }
    }
  }
}

function tick(db: DB) {
  const timestamp = new Date().toISOString()

  const dueSchedules: ScheduleRow[] = db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, timestamp)))
    .all()

  if (dueSchedules.length === 0) return

  for (const schedule of dueSchedules) {
    try {
      db.insert(scheduleExecutions)
        .values({
          scheduleId: schedule.id,
          status: "completed",
          startedAt: timestamp,
          finishedAt: timestamp,
          resultMessage: `Scheduled prompt ready: ${schedule.prompt.slice(0, 200)}`,
        })
        .run()

      const nextRunAt = computeNextRunAt(schedule.cronExpression, schedule.timezone, new Date(timestamp))

      db.update(schedules)
        .set({ lastRunAt: timestamp, nextRunAt, updatedAt: timestamp })
        .where(eq(schedules.id, schedule.id))
        .run()

      console.log(`Schedule "${schedule.name}" fired`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Schedule "${schedule.name}" failed: ${message}`)
    }
  }
}

export function startScheduler(db: DB) {
  refreshStaleSchedules(db)

  const timer = setInterval(() => {
    try {
      tick(db)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Scheduler tick failed: ${message}`)
    }
  }, TICK_INTERVAL_MS)

  const enabledCount = db.select().from(schedules).where(eq(schedules.enabled, true)).all().length

  console.log(
    `Scheduler started (${enabledCount} active schedule${enabledCount !== 1 ? "s" : ""}, tick every ${TICK_INTERVAL_MS / 1000}s)`,
  )

  return timer
}

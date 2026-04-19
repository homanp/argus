import { EventEmitter } from "node:events"
import type { Response } from "express"

/**
 * Topics the relay publishes on. Clients subscribe to the ones that affect
 * data they render and refetch the relevant endpoint on receipt — a classic
 * "server-sent invalidation" pattern, no event payloads needed beyond the
 * topic name.
 */
type EventTopic = "missions" | "triggers" | "schedules" | "channels" | "agent"

const emitter = new EventEmitter()
// Unlimited subscribers — each open tab is one listener per topic.
emitter.setMaxListeners(0)

function emitEvent(topic: EventTopic) {
  emitter.emit(topic, topic)
}

/**
 * Attaches an Express response to the broadcaster as an SSE stream. Sends a
 * 15-second heartbeat so intermediaries don't drop the connection, and cleans
 * up listeners when the client disconnects.
 */
function subscribeToEvents(res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Needed for nginx-style proxies to avoid buffering, harmless elsewhere.
    "X-Accel-Buffering": "no",
  })
  // Initial retry hint + hello event so the browser knows the stream is live.
  res.write(`retry: 5000\n`)
  res.write(`event: ready\ndata: {}\n\n`)

  const topics: EventTopic[] = ["missions", "triggers", "schedules", "channels", "agent"]

  const handlers = topics.map((topic) => {
    const handler = () => {
      res.write(`event: ${topic}\ndata: {}\n\n`)
    }
    emitter.on(topic, handler)
    return { topic, handler }
  })

  const heartbeat = setInterval(() => {
    // Comment lines are ignored by EventSource but keep the socket warm.
    res.write(`: heartbeat\n\n`)
  }, 15_000)

  const cleanup = () => {
    clearInterval(heartbeat)
    for (const { topic, handler } of handlers) {
      emitter.off(topic, handler)
    }
  }

  res.on("close", cleanup)
  res.on("error", cleanup)
}

export { emitEvent, subscribeToEvents }
export type { EventTopic }

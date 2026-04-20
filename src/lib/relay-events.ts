import { useEffect } from "react"

import { RELAY_BASE_URL } from "@/lib/relay-api"

type EventTopic = "missions" | "triggers" | "schedules" | "channels" | "agent"

type Listener = () => void

/**
 * One EventSource per tab, shared across every component that subscribes.
 * EventSource auto-reconnects on transient network failures; we register
 * handlers through `addEventListener` per topic so React components can
 * subscribe/unsubscribe freely.
 */
let source: EventSource | null = null
const listeners = new Map<EventTopic, Set<Listener>>()

function ensureSource() {
  if (source || typeof window === "undefined") return source

  const es = new EventSource(`${RELAY_BASE_URL}/api/events`)
  source = es

  const topics: EventTopic[] = ["missions", "triggers", "schedules", "channels", "agent"]
  for (const topic of topics) {
    es.addEventListener(topic, () => {
      const set = listeners.get(topic)
      if (!set) return
      for (const fn of set) {
        try {
          fn()
        } catch (err) {
          console.error(`[relay-events] ${topic} listener error:`, err)
        }
      }
    })
  }

  // EventSource will automatically retry on error, but we log so the user
  // (or a future debug panel) can tell the stream is unhealthy.
  es.addEventListener("error", () => {
    // Intentionally quiet — EventSource will reconnect on its own with the
    // `retry` value the server sent. Noisy logs during reload aren't useful.
  })

  return es
}

/**
 * Subscribe to a relay event topic. The listener fires every time the server
 * reports that the matching data changed; it receives no payload — the
 * convention is to invalidate local state and refetch from the API.
 *
 * Component-friendly: use via `useRelayEvent(topic, callback)` which handles
 * subscribe/unsubscribe across the component lifecycle.
 */
function subscribe(topic: EventTopic, listener: Listener): () => void {
  ensureSource()
  let set = listeners.get(topic)
  if (!set) {
    set = new Set()
    listeners.set(topic, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
  }
}

function useRelayEvent(topic: EventTopic, callback: Listener) {
  // The callback is captured by identity — callers should wrap in
  // `useCallback` when they need stable references across renders.
  useEffect(() => {
    return subscribe(topic, callback)
  }, [topic, callback])
}

export { subscribe, useRelayEvent }
export type { EventTopic }

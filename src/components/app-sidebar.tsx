"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { Alert02Icon, GithubIcon, MoreHorizontalIcon, Settings01Icon } from "@hugeicons/core-free-icons"

import { HugeIcon } from "@/components/ui/huge-icon"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarResizeHandle,
} from "@/components/ui/sidebar"
import { primaryNavigation, workspaceNavigation } from "@/lib/app-shell-data"
import { getAgent, getChannels, getMissions, getRecentSessions, getSchedules, getTriggers } from "@/lib/relay-api"
import type { RecentSession } from "@/lib/relay-api"
import { useRelayEvent } from "@/lib/relay-events"
import { timeAgo } from "@/lib/schedule-utils"
import { cn } from "@/lib/utils"

function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navigate = useNavigate()
  const isActivePath = (href?: string) => Boolean(href) && (pathname === href || pathname.startsWith(`${href}/`))

  const [triggerCount, setTriggerCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [scheduleCount, setScheduleCount] = useState<number | null>(null)
  const [missionCount, setMissionCount] = useState<number | null>(null)
  const [agentConfigured, setAgentConfigured] = useState<boolean | null>(null)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [sessionsExpanded, setSessionsExpanded] = useState(false)

  const refreshMissions = useCallback(() => {
    getMissions()
      .then((data) => setMissionCount(data.filter((item) => item.status === "awaiting_decision").length))
      .catch(() => {})
  }, [])
  const refreshTriggers = useCallback(() => {
    getTriggers()
      .then((data) => setTriggerCount(data.length))
      .catch(() => {})
  }, [])
  const refreshSchedules = useCallback(() => {
    getSchedules()
      .then((data) => setScheduleCount(data.length))
      .catch(() => {})
  }, [])
  const refreshChannels = useCallback(() => {
    getChannels()
      .then((data) => setChannelCount(data.filter((item) => item.status === "connected").length))
      .catch(() => {})
  }, [])
  const refreshAgent = useCallback(() => {
    getAgent()
      .then((data) => setAgentConfigured(data !== null))
      .catch(() => {})
  }, [])
  const refreshSessions = useCallback(() => {
    getRecentSessions()
      .then(setRecentSessions)
      .catch(() => {})
  }, [])

  // Initial load — one fetch per domain. SSE takes over after this; no
  // polling interval. `pathname` is still a dependency so hard navigation
  // between top-level views refreshes stale counts immediately.
  useEffect(() => {
    refreshMissions()
    refreshTriggers()
    refreshSchedules()
    refreshChannels()
    refreshAgent()
    refreshSessions()
  }, [pathname, refreshAgent, refreshChannels, refreshMissions, refreshSchedules, refreshSessions, refreshTriggers])

  useRelayEvent("missions", refreshMissions)
  useRelayEvent("triggers", refreshTriggers)
  useRelayEvent("schedules", refreshSchedules)
  useRelayEvent("channels", refreshChannels)
  useRelayEvent("agent", refreshAgent)
  // Recent sessions reflect mission + trigger + schedule activity, so any
  // of those events should refresh the list.
  useRelayEvent("missions", refreshSessions)
  useRelayEvent("triggers", refreshSessions)
  useRelayEvent("schedules", refreshSessions)

  const resolvedPrimaryNav = useMemo(
    () =>
      primaryNavigation.map((item) => {
        if (item.title === "Missions" && missionCount !== null) {
          return { ...item, count: String(missionCount) }
        }
        return item
      }),
    [missionCount],
  )

  const resolvedWorkspaceNav = useMemo(
    () =>
      workspaceNavigation.map((item) => {
        if (item.title === "Triggers" && triggerCount !== null) return { ...item, count: String(triggerCount) }
        if (item.title === "Channels" && channelCount !== null) return { ...item, count: String(channelCount) }
        if (item.title === "Schedules" && scheduleCount !== null) return { ...item, count: String(scheduleCount) }
        if (item.title === "Agents" && agentConfigured === false) return { ...item, warning: true }
        return item
      }),
    [triggerCount, channelCount, scheduleCount, agentConfigured],
  )

  return (
    <Sidebar className="pt-11">
      <SidebarContent className="pt-1 pb-2">
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            {resolvedPrimaryNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.href ? (
                  <SidebarMenuButton
                    render={<Link to={item.href} />}
                    isActive={isActivePath(item.href)}
                    className="h-7 rounded-md px-2.5 text-[13px] text-white/78 data-active:bg-white/8 data-active:text-white hover:bg-white/5 hover:text-white"
                    tooltip={item.title}
                  >
                    <HugeIcon icon={item.icon} size={16} className="text-white/55 data-[active=true]:text-white" />
                    <span>{item.title}</span>
                    {item.count ? (
                      <span
                        className={cn(
                          "ml-auto text-[11px] tabular-nums text-white/40",
                          item.highlighted && "text-white/70",
                        )}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    className="h-7 rounded-md px-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
                    tooltip={item.title}
                  >
                    <HugeIcon icon={item.icon} size={16} className="text-white/50" />
                    <span>{item.title}</span>
                    {item.count ? (
                      <span className="ml-auto text-[11px] tabular-nums text-white/40">{item.count}</span>
                    ) : null}
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="px-1 pb-2 text-[11px] font-medium tracking-[0.02em] text-white/35">
            Workspace
          </SidebarGroupLabel>
          <SidebarMenu>
            {resolvedWorkspaceNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.href ? (
                  <SidebarMenuButton
                    render={<Link to={item.href} />}
                    isActive={isActivePath(item.href)}
                    className="h-7 rounded-md px-2.5 text-[13px] text-white/70 data-active:bg-white/8 data-active:text-white hover:bg-white/5 hover:text-white"
                    tooltip={item.title}
                  >
                    <HugeIcon icon={item.icon} size={16} className="text-white/50 data-[active=true]:text-white" />
                    <span>{item.title}</span>
                    {item.warning ? (
                      <span className="ml-auto text-amber-400" title="No agent configured">
                        <HugeIcon icon={Alert02Icon} size={14} />
                      </span>
                    ) : item.count ? (
                      <span className="ml-auto text-[11px] tabular-nums text-white/40">{item.count}</span>
                    ) : null}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    className="h-7 rounded-md px-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
                    tooltip={item.title}
                  >
                    <HugeIcon icon={item.icon} size={16} className="text-white/50" />
                    <span>{item.title}</span>
                    {item.count ? (
                      <span className="ml-auto text-[11px] tabular-nums text-white/40">{item.count}</span>
                    ) : null}
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="px-1 pb-2 text-[11px] font-medium tracking-[0.02em] text-white/35">
            Recent sessions
          </SidebarGroupLabel>
          <SidebarMenu>
            {recentSessions.length === 0 ? (
              <li className="px-1 py-1 text-[12px] text-white/25">No recent sessions</li>
            ) : (
              <>
                {(sessionsExpanded ? recentSessions : recentSessions.slice(0, 5)).map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      onClick={() =>
                        session.type === "trigger"
                          ? navigate({ to: "/triggers/$triggerId", params: { triggerId: session.sourceId } })
                          : session.type === "mission"
                            ? navigate({ to: "/missions/$missionId", params: { missionId: session.sourceId } })
                            : navigate({ to: "/schedules/$scheduleId", params: { scheduleId: session.sourceId } })
                      }
                      className="h-7 rounded-md px-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          session.status === "running" &&
                            "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse",
                          session.status === "completed" && "bg-emerald-400",
                          session.status === "failed" && "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]",
                          session.status === "matched" && "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
                        )}
                      />
                      <span className="truncate">{session.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-white/25">{timeAgo(session.startedAt)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {recentSessions.length > 5 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setSessionsExpanded((v) => !v)}
                      className="h-7 rounded-md px-2.5 text-[11px] text-white/30 hover:bg-white/5 hover:text-white"
                    >
                      <HugeIcon icon={MoreHorizontalIcon} size={14} className="text-white/30" />
                      <span>{sessionsExpanded ? "Show less" : "More"}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-white/30">
            Argus <span className="text-white/20">v0.1.0-alpha</span>
          </span>
          <div className="flex items-center gap-0.5">
            <button className="flex size-6 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/60">
              <HugeIcon icon={GithubIcon} size={14} />
            </button>
            <button className="flex size-6 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/60">
              <HugeIcon icon={Settings01Icon} size={14} />
            </button>
          </div>
        </div>
      </SidebarFooter>

      <SidebarResizeHandle />
    </Sidebar>
  )
}

export { AppSidebar }

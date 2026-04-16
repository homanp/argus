"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { Alert02Icon, GithubIcon, Settings01Icon } from "@hugeicons/core-free-icons"

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
import { openTasks, primaryNavigation, workspaceNavigation } from "@/lib/app-shell-data"
import { getAgent, getChannels, getSchedules, getTriggers } from "@/lib/relay-api"
import { cn } from "@/lib/utils"

function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isActivePath = (href?: string) => Boolean(href) && (pathname === href || pathname.startsWith(`${href}/`))

  const [triggerCount, setTriggerCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [scheduleCount, setScheduleCount] = useState<number | null>(null)
  const [agentConfigured, setAgentConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getTriggers()
      .then((data) => {
        if (!cancelled) setTriggerCount(data.length)
      })
      .catch(() => {})
    getSchedules()
      .then((data) => {
        if (!cancelled) setScheduleCount(data.length)
      })
      .catch(() => {})
    getChannels()
      .then((data) => {
        if (!cancelled) setChannelCount(data.filter((item) => item.status === "connected").length)
      })
      .catch(() => {})
    getAgent()
      .then((data) => {
        if (!cancelled) setAgentConfigured(data !== null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

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
    <Sidebar className="border-white/8 pt-9">
      <SidebarContent className="pt-1 pb-2">
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            {primaryNavigation.map((item) => (
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
            Open tasks
          </SidebarGroupLabel>
          <SidebarMenu>
            {openTasks.map((task) => (
              <SidebarMenuItem key={task.title}>
                <SidebarMenuButton className="h-7 rounded-md px-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white">
                  <span className={cn("size-2 rounded-full", task.toneClassName)} />
                  <span>{task.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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

import type { CSSProperties } from "react"

import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import {
  ActivitySparkIcon,
  Add01Icon,
  ArrowLeft02Icon,
  ConnectIcon,
  Search01Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons"

import { Link } from "@tanstack/react-router"

import App from "@/App"
import { AppSidebar } from "@/components/app-sidebar"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { missionsHeader } from "@/lib/app-shell-data"
import { integrationCatalog } from "@/lib/integration-catalog"
import IntegrationDetailPage from "@/pages/integration-detail-page"
import IntegrationsPage from "@/pages/integrations-page"
import TriggerDetailPage from "@/pages/trigger-detail-page"
import TriggersPage from "@/pages/triggers-page"

const routeHeaderMap = {
  "/": {
    ...missionsHeader,
    icon: ActivitySparkIcon,
  },
  "/connectors": {
    title: "Connectors",
    subtitle: "Catalog, setup, and webhook configuration",
    icon: ConnectIcon,
  },
  "/triggers": {
    title: "Triggers",
    subtitle: "Reactive rules for incoming webhook events",
    icon: ZapIcon,
  },
} as const

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isConnectorsRoute = pathname === "/connectors" || pathname.startsWith("/connectors/")
  const isTriggersRoute = pathname === "/triggers" || pathname.startsWith("/triggers/")
  const isTriggersDetail = pathname.startsWith("/triggers/") && pathname !== "/triggers"
  const header = pathname.startsWith("/connectors/")
    ? {
        title: "Connector detail",
        subtitle: "Setup, webhook configuration, and testing",
        icon: ConnectIcon,
      }
    : isTriggersDetail
      ? {
          title: "Trigger detail",
          subtitle: "Configuration and execution history",
          icon: ZapIcon,
        }
      : (routeHeaderMap[pathname as keyof typeof routeHeaderMap] ?? routeHeaderMap["/"])

  const providerSlug = pathname.startsWith("/connectors/") ? pathname.split("/").filter(Boolean)[1] : null
  const providerTitle = providerSlug
    ? (integrationCatalog.find((item) => item.provider === providerSlug)?.title ?? providerSlug)
    : null

  return (
    <div className="relative min-h-svh">
      <div data-tauri-drag-region className="fixed inset-x-0 top-0 z-40 h-8" />
      <SidebarProvider
        defaultOpen
        className="min-h-svh flex-1"
        style={
          {
            "--sidebar-width": "13.75rem",
            "--sidebar-width-icon": "3.5rem",
          } as CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden bg-transparent pt-0">
          <header className="z-50 flex h-11 shrink-0 items-center justify-between border-b border-white/8 bg-transparent px-4 backdrop-blur-xl md:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="size-6 rounded-sm p-0 text-white/35 hover:bg-white/[0.03] hover:text-white/70 md:hidden" />
              {providerTitle || isTriggersDetail ? (
                <Link
                  to={isTriggersDetail ? "/triggers" : "/connectors"}
                  className="flex size-6 items-center justify-center rounded-md border border-white/10 text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/80"
                >
                  <HugeIcon icon={ArrowLeft02Icon} size={14} />
                </Link>
              ) : (
                <HugeIcon icon={header.icon} size={12} className="text-white/35" />
              )}
              <nav className="flex min-w-0 items-center gap-1 text-[12px]">
                {isConnectorsRoute ? (
                  <>
                    <Link
                      to="/connectors"
                      className={`font-medium transition-colors ${providerTitle ? "text-white/45 hover:text-white/70" : "text-white"}`}
                    >
                      Connectors
                    </Link>
                    {providerTitle ? (
                      <>
                        <span className="text-white/20">/</span>
                        <p className="truncate font-medium text-white">{providerTitle}</p>
                        <span
                          id="connector-status-badge"
                          className="ml-1 hidden rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/40"
                        />
                      </>
                    ) : null}
                  </>
                ) : isTriggersRoute ? (
                  <>
                    <Link
                      to="/triggers"
                      className={`font-medium transition-colors ${isTriggersDetail ? "text-white/45 hover:text-white/70" : "text-white"}`}
                    >
                      Triggers
                    </Link>
                    {isTriggersDetail ? (
                      <>
                        <span className="text-white/20">/</span>
                        <p id="trigger-detail-name" className="truncate font-medium text-white">
                          Detail
                        </p>
                        <span
                          id="trigger-detail-status"
                          className="ml-1 hidden rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/40"
                        />
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-white">{header.title}</p>
                    <p className="truncate text-[11px] text-white/30">{header.subtitle}</p>
                  </>
                )}
              </nav>
            </div>

            <div className="hidden items-center gap-1 md:flex">
              {pathname === "/connectors" && (
                <div className="relative">
                  <HugeIcon
                    icon={Search01Icon}
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-white/35"
                  />
                  <Input
                    placeholder="Search connectors..."
                    className="h-7 w-52 rounded-md border-white/8 bg-white/[0.03] pl-8 !text-[12px] text-white/70 placeholder:text-white/30"
                  />
                </div>
              )}
              {pathname === "/triggers" && (
                <>
                  <div className="relative">
                    <HugeIcon
                      icon={Search01Icon}
                      size={14}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-white/35"
                    />
                    <Input
                      placeholder="Search triggers..."
                      className="h-7 w-52 rounded-md border-white/8 bg-white/[0.03] pl-8 !text-[12px] text-white/70 placeholder:text-white/30"
                      onChange={(e) =>
                        window.dispatchEvent(new CustomEvent("argus:trigger-search", { detail: e.currentTarget.value }))
                      }
                    />
                  </div>
                  <Button
                    onClick={() => window.dispatchEvent(new CustomEvent("argus:new-trigger"))}
                    className="h-7 gap-1.5 rounded-md bg-violet-300 px-2.5 text-[11px] font-medium text-violet-950 hover:bg-violet-200"
                  >
                    <HugeIcon icon={Add01Icon} size={12} />
                    New trigger
                  </Button>
                </>
              )}
              {providerTitle && (
                <Button
                  variant="outline"
                  onClick={() => window.dispatchEvent(new CustomEvent("argus:delete-connector"))}
                  className="border-white/10 bg-transparent text-[11px] font-normal text-rose-300/60 hover:bg-rose-400/10 hover:text-rose-300"
                >
                  Delete
                </Button>
              )}
              {isTriggersDetail && (
                <ButtonGroup>
                  <Button
                    variant="outline"
                    onClick={() => window.dispatchEvent(new CustomEvent("argus:edit-trigger"))}
                    className="border-white/10 bg-transparent text-[11px] font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.dispatchEvent(new CustomEvent("argus:delete-trigger"))}
                    className="border-white/10 bg-transparent text-[11px] font-normal text-rose-300/60 hover:bg-rose-400/10 hover:text-rose-300"
                  >
                    Delete
                  </Button>
                </ButtonGroup>
              )}
              {pathname === "/" && (
                <>
                  <Button
                    variant="ghost"
                    className="h-7 rounded-md px-2.5 text-[11px] font-normal text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                  >
                    Filter
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 rounded-md px-2.5 text-[11px] font-normal text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                  >
                    Mark all reviewed
                  </Button>
                </>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
})

const connectorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connectors",
  component: IntegrationsPage,
})

const connectorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connectors/$provider",
  component: IntegrationDetailPage,
})

const triggersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/triggers",
  component: TriggersPage,
})

const triggerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/triggers/$triggerId",
  component: TriggerDetailPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  connectorsRoute,
  connectorDetailRoute,
  triggersRoute,
  triggerDetailRoute,
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

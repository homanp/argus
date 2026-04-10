import type { CSSProperties } from "react"

import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"
import { ActivitySparkIcon } from "@hugeicons/core-free-icons"

import App from "@/App"
import { AppSidebar } from "@/components/app-sidebar"
import { HugeIcon } from "@/components/ui/huge-icon"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { signalsHeader } from "@/lib/app-shell-data"

function RootLayout() {
  return (
    <div className="relative min-h-svh">
      <div data-tauri-drag-region className="fixed inset-x-0 top-0 z-50 h-8" />
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
          <header className="z-10 flex h-11 shrink-0 items-center justify-between border-b border-white/8 bg-transparent px-4 backdrop-blur-xl md:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="size-6 rounded-sm p-0 text-white/35 hover:bg-white/[0.03] hover:text-white/70 md:hidden" />
              <HugeIcon icon={ActivitySparkIcon} size={12} className="text-white/35" />
              <div className="flex min-w-0 items-center gap-2 text-[12px]">
                <p className="font-medium text-white">{signalsHeader.title}</p>
                <p className="truncate text-[11px] text-white/30">{signalsHeader.subtitle}</p>
              </div>
            </div>

            <div className="hidden items-center gap-1 md:flex">
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

const routeTree = rootRoute.addChildren([indexRoute])

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

import {
  Link,
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import App from "@/App"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import AboutPage from "@/pages/about-page"

const navLinkClassName = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:hover:bg-primary/90"
)

function RootLayout() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-background via-background to-muted/40">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <div>
            <p className="text-sm font-medium text-foreground">Argus</p>
            <p className="text-sm text-muted-foreground">TanStack Router with hash history</p>
          </div>

          <nav className="flex items-center gap-2">
            <Link to="/" className={navLinkClassName} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/about" className={navLinkClassName} activeOptions={{ exact: true }}>
              About
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />
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

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: AboutPage,
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

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

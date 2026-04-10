import { ArrowUpRight, MonitorSmartphone, PanelsTopLeft, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const stack = ["Tauri 2", "React", "Vite", "TypeScript", "shadcn/ui"]

const highlights = [
  {
    title: "Desktop-ready foundation",
    description: "Rust and Tauri are configured, so `npm run tauri dev` launches the app shell in a native window.",
    icon: MonitorSmartphone,
  },
  {
    title: "Modern frontend stack",
    description: "React, Vite, and TypeScript are wired with a fixed dev port and Tauri-friendly build settings.",
    icon: PanelsTopLeft,
  },
  {
    title: "Design system included",
    description: "Tailwind CSS v4 and shadcn/ui are ready for additional components and app-specific styling.",
    icon: Sparkles,
  },
]

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

function App() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-6 py-10 sm:px-10">
      <section className="space-y-5">
        <div className="inline-flex w-fit items-center rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground shadow-sm">
          Starter scaffold ready
        </div>

        <div className="space-y-3">
          <h1 className="max-w-3xl text-4xl font-heading font-semibold tracking-tight sm:text-5xl">
            Tauri 2 + shadcn/ui, wired and ready to build on.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            This scaffold gives you a native desktop shell backed by Rust, with a React and Vite frontend styled through
            Tailwind CSS v4 and shadcn/ui components.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {stack.map((item) => (
            <span key={item} className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
              {item}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => openExternal("https://v2.tauri.app")}>
            Tauri docs
            <ArrowUpRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => openExternal("https://ui.shadcn.com/docs")}>
            shadcn/ui docs
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Start editing <code className="rounded bg-muted px-1.5 py-0.5">src/router.tsx</code> and add more routed
                screens as your app grows.
              </p>
            </CardContent>
            <CardFooter>
              <span className="text-xs text-muted-foreground">Ready for your first feature.</span>
            </CardFooter>
          </Card>
        ))}
      </section>
    </main>
  )
}

export default App

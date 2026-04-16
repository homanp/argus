import { Hash, Route, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const notes = [
  {
    title: "Desktop-safe URLs",
    description:
      "Hash history keeps navigation self-contained in the webview, which makes Tauri packaging and reload behavior simpler.",
    icon: Hash,
  },
  {
    title: "Typed route APIs",
    description:
      "TanStack Router gives you type-safe paths, params, search state, and navigation calls as the app grows.",
    icon: Route,
  },
  {
    title: "Good default for Argus",
    description:
      "This setup is a strong foundation if you plan to add multiple views like settings, dashboards, or detail pages.",
    icon: ShieldCheck,
  },
]

function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <section className="space-y-3">
        <Badge className="w-fit bg-background px-3 py-1 text-sm text-muted-foreground shadow-sm">Routing layer</Badge>
        <h1 className="text-3xl font-heading font-semibold tracking-tight sm:text-4xl">
          TanStack Router is now the navigation layer for this app.
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
          The app uses a hash-based router so Tauri can treat the desktop shell as a single entry point while still
          giving you typed client-side navigation.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {notes.map(({ title, description, icon: Icon }) => (
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
                Routes are defined in <code className="rounded bg-muted px-1.5 py-0.5">src/router.tsx</code>.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}

export default AboutPage

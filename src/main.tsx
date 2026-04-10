import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./index.css"
import { router } from "./router"

document.documentElement.classList.add("dark")
document.body.classList.add("dark")
document.documentElement.style.colorScheme = "dark"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="min-h-svh bg-background text-foreground">
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </div>
  </StrictMode>,
)

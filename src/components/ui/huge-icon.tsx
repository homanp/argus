"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type HugeIconProps = {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  size?: number
  strokeWidth?: number
  className?: string
}

function HugeIcon({ icon, size = 18, strokeWidth = 1.6, className }: HugeIconProps) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={cn("shrink-0", className)} />
}

export { HugeIcon }

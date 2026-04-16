import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[min(var(--radius-md),10px)] border font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-white/10 bg-white/[0.04] text-white/45",
        success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
        danger: "border-rose-300/20 bg-rose-300/10 text-rose-200",
        violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
        subtle: "border-white/8 bg-white/[0.04] text-white/80",
      },
      size: {
        sm: "px-1.5 py-px text-[10px]",
        default: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  },
)

function Badge({
  className,
  variant,
  size,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }

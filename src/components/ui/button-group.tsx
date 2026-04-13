import * as React from "react"

import { cn } from "@/lib/utils"

function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn(
        "flex",
        orientation === "vertical" ? "flex-col" : "flex-row",
        "[&>*:not(:first-child):not(:last-child)]:rounded-none",
        orientation === "vertical"
          ? "[&>*:first-child:not(:last-child)]:rounded-b-none [&>*:last-child:not(:first-child)]:rounded-t-none"
          : "[&>*:first-child:not(:last-child)]:rounded-r-none [&>*:last-child:not(:first-child)]:rounded-l-none",
        "[&>*:not(:first-child)]:-ml-px",
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup }

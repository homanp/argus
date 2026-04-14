import { cn } from "@/lib/utils"

function TogglePill({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex h-5 w-9 items-center rounded-full border px-0.5 transition-colors",
        active ? "border-violet-300/40 bg-violet-300/90" : "border-white/10 bg-white/[0.08]",
        disabled && "opacity-50",
      )}
    >
      <div
        className={cn(
          "size-3.5 rounded-full bg-white transition-transform",
          active ? "translate-x-3.5" : "translate-x-0",
        )}
      />
    </button>
  )
}

export { TogglePill }

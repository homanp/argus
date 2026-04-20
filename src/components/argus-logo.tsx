import { cn } from "@/lib/utils"

function ArgusLogo({
  className,
  sizeClassName,
  markClassName,
  titleClassName,
  subtitleClassName,
  showWordmark = true,
  subtitle,
}: {
  className?: string
  sizeClassName?: string
  markClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  showWordmark?: boolean
  subtitle?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <div className={cn("flex flex-col items-center gap-3", sizeClassName ?? "w-36")}>
        <div className={cn("relative aspect-square w-full", markClassName)}>
          <div className="absolute inset-0 rounded-[24%] border border-white/12 bg-white/[0.05] shadow-[0_20px_56px_rgba(0,0,0,0.22)]" />
          <div className="absolute inset-[4.5%] overflow-hidden rounded-[21%] border border-white/8 bg-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.35)]">
            <img src="/argus.png" alt="Argus" draggable={false} className="h-full w-full object-cover" />
          </div>
        </div>
        {showWordmark ? (
          <div className="w-full space-y-2">
            <p
              className={cn(
                "w-full text-[30px] font-semibold leading-none tracking-[-0.06em] text-white",
                titleClassName,
              )}
            >
              Argus
            </p>
            {subtitle ? <p className={cn("text-[13px] text-white/45", subtitleClassName)}>{subtitle}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { ArgusLogo }

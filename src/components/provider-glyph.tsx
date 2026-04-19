import { HugeIcon } from "@/components/ui/huge-icon"
import { brandImageForProvider, iconForProvider } from "@/lib/app-shell-data"
import { cn } from "@/lib/utils"

/**
 * Renders the brand logo for a known provider (GitHub, Slack, Telegram,
 * WhatsApp, Resend) when we have one bundled in /public, falling back to the
 * HugeIcon glyph from `iconForProvider` otherwise. Designed to drop into
 * badges and other small-icon slots without changing layout.
 */
function ProviderGlyph({
  provider,
  size = 14,
  className,
  iconClassName,
}: {
  provider: string
  size?: number
  /** Applied to the outer element regardless of brand-image vs hugeicon path. */
  className?: string
  /** Applied only when we fall back to the HugeIcon (controls color tint). */
  iconClassName?: string
}) {
  const brandImage = brandImageForProvider(provider)
  if (brandImage) {
    return (
      <img
        src={brandImage}
        alt=""
        aria-hidden
        className={cn("shrink-0", className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return <HugeIcon icon={iconForProvider(provider)} size={size} className={cn(iconClassName, className)} />
}

export { ProviderGlyph }

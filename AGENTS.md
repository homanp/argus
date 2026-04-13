# Agents

Conventions for AI agents working in this codebase.

## UI conventions

### Page actions belong in the navbar

Primary actions for a view (e.g. "New trigger", "New connector") must be placed in
the top navbar header bar (`RootLayout` in `src/router.tsx`), **not** inside the
page component body. The navbar renders route-specific actions on the right side
based on the current pathname.

Pages that need to respond to navbar actions should listen for custom events on
`window` (e.g. `argus:new-trigger`) rather than managing their own action buttons
at the top of the page content area.

This keeps the action surface consistent across all views and prevents duplicate
or floating buttons inside page content.

### Sizing: use the small scale everywhere

Buttons use the default size from `button.tsx` which is `h-7` (28px). Do not use
`size="lg"` or raw `h-8`/`h-9` overrides — the app is dense and dark, larger
elements look out of place.

Text sizes follow this scale:

- `text-[11px]` — button labels, metadata, tiny badges
- `text-[12px]` — form labels, secondary metadata, card stats
- `text-[13px]` — body text, descriptions, section headings, error/notice messages
- `text-lg` — page titles only (e.g. integration detail title)

Never use `text-sm` (14px) or `text-base` (16px) for body content. The same
applies to form elements: selects and textareas should use `h-7` / `text-[13px]`,
not the browser default sizing.

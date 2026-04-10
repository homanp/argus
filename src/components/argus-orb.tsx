function ArgusOrb() {
  return (
    <div className="relative size-5 shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_25%,#2a1d4f_0%,#0a0418_100%)] shadow-[0_0_14px_rgba(196,181,253,0.4),0_0_5px_rgba(196,181,253,0.2),inset_0_0.5px_1px_rgba(255,255,255,0.3),inset_0_-0.5px_1px_rgba(0,0,0,0.55),inset_0_0_0_0.5px_rgba(255,255,255,0.18)]">
      <div className="absolute -top-0.5 -left-0.5 size-3 rounded-full bg-pink-200/90 blur-[5px]" />
      <div className="absolute top-1 left-1 size-3 rounded-full bg-violet-300/90 blur-[5px]" />
      <div className="absolute top-1.5 -left-0.5 size-3 rounded-full bg-cyan-300/90 blur-[5px]" />
      <div className="absolute top-0.5 left-2 size-3 rounded-full bg-fuchsia-300/90 blur-[5px]" />
      <div className="absolute top-0.5 left-1.5 h-1 w-1.5 rounded-full bg-white/70 blur-[1px]" />
    </div>
  )
}

export { ArgusOrb }

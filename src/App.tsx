import { DecisionCard } from "@/components/decision-card"
import { decisionCards } from "@/lib/app-shell-data"

function App() {
  return (
    <section className="px-5 py-5 md:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {decisionCards.map((card) => (
          <DecisionCard key={card.id} card={card} />
        ))}

        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-center text-sm text-white/45">
          That's everything. Argus handled the rest.
        </div>
      </div>
    </section>
  )
}

export default App

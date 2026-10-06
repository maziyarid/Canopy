import type { InsightJournalView } from "../lib/server/insight-journal-view.ts";

type Props = {
  view: InsightJournalView;
  emptyLabel?: string;
};

export function InsightJournal({ view, emptyLabel = "No notes for this period." }: Props) {
  if (!view.days.length) {
    return <p data-testid="insight-journal-empty">{emptyLabel}</p>;
  }

  return (
    <section data-testid="insight-journal">
      {view.days.map((day) => (
        <article className="mb-4 grid gap-3" key={day.date} data-testid={`insight-day-${day.date}`}>
          <h3>{day.date}</h3>
          {day.cards.map((card) => (
            <div className="grid gap-1 rounded-xl bg-raised p-3 text-sm" key={card.id} data-testid={`insight-card-${card.id}`}>
              <p data-testid="insight-type">{card.type}</p>
              <h4 className="font-medium">{card.title}</h4>
              <p>{card.body}</p>
              <p className="text-xs text-muted" data-testid="insight-limitation">{card.limitation}</p>
              {card.recommendationDisposition === "proposal_only" ? (
                <p className="text-xs font-medium text-muted" data-testid="insight-disposition">
                  Proposal only — no automatic change
                </p>
              ) : null}
              {card.recommendedAction ? <p data-testid="insight-action">{card.recommendedAction}</p> : null}
              {card.metricNames.length ? (
                <p data-testid="insight-metrics">{card.metricNames.join(", ")}</p>
              ) : null}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

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
        <article key={day.date} data-testid={`insight-day-${day.date}`}>
          <h3>{day.date}</h3>
          {day.cards.map((card) => (
            <div key={card.id} data-testid={`insight-card-${card.id}`}>
              <p data-testid="insight-type">{card.type}</p>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
              <p data-testid="insight-limitation">{card.limitation}</p>
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

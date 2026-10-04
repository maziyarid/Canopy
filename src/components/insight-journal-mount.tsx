import { InsightJournal } from "./insight-journal.tsx";
import type { InsightJournalMountModel } from "../lib/server/insight-journal-mount.ts";

type Props = {
  model: InsightJournalMountModel;
};

export function InsightJournalMount({ model }: Props) {
  return (
    <div data-testid="insight-journal-mount">
      {model.warnings.map((warning) => (
        <p key={warning} data-testid="insight-journal-warning">
          {warning}
        </p>
      ))}
      {model.beside.map((group) => (
        <aside key={`${group.metricName}:${group.site}:${group.periodStart}:${group.periodEnd}`} data-testid={`insight-beside-${group.metricName}`}>
          {group.cards.map((card) => (
            <p key={card.id}>{card.title}</p>
          ))}
        </aside>
      ))}
      <InsightJournal view={model.journal} />
    </div>
  );
}

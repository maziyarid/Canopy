/** Opportunity = volume weighted by inverse difficulty and PPC competition. */
export function opportunityScore(volume: number, kd: number | null, ppc: number) {
  const difficulty = kd == null ? 45 : kd;
  const competition = Math.min(100, Math.max(0, ppc)) / 100;
  const raw = (volume / (difficulty + 8)) * (1 - competition * 0.45);
  return Math.round(raw * 10) / 10;
}

export function kdTone(kd: number | null): "good" | "warn" | "bad" | "muted" {
  if (kd == null) return "muted";
  if (kd < 30) return "good";
  if (kd < 50) return "warn";
  return "bad";
}

export function rankDelta(rank: number | null, prev: number | null) {
  if (rank == null || prev == null) return 0;
  return prev - rank;
}

export function formatVolume(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function formatCpc(n: number) {
  return `$${n.toFixed(2)}`;
}

export function sparkPath(values: number[], width = 72, height = 22) {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const CTR: Record<number, number> = {
  1: 0.31,
  2: 0.24,
  3: 0.18,
  4: 0.13,
  5: 0.09,
  6: 0.06,
  7: 0.05,
  8: 0.04,
  9: 0.035,
  10: 0.03,
};

export function estimatedCtr(rank: number | null) {
  if (rank == null || rank < 1) return 0;
  if (rank <= 10) return CTR[rank] ?? 0.03;
  if (rank <= 20) return 0.012;
  if (rank <= 30) return 0.004;
  return 0;
}

export function visibilityScore(
  rows: { rank: number | null; volume: number }[],
) {
  const total = rows.reduce((s, r) => s + r.volume, 0);
  if (!total) return 0;
  const captured = rows.reduce((s, r) => s + r.volume * estimatedCtr(r.rank), 0);
  return Math.round((captured / total) * 1000) / 10;
}

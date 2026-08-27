import { sparkPath } from "@/lib/score";

export function Spark({ values, className }: { values: number[]; className?: string }) {
  const d = sparkPath(values);
  if (!d) return <span className="text-subtle">—</span>;
  return (
    <svg viewBox="0 0 72 22" className={className ?? "h-5 w-[72px]"} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink-muted" />
    </svg>
  );
}

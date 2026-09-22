import { sparkPath } from "@/lib/score";

export function Spark({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-subtle">—</span>;
  const d = sparkPath(values);
  return (
    <svg viewBox="0 0 72 22" className="h-5 w-[72px]" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-primary" />
    </svg>
  );
}

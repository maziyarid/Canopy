export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-raised" />
      <circle cx="12" cy="17" r="7.2" fill="currentColor" className="text-accent" />
      <circle cx="20" cy="17" r="7.2" fill="currentColor" className="text-accent" />
      <circle cx="16" cy="12" r="7.4" fill="currentColor" className="text-accent" />
    </svg>
  );
}

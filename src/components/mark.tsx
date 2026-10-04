import { cn } from "@/lib/cn";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
      <path
        d="M7 23 L11.2 9 h2.1 L16 18.2 18.7 9 h2.1 L25 23 h-2.2 l-1.7-8.1 L18.7 23 h-1.6 l-2.4-8.1 L13 23 H7z"
        fill="#0F1724"
      />
      <path d="M20.6 9 L25 23" stroke="#A8FF4D" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

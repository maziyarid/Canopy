import { cn } from "@/lib/cn";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "paper" | "danger" | "quiet";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-9 rounded-sm px-3 text-sm",
        size === "md" && "h-10 rounded-md px-4 text-sm",
        size === "lg" && "h-11 rounded-md px-5 text-base",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "ghost" && "bg-raised text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        variant === "paper" && "bg-paper text-ink hover:opacity-90",
        variant === "danger" && "bg-bad/20 text-bad hover:opacity-90",
        variant === "quiet" && "text-muted hover:bg-raised hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg bg-raised px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "good" | "warn" | "bad" | "muted" | "accent" | "paper";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        tone === "good" && "bg-good/15 text-good",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "bad" && "bg-bad/15 text-bad",
        tone === "muted" && "bg-raised text-muted",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "paper" && "bg-paper/10 text-paper",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

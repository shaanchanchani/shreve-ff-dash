import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Status tags. The word carries the state, so nothing depends on colour alone;
 * the border tint is reinforcement, not the message.
 */
export type TagVariant =
  | "neutral"
  | "settled"
  | "open"
  | "signal"
  | "alert"
  | "out"
  | "money";

const STYLE: Record<TagVariant, string> = {
  neutral: "border-rule text-ink-2",
  settled: "border-positive-ink/50 text-positive-ink",
  open: "border-signal-ink/50 text-signal-ink",
  signal: "border-ink bg-ink text-paper",
  alert: "border-danger-ink/50 text-danger-ink",
  out: "border-dashed border-ink-3 text-ink-3",
  money: "border-ink text-ink",
};

export function Tag({
  variant = "neutral",
  children,
  className,
}: {
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "meta inline-flex items-center whitespace-nowrap border px-1.5 py-0.5",
        STYLE[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

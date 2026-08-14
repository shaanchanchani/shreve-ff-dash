import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Designed states — not a blank screen. Used for connection failures, missing
 * snapshots, provider-not-configured, and upcoming seasons.
 */
export function Notice({
  kind = "info",
  title,
  children,
  className,
}: {
  kind?: "info" | "alert";
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const alert = kind === "alert";

  return (
    <div
      role={alert ? "alert" : undefined}
      className={cn(
        "module px-4 py-4",
        alert ? "border-danger-ink" : "border-ink",
        className,
      )}
    >
      <p
        className={cn(
          "meta font-bold",
          alert ? "text-danger-ink" : "text-ink",
        )}
      >
        <span aria-hidden="true">{alert ? "▲ " : "▸ "}</span>
        {title}
      </p>
      {children ? (
        <div className="mt-2 max-w-[60ch] text-sm leading-relaxed text-ink-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

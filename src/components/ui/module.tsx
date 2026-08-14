import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One bordered block of the page: a ruled header with a title and optional
 * status, a body, and an optional plain-language note at the foot. Flat by
 * design — rules and borders do the work shadows used to.
 */

interface ModuleProps {
  title: string;
  /** Short qualifier printed after the title, e.g. "$10 / WEEK". */
  qualifier?: string;
  status?: ReactNode;
  featured?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** Plain-language explanation printed below the rule at the module foot. */
  note?: ReactNode;
}

export function Module({
  title,
  qualifier,
  status,
  featured = false,
  className,
  bodyClassName,
  children,
  note,
}: ModuleProps) {

  return (
    <section
      className={cn(
        "module flex min-w-0 flex-col",
        featured && "module-featured",
        className,
      )}
    >
      <header
        className="flex items-center justify-between gap-3 border-b border-ink px-3 py-1.5"
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="meta truncate font-bold text-ink">
            {title}
          </h2>
          {qualifier ? (
            <span className="meta hidden shrink-0 text-ink-3 sm:inline">
              {qualifier}
            </span>
          ) : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </header>

      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>

      {note ? (
        <p className="border-t border-rule px-3 py-1.5 text-[0.6875rem] leading-snug text-ink-2">
          {note}
        </p>
      ) : null}
    </section>
  );
}

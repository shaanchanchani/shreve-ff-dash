import { cn } from "@/lib/utils";

/**
 * First-connection placeholders. They keep the module frame, rules, and header
 * so the page does not reflow when real data lands — only the values arrive.
 */
export function ModuleSkeleton({
  title,
  rows = 5,
  className,
}: {
  title: string;
  rows?: number;
  className?: string;
}) {
  return (
    <section className={cn("module flex flex-col", className)}>
      <header className="flex items-center justify-between border-b border-ink px-3 py-1.5">
        <span className="meta text-ink">{title}</span>
        <span className="meta text-ink-3">Connecting</span>
      </header>
      <div className="animate-pulse divide-y divide-rule-2" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-[18px] w-[18px] shrink-0 bg-paper-3" />
            <div className="h-3 flex-1 bg-paper-2" />
            <div className="h-3 w-10 shrink-0 bg-paper-3" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading {title}
      </span>
    </section>
  );
}

export function MastheadSkeleton() {
  return (
    <div className="mb-4 animate-pulse border-b-2 border-ink" aria-hidden="true">
      <div className="border-b border-rule pb-1">
        <div className="h-2.5 w-40 bg-paper-2" />
      </div>
      <div className="flex items-end justify-between gap-6 py-2">
        <div className="w-full max-w-sm space-y-2">
          <div className="h-7 w-56 bg-paper-3" />
          <div className="h-2.5 w-full bg-paper-2" />
        </div>
        <div className="hidden gap-6 sm:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <div className="h-2 w-10 bg-paper-2" />
              <div className="h-4 w-12 bg-paper-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

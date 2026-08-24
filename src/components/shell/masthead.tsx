import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MastheadFact = {
  label: string;
  value: ReactNode;
  hint?: string;
};

/**
 * Compact page header band: what this page is, what season it covers, and the
 * numbers that matter — on one line each.
 */
export function Masthead({
  title,
  eyebrow,
  status,
  standfirst,
  facts,
  className,
}: {
  title: string;
  /** Season and scope, e.g. "2025 season · regular season closed". */
  eyebrow?: ReactNode;
  status?: ReactNode;
  standfirst?: ReactNode;
  facts?: MastheadFact[];
  className?: string;
}) {
  return (
    <div className={cn("mb-4 border-b-2 border-ink", className)}>
      {eyebrow || status ? (
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-1">
          <p className="meta truncate text-ink-3">{eyebrow}</p>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 py-2">
        <div className="min-w-0">
          <h1 className="display text-[1.75rem] leading-none sm:text-[2.125rem]">
            {title}
          </h1>
          {standfirst ? (
            <p className="mt-1 max-w-[70ch] text-[0.8125rem] leading-snug text-ink-2">
              {standfirst}
            </p>
          ) : null}
        </div>

        {facts?.length ? (
          <dl className="flex flex-wrap items-end gap-x-5 gap-y-2 sm:gap-x-7">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-[3.5rem]">
                <dt className="meta text-ink-3">{fact.label}</dt>
                <dd className="num text-[1.0625rem] font-medium leading-none">
                  {fact.value}
                </dd>
                {fact.hint ? (
                  <dd className="meta mt-0.5 text-ink-3">{fact.hint}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

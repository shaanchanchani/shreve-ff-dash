"use client";

import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import { regularSeasonComplete } from "@/lib/payout-model";
import type { PayoutLedger, PayoutRow } from "@/lib/payout-model";
import type { PrizeData } from "@/types/prizes";
import { cn } from "@/lib/utils";

/**
 * The primary object on the page: what every team has actually won, and the
 * most it can still finish with. Ordered by money won, because that is the
 * first question the league asks.
 */
export function PayoutIndex({
  prizeData,
  ledger,
  className,
}: {
  prizeData: PrizeData;
  ledger: PayoutLedger;
  className?: string;
}) {
  const complete = regularSeasonComplete(prizeData);
  const { rows, anythingOpen } = ledger;
  const scale = Math.max(
    1,
    ...rows.map((row) => (anythingOpen ? row.max : row.decided)),
  );

  return (
    <Module
      title="Payout picture"
      qualifier={`${rows.length} teams`}
      featured
      className={className}
      status={
        <Tag variant={complete ? "settled" : "open"}>
          {complete ? "Season complete" : "Season to date"}
        </Tag>
      }
      note={
        anythingOpen
          ? "Won is prize money the data has settled on a team. Max adds every prize still open to them — a prize nobody can win any more is counted in neither."
          : ledger.survivorUnresolved
            ? `Every prize with a recorded winner. $${ledger.totalDefined - ledger.totalDecided} is unassigned because the survivor pool has no winner in the data.`
            : "Every prize with a recorded winner."
      }
    >
      <div className="overflow-x-auto scroll-rail">
        <table className="w-full min-w-[20rem] border-collapse text-left">
          <caption className="sr-only">
            Prize money won by each team{anythingOpen ? ", and the most each can still finish with" : ""}.
          </caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="meta w-8 px-2 py-1.5 text-ink-3">
                #
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-ink-3">
                Team
              </th>
              <th
                scope="col"
                className="meta hidden px-2 py-1.5 text-ink-3 sm:table-cell"
              >
                <span className="sr-only">Share of the largest total</span>
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
                Won
              </th>
              {anythingOpen ? (
                <th
                  scope="col"
                  className="meta px-2 py-1.5 text-right text-ink-3"
                >
                  Max
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const leads = index === 0 && row.decided > 0;
              return (
                <tr
                  key={row.teamName}
                  className={cn(
                    "border-b border-rule-2 last:border-b-0 hover:bg-paper-2",
                    leads && "bg-paper-2/60",
                  )}
                >
                  <td
                    className={cn(
                      "num px-2 py-1.5 text-xs",
                      leads ? "text-ink-2" : "text-ink-3",
                      leads && "border-l-2 border-gold",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="cell-tight px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <EntryMark
                        logoURL={row.logoURL}
                        label={row.teamName}
                        size="xs"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.8125rem] font-medium leading-tight">
                          {row.teamName}
                        </span>
                        {row.lines.length ? (
                          <span
                            className={cn(
                              "meta block truncate",
                              leads ? "text-ink-2" : "text-ink-3",
                            )}
                          >
                            {summarize(row)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="hidden w-[28%] px-2 py-1.5 sm:table-cell">
                    <AllocationBar
                      decided={row.decided}
                      max={anythingOpen ? row.max : row.decided}
                      scale={scale}
                    />
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[0.9375rem] font-medium">
                    {row.decided ? (
                      `$${Math.round(row.decided)}`
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  {anythingOpen ? (
                    <td className="num px-2 py-1.5 text-right text-[0.9375rem] text-ink-2">
                      ${Math.round(row.max)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Module>
  );
}

/** "5 weekly · Season high · Longest receiving TD" — where the money came from. */
const summarize = (row: PayoutRow) => {
  const weeks = row.lines.filter((line) => line.label.startsWith("Week")).length;
  const others = row.lines
    .filter((line) => !line.label.startsWith("Week"))
    .map((line) => line.label);
  return [weeks ? `${weeks} weekly` : null, ...others]
    .filter(Boolean)
    .join(" · ");
};

/** Money won in ink, still-reachable money in mist, both on the league scale. */
function AllocationBar({
  decided,
  max,
  scale,
}: {
  decided: number;
  max: number;
  scale: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-2 w-full border border-rule bg-paper"
    >
      <span
        className="absolute inset-y-0 left-0 bg-mist"
        style={{ width: `${Math.min(100, (max / scale) * 100)}%` }}
      />
      <span
        className="absolute inset-y-0 left-0 bg-ink"
        style={{ width: `${Math.min(100, (decided / scale) * 100)}%` }}
      />
    </span>
  );
}

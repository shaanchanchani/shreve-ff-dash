"use client";

import Link from "next/link";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import { WEEKLY_PAYOUT } from "@/lib/prize-calculations";
import { scoredWeeks, weeklyWinCounts } from "@/lib/payout-model";
import { seasonRules } from "@/lib/standings";
import type { PrizeData, WeeklyWinner } from "@/types/prizes";
import { cn } from "@/lib/utils";

const byWeekDesc = (winners: WeeklyWinner[]) =>
  [...winners].sort((a, b) => b.week - a.week);

/** Weekly top score, read as a transaction log: one settled line per week. */
export function WeeklyLogTable({
  winners,
  className,
}: {
  winners: WeeklyWinner[];
  className?: string;
}) {
  if (winners.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-ink-2">
        No weeks have been scored yet.
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto scroll-rail", className)}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Weekly top score by week, with the prize paid.
        </caption>
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="meta px-3 py-1.5 text-ink-3">
              Wk
            </th>
            <th scope="col" className="meta px-2 py-1.5 text-ink-3">
              Team
            </th>
            <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
              Score
            </th>
            <th scope="col" className="meta px-3 py-1.5 text-right text-ink-3">
              Prize
            </th>
          </tr>
        </thead>
        <tbody>
          {winners.map((winner) => (
            <tr
              key={winner.week}
              className="border-b border-rule-2 last:border-b-0 hover:bg-paper-2"
            >
              <td className="num px-3 py-1.5 text-xs text-ink-3">
                W{String(winner.week).padStart(2, "0")}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <EntryMark
                    logoURL={winner.logoURL}
                    label={winner.teamName}
                    size="xs"
                  />
                  <span className="truncate text-[0.8125rem]">
                    {winner.teamName}
                  </span>
                </div>
              </td>
              <td className="num px-2 py-1.5 text-right text-[0.9375rem] font-medium">
                {winner.score.toFixed(2)}
              </td>
              <td className="num px-3 py-1.5 text-right text-[0.8125rem]">
                ${WEEKLY_PAYOUT}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact dashboard view: the latest settled weeks plus the season total. */
export function WeeklyLogModule({
  prizeData,
  limit = 6,
  className,
}: {
  prizeData: PrizeData;
  limit?: number;
  className?: string;
}) {
  const winners = byWeekDesc(scoredWeeks(prizeData));
  const shown = winners.slice(0, limit);
  const scheduled = seasonRules(prizeData).regularSeasonWeeks;
  const settled = winners.length * WEEKLY_PAYOUT;

  return (
    <Module
      title="Weekly top scores"
      qualifier={`$${WEEKLY_PAYOUT} / week`}
      className={className}
      status={
        <Tag variant={winners.length >= scheduled ? "settled" : "open"}>
          {winners.length}/{scheduled} weeks
        </Tag>
      }
      note={`$${settled} decided over ${winners.length} weeks. Playoff weeks don’t pay this prize.`}
    >
      <WeeklyLogTable winners={shown} />
      {winners.length > shown.length ? (
        <Link
          href="/weekly"
          className="meta flex items-center justify-center gap-1.5 border-t border-rule px-3 py-3 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          All weeks
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </Module>
  );
}

/** Who converted weeks into money, and how often. */
export function WeeklyWinnersRoll({
  prizeData,
  className,
}: {
  prizeData: PrizeData;
  className?: string;
}) {
  const counts = weeklyWinCounts(prizeData);
  const most = counts[0]?.wins ?? 0;

  return (
    <Module
      title="Wins by team"
      qualifier={`${counts.length} teams`}
      className={className}
      note="One block per $10 win. Teams without a weekly top score aren’t listed."
    >
      <ul className="divide-y divide-rule-2">
        {counts.map((row) => (
          <li
            key={row.teamName}
            className="flex items-center gap-3 px-3 py-1.5 hover:bg-paper-2"
          >
            <EntryMark logoURL={row.logoURL} label={row.teamName} size="xs" />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
              {row.teamName}
            </span>
            <span
              aria-hidden="true"
              className="hidden items-center gap-[3px] sm:flex"
            >
              {Array.from({ length: row.wins }, (_, index) => (
                <span key={index} className="h-3 w-1.5 bg-ink" />
              ))}
              {Array.from({ length: Math.max(0, most - row.wins) }, (_, index) => (
                <span key={`empty-${index}`} className="h-3 w-1.5 bg-rule-2" />
              ))}
            </span>
            <span className="num w-14 shrink-0 text-right text-[0.8125rem] font-medium">
              ${row.wins * WEEKLY_PAYOUT}
            </span>
          </li>
        ))}
      </ul>
    </Module>
  );
}

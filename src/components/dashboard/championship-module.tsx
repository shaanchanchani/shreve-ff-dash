"use client";

import Link from "next/link";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import { FIRST_PLACE_PAYOUT } from "@/lib/prize-calculations";
import type { PrizeData } from "@/types/prizes";
import type { ChampionResult } from "@/hooks/use-champion";
import { seasonRules, sortedStandings } from "@/lib/standings";
import { cn } from "@/lib/utils";

/**
 * The biggest prize in the structure. It earns weight from scale and a heavier
 * frame rather than from inverting the page. The winner comes from the played
 * bracket when one exists, and the module says so plainly when it does not.
 */
export function ChampionshipModule({
  prizeData,
  result,
  className,
}: {
  prizeData: PrizeData;
  result?: ChampionResult | null;
  className?: string;
}) {
  const { playoffTeamCount } = seasonRules(prizeData);
  const qualified = sortedStandings(prizeData).slice(0, playoffTeamCount);

  return (
    <Module
      title="Championship"
      qualifier="First place"
      featured
      className={className}
      status={
        result ? (
          <Tag variant="settled">Won</Tag>
        ) : (
          <Tag variant="open">Not awarded yet</Tag>
        )
      }
      note={
        result
          ? `Taken from the week ${result.week} final. Playoff results live in the league history rather than the prizes data, so this fills in a moment after the rest of the page.`
          : "No playoff result has been played or recorded yet."
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="border-b border-rule px-3 py-3 lg:border-b-0 lg:border-r">
          <p className="num text-[3rem] font-medium leading-none">
            ${FIRST_PLACE_PAYOUT}
          </p>
          <span
            aria-hidden="true"
            className="mt-1.5 block h-[3px] w-16 bg-gold"
          />
          {result ? (
            <div className="mt-3 flex items-center gap-2.5 border-t border-rule pt-3">
              <EntryMark
                logoURL={result.champion.logoURL}
                label={result.champion.teamName}
                size="sm"
              />
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-medium leading-tight">
                  {result.champion.teamName}
                </span>
                <span className="meta text-ink-3">
                  Def. {result.runnerUp.teamName} · {result.score}
                </span>
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[0.8125rem] text-ink-2">
              Paid once, to the champion.
            </p>
          )}
          <Link
            href="/playoffs"
            className="meta mt-3 inline-flex items-center gap-1.5 border border-rule px-2 py-1.5 text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Playoff picture
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="px-3 py-3">
          <p className="meta text-ink-3">
            {result ? "Bracket field" : "In the bracket"} · {qualified.length} of{" "}
            {prizeData.standings.length}
          </p>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {qualified.map((entry, index) => {
              const isChampion = result?.champion.teamName === entry.teamName;
              return (
              <li
                key={entry.teamName}
                className={cn(
                  "flex min-w-0 items-center gap-2 border px-2 py-1.5",
                  isChampion ? "border-2 border-ink bg-paper-2" : "border-rule",
                )}
              >
                <span
                  className={cn(
                    "num w-4 shrink-0 text-xs",
                    isChampion ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  {index + 1}
                </span>
                <EntryMark
                  logoURL={entry.logoURL}
                  label={entry.teamName}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight">
                  {entry.teamName}
                </span>
                <span
                  className={cn(
                    "num shrink-0 text-[0.6875rem]",
                    isChampion ? "text-ink-2" : "text-ink-3",
                  )}
                >
                  {entry.wins}-{entry.losses}
                </span>
                {isChampion ? (
                  <span className="meta shrink-0 text-ink">Champion</span>
                ) : null}
              </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Module>
  );
}

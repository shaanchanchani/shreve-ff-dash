"use client";

import Link from "next/link";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import { SURVIVOR_PAYOUT } from "@/lib/prize-calculations";
import { survivorState } from "@/lib/payout-model";
import type { PrizeData } from "@/types/prizes";
import { cn } from "@/lib/utils";

/**
 * Survivor read as an operational roster that shrinks by one every week. The
 * remaining column is the point of the table.
 */
export function SurvivorLadder({ prizeData }: { prizeData: PrizeData }) {
  const { eliminations, fieldSize } = survivorState(prizeData);
  // Remaining is true by position in the ascending elimination order; deriving
  // it from the week number breaks if a week is skipped.
  const ordered = eliminations.map((elimination, index) => ({
    elimination,
    remaining: Math.max(0, fieldSize - (index + 1)),
  }));
  const rows = [...ordered].reverse();

  if (rows.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-ink-2">
        Nobody is out yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto scroll-rail">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Weekly eliminations and how many teams were left.
        </caption>
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="meta px-3 py-1.5 text-ink-3">
              Wk
            </th>
            <th scope="col" className="meta px-2 py-1.5 text-ink-3">
              Knocked out
            </th>
            <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
              Score
            </th>
            <th scope="col" className="meta px-3 py-1.5 text-right text-ink-3">
              Left
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ elimination, remaining }) => {
            return (
              <tr
                key={elimination.week}
                className="border-b border-rule-2 last:border-b-0 hover:bg-paper-2"
              >
                <td className="num px-3 py-1.5 text-xs text-ink-3">
                  W{String(elimination.week).padStart(2, "0")}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <EntryMark
                      logoURL={elimination.logoURL}
                      label={elimination.teamName}
                      size="xs"
                      className="opacity-60"
                    />
                    <span className="truncate text-[0.8125rem] text-ink-2 line-through decoration-danger-ink/50">
                      {elimination.teamName}
                    </span>
                  </div>
                </td>
                <td className="num px-2 py-1.5 text-right text-[0.9375rem]">
                  {elimination.score.toFixed(2)}
                </td>
                <td className="num px-3 py-1.5 text-right text-[0.8125rem] font-medium">
                  {remaining}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Field-strength strip: one block per entrant, struck out as they are cut. */
export function FieldStrength({
  fieldSize,
  remaining,
}: {
  fieldSize: number;
  remaining: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex flex-wrap items-center gap-[3px]"
    >
      {Array.from({ length: fieldSize }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-4 w-2 border",
            index < remaining
              ? "border-ink bg-ink"
              : "border-rule bg-paper-2",
          )}
        />
      ))}
    </span>
  );
}

export function SurvivorModule({
  prizeData,
  limit = 8,
  className,
}: {
  prizeData: PrizeData;
  limit?: number;
  className?: string;
}) {
  const state = survivorState(prizeData);
  const remaining = state.alive.length;
  const settled = remaining === 1;

  return (
    <Module
      title="Survivor pool"
      qualifier={`$${SURVIVOR_PAYOUT}`}
      className={className}
      status={
        <Tag
          variant={settled ? "settled" : state.poolExhausted ? "alert" : "open"}
        >
          {settled
            ? "Settled"
            : state.poolExhausted
              ? "Unresolved"
              : `${remaining} alive`}
        </Tag>
      }
      note={
        state.poolExhausted ? (
          <>
            The data knocks out the lowest scorer every week — including the
            last team standing — so no winner is recorded.{" "}
            <b className="font-semibold text-ink">
              {state.finalEntrant?.teamName}
            </b>{" "}
            outlasted the other {state.fieldSize - 1} teams before being cut in
            week {state.finalEntrant?.week}.
          </>
        ) : (
          "Lowest score still in the pool is knocked out each week. Last team standing wins."
        )
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="border-b border-rule px-3 py-3 lg:border-b-0 lg:border-r">
          <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-start lg:gap-3">
            <div>
              <p className="num text-[2rem] font-medium leading-none">
                {remaining}
                <span className="text-ink-3">/{state.fieldSize}</span>
              </p>
              <p className="meta mt-1.5 text-ink-3">Still alive</p>
            </div>
            <FieldStrength fieldSize={state.fieldSize} remaining={remaining} />
          </div>

          {settled ? (
            <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
              <Tag variant="settled">Last standing</Tag>
              <span className="truncate text-[0.8125rem] font-medium">
                {state.alive[0]}
              </span>
            </div>
          ) : null}

          {state.poolExhausted && state.finalEntrant ? (
            <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
              <EntryMark
                logoURL={state.finalEntrant.logoURL}
                label={state.finalEntrant.teamName}
                size="xs"
              />
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] font-medium leading-tight">
                  {state.finalEntrant.teamName}
                </span>
                <span className="meta text-ink-3">
                  Last one out · W{state.finalEntrant.week}
                </span>
              </span>
            </div>
          ) : null}

          <Link
            href="/survivor"
            className="meta mt-3 inline-flex items-center gap-1.5 border border-rule px-2 py-1.5 text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            All weeks
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div>
          <p className="meta border-b border-rule px-3 py-1.5 text-ink-3">
            Recent knockouts
          </p>
          <ul className="grid sm:grid-cols-2">
            {[...state.eliminations]
              .reverse()
              .slice(0, limit)
              .map((elimination, index) => (
                <li
                  key={elimination.week}
                  className={cn(
                    "flex items-center gap-2.5 border-b border-rule-2 px-3 py-1.5",
                    index % 2 === 1 && "sm:border-l sm:border-l-rule-2",
                  )}
                >
                  <span className="num w-8 shrink-0 text-xs text-ink-3">
                    W{String(elimination.week).padStart(2, "0")}
                  </span>
                  <EntryMark
                    logoURL={elimination.logoURL}
                    label={elimination.teamName}
                    size="xs"
                    className="opacity-60"
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
                    {elimination.teamName}
                  </span>
                  <span className="num shrink-0 text-[0.8125rem]">
                    {elimination.score.toFixed(2)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </Module>
  );
}

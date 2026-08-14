"use client";

import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { Masthead } from "@/components/shell/masthead";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { Notice } from "@/components/ui/notice";
import {
  WeeklyLogTable,
  WeeklyWinnersRoll,
} from "@/components/dashboard/weekly-log";
import {
  MastheadSkeleton,
  ModuleSkeleton,
} from "@/components/dashboard/skeletons";
import { WEEKLY_PAYOUT } from "@/lib/prize-calculations";
import { scoredWeeks, weeklyWinCounts } from "@/lib/payout-model";
import { seasonRules } from "@/lib/standings";
import { CURRENT_SEASON } from "@/lib/season";
import type { WeeklyWinner } from "@/types/prizes";

export default function WeeklyFieldReportPage() {
  const { prizeData, error, isLoadingPrize } = usePrizeDashboard();

  if (error) {
    return (
      <>
        <Masthead
          eyebrow={`${CURRENT_SEASON} season`}
          title="Weekly Winners"
          standfirst="This season's data could not be loaded."
        />
        <Notice kind="alert" title="No data for this season yet">
          {error}
        </Notice>
      </>
    );
  }

  if (isLoadingPrize || !prizeData) {
    return (
      <>
        <MastheadSkeleton />
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <ModuleSkeleton
            title="Every week"
            rows={8}
            className="lg:col-span-7"
          />
          <ModuleSkeleton
            title="Wins by team"
            rows={6}
            className="lg:col-span-5"
          />
        </div>
      </>
    );
  }

  const winners = [...scoredWeeks(prizeData)].sort((a, b) => b.week - a.week);
  const counts = weeklyWinCounts(prizeData);
  const scheduled = seasonRules(prizeData).regularSeasonWeeks;
  const best = winners.reduce<WeeklyWinner | null>(
    (top, winner) => (!top || winner.score > top.score ? winner : top),
    null,
  );

  return (
    <>
      <Masthead
        eyebrow={`${CURRENT_SEASON} season`}
        status={
          <Tag variant={winners.length >= scheduled ? "settled" : "open"}>
            {winners.length >= scheduled ? "Complete" : "In progress"}
          </Tag>
        }
        title="Weekly Winners"
        standfirst={`$${WEEKLY_PAYOUT} to the highest single-week output, one award per regular-season week.`}
        facts={[
          {
            label: "Weeks",
            value: `${winners.length}/${scheduled}`,
          },
          { label: "Winners", value: counts.length },
          { label: "Paid", value: `$${winners.length * WEEKLY_PAYOUT}` },
          {
            label: "Best week",
            value: best ? best.score.toFixed(1) : "—",
            hint: best ? `Week ${best.week}` : undefined,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <Module
          title="Every week"
          qualifier={`$${WEEKLY_PAYOUT} / week`}
          featured
          className="lg:col-span-7"
          status={
            <Tag variant={winners.length >= scheduled ? "settled" : "open"}>
              {winners.length >= scheduled ? "Complete" : "In progress"}
            </Tag>
          }
          note="Newest week first."
        >
          <WeeklyLogTable winners={winners} />
        </Module>

        <WeeklyWinnersRoll
          prizeData={prizeData}
          className="lg:col-span-5"
        />

        <OutputCurve winners={winners} className="lg:col-span-12" />
      </div>
    </>
  );
}

/** The winning output for every week, plotted as a bar chart. */
function OutputCurve({
  winners,
  className,
}: {
  winners: WeeklyWinner[];
  className?: string;
}) {
  const ordered = [...winners].sort((a, b) => a.week - b.week);
  if (ordered.length === 0) return null;

  const scores = ordered.map((winner) => winner.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const floor = Math.max(0, min - 15);

  return (
    <Module
      title="Winning score by week"
      qualifier="Points"
      className={className}
      note={`${min.toFixed(1)} to ${max.toFixed(1)} points, averaging ${mean.toFixed(1)}. Bars start at ${floor.toFixed(0)} so the differences read.`}
    >
      <div className="px-3 py-4">
        <div
          aria-hidden="true"
          className="flex h-40 items-end gap-1 border-b border-ink sm:gap-2"
        >
          {ordered.map((winner) => {
            const height =
              ((winner.score - floor) / Math.max(1, max - floor)) * 100;
            const isMax = winner.score === max;
            return (
              <div
                key={winner.week}
                className="flex flex-1 flex-col justify-end"
                style={{ height: "100%" }}
              >
                <span
                  className={`block w-full ${isMax ? "bg-ink" : "bg-mist"}`}
                  style={{ height: `${Math.max(4, height)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="mt-1 flex gap-1 sm:gap-2">
          {ordered.map((winner) => (
            <span
              key={winner.week}
              className="num flex-1 text-center text-[0.5625rem] text-ink-3"
            >
              {winner.week}
            </span>
          ))}
        </div>
        <p className="sr-only">
          Winning score by week:{" "}
          {ordered
            .map((winner) => `week ${winner.week}, ${winner.score.toFixed(1)}`)
            .join("; ")}
          .
        </p>
      </div>
    </Module>
  );
}

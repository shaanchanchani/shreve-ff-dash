"use client";

import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { Masthead } from "@/components/shell/masthead";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { Notice } from "@/components/ui/notice";
import { EntryMark } from "@/components/common/entry-mark";
import { FieldStrength, SurvivorLadder } from "@/components/dashboard/survivor";
import {
  MastheadSkeleton,
  ModuleSkeleton,
} from "@/components/dashboard/skeletons";
import { SURVIVOR_PAYOUT, getTeamLogo } from "@/lib/prize-calculations";
import { survivorState } from "@/lib/payout-model";
import { CURRENT_SEASON } from "@/lib/season";

export default function SurvivorProgramPage() {
  const { prizeData, error, isLoadingPrize } = usePrizeDashboard();

  if (error) {
    return (
      <>
        <Masthead
          eyebrow={`${CURRENT_SEASON} season`}
          title="Survivor Pool"
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
            title="Weekly knockouts"
            rows={8}
            className="lg:col-span-7"
          />
          <ModuleSkeleton
            title="Pool status"
            rows={4}
            className="lg:col-span-5"
          />
        </div>
      </>
    );
  }

  const state = survivorState(prizeData);
  const alive = state.alive.length;
  const scores = state.eliminations.map((entry) => entry.score);
  const lowest = scores.length ? Math.min(...scores) : null;
  const highest = scores.length ? Math.max(...scores) : null;

  return (
    <>
      <Masthead
        eyebrow={`${CURRENT_SEASON} season`}
        status={
          <Tag variant={alive === 1 ? "settled" : alive === 0 ? "alert" : "open"}>
            {alive === 1 ? "Won" : alive === 0 ? "Pool empty" : `${alive} alive`}
          </Tag>
        }
        title="Survivor Pool"
        standfirst={`Lowest score in the pool is knocked out every week. Last team standing wins $${SURVIVOR_PAYOUT}.`}
        facts={[
          { label: "Teams", value: state.fieldSize },
          { label: "Alive", value: alive },
          { label: "Out", value: state.eliminations.length },
          { label: "Prize", value: `$${SURVIVOR_PAYOUT}` },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <Module
          title="Weekly knockouts"
          qualifier="Newest first"
          featured
          className="lg:col-span-7"
          status={
            <Tag variant={alive === 1 ? "settled" : alive === 0 ? "alert" : "open"}>
              {alive === 1 ? "Won" : alive === 0 ? "Pool empty" : `${alive} alive`}
            </Tag>
          }
          note={
            lowest !== null && highest !== null
              ? `Knockout scores ranged from ${lowest.toFixed(2)} to ${highest.toFixed(2)} points.`
              : undefined
          }
        >
          <SurvivorLadder prizeData={prizeData} />
        </Module>

        <Module
          title="Pool status"
          qualifier={`$${SURVIVOR_PAYOUT}`}
          className="lg:col-span-5"
          status={
            <Tag
              variant={
                alive === 1 ? "settled" : state.poolExhausted ? "alert" : "open"
              }
            >
              {alive === 1
                ? "Won"
                : state.poolExhausted
                  ? "No winner"
                  : `${alive} alive`}
            </Tag>
          }
        >
          <div className="space-y-4 px-3 py-4">
            <div>
              <p className="num text-[2.5rem] font-medium leading-none">
                {alive}
                <span className="text-ink-3">/{state.fieldSize}</span>
              </p>
              <p className="meta mt-1.5 text-ink-3">Still alive</p>
            </div>

            <FieldStrength fieldSize={state.fieldSize} remaining={alive} />

            {alive === 1 ? (
              <div className="flex items-center gap-2 border-t border-rule pt-3">
                <EntryMark
                  logoURL={getTeamLogo(prizeData, state.alive[0])}
                  label={state.alive[0]}
                  size="sm"
                />
                <div>
                  <p className="text-[0.9375rem] font-medium leading-tight">
                    {state.alive[0]}
                  </p>
                  <p className="meta mt-0.5 text-ink-3">
                    Last team standing · ${SURVIVOR_PAYOUT}
                  </p>
                </div>
              </div>
            ) : null}

            {state.poolExhausted && state.finalEntrant ? (
              <div className="border-t border-rule pt-3">
                <p className="meta text-ink-3">Last one out</p>
                <div className="mt-2 flex items-center gap-2">
                  <EntryMark
                    logoURL={state.finalEntrant.logoURL}
                    label={state.finalEntrant.teamName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-medium leading-tight">
                      {state.finalEntrant.teamName}
                    </p>
                    <p className="meta mt-0.5 text-ink-3">
                      Outlasted {state.fieldSize - 1} teams · out in week{" "}
                      {state.finalEntrant.week}
                    </p>
                  </div>
                </div>
                <Notice
                  kind="alert"
                  title="No winner recorded"
                  className="mt-3 border-0 p-0"
                >
                  The calculation keeps knocking out the lowest scorer even
                  once a single team is left, so the last team standing is
                  recorded as eliminated. Rather than guess, the $
                  {SURVIVOR_PAYOUT} is left unassigned here.
                </Notice>
              </div>
            ) : null}
          </div>
        </Module>
      </div>
    </>
  );
}

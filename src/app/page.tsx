"use client";

import { useMemo } from "react";
import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { Masthead } from "@/components/shell/masthead";
import { Notice } from "@/components/ui/notice";
import { Tag } from "@/components/ui/tag";
import { PayoutIndex } from "@/components/dashboard/payout-index";
import { ChampionshipModule } from "@/components/dashboard/championship-module";
import { WeeklyLogModule } from "@/components/dashboard/weekly-log";
import {
  LongestRecordModule,
  LongestRecordPlaceholder,
  SeasonHighModule,
  UnluckyModule,
} from "@/components/dashboard/records";
import { SurvivorModule } from "@/components/dashboard/survivor";
import {
  MastheadSkeleton,
  ModuleSkeleton,
} from "@/components/dashboard/skeletons";
import {
  LONGEST_KEYS,
  buildPayoutLedger,
  longestAmountFor,
  regularSeasonComplete,
} from "@/lib/payout-model";
import { CURRENT_SEASON } from "@/lib/season";
import { seasonRules } from "@/lib/standings";
import { useSystemStatus } from "@/hooks/use-system-status";
import { useChampion } from "@/hooks/use-champion";

const LONGEST_TITLE: Record<string, string> = {
  longest_started_rushing_td: "Longest rushing TD",
  longest_started_receiving_td: "Longest receiving TD",
  longest_started_passing_td: "Longest passing TD",
};

export default function PayoutIndexPage() {
  const {
    prizeData,
    longestCards,
    error,
    isLoadingPrize,
    isLoadingLongest,
  } = usePrizeDashboard({ includeLongest: true });
  const { nextSeasonOnFile } = useSystemStatus();
  const { result: championResult, pending: championPending } =
    useChampion(prizeData);
  const nextSeasonMissing = nextSeasonOnFile === false;

  const ledger = useMemo(
    () =>
      prizeData
        ? buildPayoutLedger({
            prizeData,
            longestCards,
            champion: championResult?.champion.teamName ?? null,
            pending: {
              longest: isLoadingLongest,
              champion: championPending,
            },
          })
        : null,
    [prizeData, longestCards, championResult, isLoadingLongest, championPending],
  );

  if (error) {
    return (
      <>
        <Masthead
          eyebrow={`${CURRENT_SEASON} season`}
          title="Prizes"
          standfirst="This season's data could not be loaded."
        />
        <Notice kind="alert" title="No data for this season yet">
          {error} The page updates on its own as soon as the season is built —
          no reload needed.
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
            title="Payout picture"
            rows={8}
            className="lg:col-span-8"
          />
          <ModuleSkeleton
            title="Season high"
            rows={5}
            className="lg:col-span-4"
          />
          <ModuleSkeleton
            title="Championship"
            rows={4}
            className="lg:col-span-12"
          />
          <ModuleSkeleton
            title="Weekly top scores"
            rows={6}
            className="lg:col-span-8"
          />
        </div>
      </>
    );
  }

  const complete = regularSeasonComplete(prizeData);
  const scheduledWeeks = seasonRules(prizeData).regularSeasonWeeks;

  return (
    <>
      <Masthead
        eyebrow={
          complete
            ? `${CURRENT_SEASON} season`
            : `${CURRENT_SEASON} season · week ${prizeData.weeklyHighScores.length} of ${scheduledWeeks}`
        }
        status={
          <Tag variant={complete ? "settled" : "open"}>
            {complete ? "Complete" : "In progress"}
          </Tag>
        }
        title="Prizes"
        standfirst={
          nextSeasonMissing
            ? `Who has won money and who can still win the most. ${CURRENT_SEASON + 1} hasn’t started yet, so this is the most recent season.`
            : "Who has won money and who can still win the most."
        }
        facts={[
          { label: "Teams", value: prizeData.standings.length },
          {
            label: "Weeks",
            value: `${prizeData.weeklyHighScores.length}/${scheduledWeeks}`,
            hint: complete ? "complete" : "in progress",
          },
          {
            label: "Prize money",
            value: ledger && !ledger.pending ? `$${ledger.totalDecided}` : "—",
            hint: ledger ? `of $${ledger.totalDefined} awarded` : undefined,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {ledger ? (
          <PayoutIndex
            prizeData={prizeData}
            ledger={ledger}
            className="lg:col-span-8"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4 lg:gap-5">
          <SeasonHighModule prizeData={prizeData} />
          <UnluckyModule prizeData={prizeData} />
        </div>

        <ChampionshipModule
          prizeData={prizeData}
          result={championResult}
          className="lg:col-span-12"
        />

        <WeeklyLogModule
          prizeData={prizeData}
          limit={10}
          className="lg:col-span-8"
        />

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4 lg:gap-5">
          {LONGEST_KEYS.map((key) => {
            const card = longestCards.find((entry) => entry.key === key);
            if (!card) {
              return (
                <LongestRecordPlaceholder
                  key={key}
                  title={LONGEST_TITLE[key] ?? "Longest TD"}
                  amount={longestAmountFor(key)}
                  state={isLoadingLongest ? "loading" : "unavailable"}
                />
              );
            }
            return (
              <LongestRecordModule
                key={key}
                card={card}
                prizeData={prizeData}
                amount={longestAmountFor(key)}
                settled={Boolean(championResult)}
              />
            );
          })}
        </div>

        <SurvivorModule
          prizeData={prizeData}
          className="lg:col-span-12"
        />
      </div>
    </>
  );
}

"use client";

import { useMemo } from "react";
import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { Masthead } from "@/components/shell/masthead";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { Notice } from "@/components/ui/notice";
import { BracketSchematic } from "@/components/playoffs/bracket-schematic";
import { BracketResult } from "@/components/playoffs/bracket-result";
import { StandingsTable } from "@/components/playoffs/standings-table";
import { useLeagueHistorySummary } from "@/hooks/use-league-history";
import { derivePostseasonStart } from "@/lib/history-model";
import { resolvePlayoffBracket } from "@/lib/playoff-bracket";
import { FIRST_PLACE_PAYOUT } from "@/lib/prize-calculations";
import {
  MastheadSkeleton,
  ModuleSkeleton,
} from "@/components/dashboard/skeletons";
import { regularSeasonComplete } from "@/lib/payout-model";
import { CURRENT_SEASON } from "@/lib/season";
import { qualifiedFromStandings, seasonRules, sortedStandings } from "@/lib/standings";

export default function PlayoffPicturePage() {
  const { prizeData, error, isLoadingPrize } = usePrizeDashboard();
  const { data: history, isLoading: isLoadingHistory } =
    useLeagueHistorySummary();

  // The prizes snapshot stops at the regular season, but the history snapshot
  // carries every playoff-week game — that is where the finished bracket lives.
  const seasonMatchups = useMemo(
    () =>
      (history?.matchups ?? []).filter(
        (matchup) => matchup.seasonId === CURRENT_SEASON,
      ),
    [history?.matchups],
  );

  const firstPlayoffWeek = useMemo(
    () => derivePostseasonStart(seasonMatchups).get(CURRENT_SEASON) ?? null,
    [seasonMatchups],
  );

  const qualifiedEntries = useMemo(
    () => (prizeData ? qualifiedFromStandings(prizeData) : []),
    [prizeData],
  );

  const bracket = useMemo(
    () =>
      resolvePlayoffBracket({
        matchups: seasonMatchups,
        qualified: qualifiedEntries,
        firstPlayoffWeek,
      }),
    [seasonMatchups, qualifiedEntries, firstPlayoffWeek],
  );

  /**
   * Once the bracket is real, it is the authority on who actually got a bye.
   * The league does not seed strictly by record then points for — in 2025 the
   * byes went to teams our standings sort ranks first and third — so deriving
   * byes from the sort would contradict the bracket sitting above the table.
   */
  const actualByes = useMemo(() => {
    if (!bracket) return null;
    return new Set(
      bracket.columns[0].flatMap((node) =>
        node.kind === "bye" ? [node.teamName] : [],
      ),
    );
  }, [bracket]);

  if (error) {
    return (
      <>
        <Masthead
          eyebrow={`${CURRENT_SEASON} season`}
          title="Playoff Picture"
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
            title="Bracket"
            rows={6}
            className="lg:col-span-12"
          />
          <ModuleSkeleton
            title="Standings"
            rows={8}
            className="lg:col-span-8"
          />
        </div>
      </>
    );
  }

  const standings = sortedStandings(prizeData);
  const {
    playoffTeamCount: playoffTeams,
    playoffByeCount: byeCount,
    regularSeasonWeeks,
    medianWinEnabled: medianEnabled,
  } = seasonRules(prizeData);
  const complete = regularSeasonComplete(prizeData);
  const median = prizeData.leagueMedianStats;
  // Playoff weeks exist in the data but the bracket has not resolved a winner.
  const playoffsUnderway =
    !bracket && complete && seasonMatchups.some((m) => m.week > regularSeasonWeeks);
  const seeds = standings.slice(0, playoffTeams);
  const enoughSeeds = seeds.length >= playoffTeams;
  const playedState = actualByes
    ? {
        byes: actualByes,
        qualified: new Set(qualifiedEntries.map((entry) => entry.teamName)),
      }
    : null;

  return (
    <>
      <Masthead
        eyebrow={
          bracket
            ? `${CURRENT_SEASON} season · final results`
            : `${CURRENT_SEASON} season`
        }
        status={
          <Tag variant={complete ? "settled" : "open"}>
            {complete ? "Complete" : "In progress"}
          </Tag>
        }
        title="Playoff Picture"
        standfirst={`${playoffTeams} teams make the bracket; the top ${byeCount} get a first-round bye.`}
        facts={[
          { label: "Make it", value: playoffTeams },
          { label: "Byes", value: byeCount },
          {
            label: "Weeks",
            value: regularSeasonWeeks,
            hint: complete ? "complete" : "in progress",
          },
          { label: "Teams", value: standings.length },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <Module
          title="Bracket"
          qualifier={
            bracket
              ? `Weeks ${bracket.weeks[0]}–${bracket.weeks.at(-1)}`
              : `Weeks ${regularSeasonWeeks + 1}–${regularSeasonWeeks + 3}`
          }
          featured
          className="lg:col-span-12"
          status={
            bracket ? (
              <Tag variant="settled">Champion decided</Tag>
            ) : isLoadingHistory ? (
              <Tag variant="open">Checking results</Tag>
            ) : undefined
          }
          note={
            bracket
              ? "Reconstructed from the games actually played: in each playoff week the bracket games are the ones where both teams were still alive."
              : playoffsUnderway
                ? "The bracket is still running, so no winner is shown yet. Seeds below come from the final standings and may not match the league's own seeding."
                : "No playoff games have been played yet, so the later rounds are still blank."
          }
        >
          {bracket ? (
            <BracketResult bracket={bracket} championPrize={FIRST_PLACE_PAYOUT} />
          ) : enoughSeeds ? (
            <BracketSchematic
              seeds={seeds}
              byeCount={byeCount}
              championPrize={FIRST_PLACE_PAYOUT}
              postseasonWeeks={{
                round1: regularSeasonWeeks + 1,
                semifinal: regularSeasonWeeks + 2,
                final: regularSeasonWeeks + 3,
              }}
            />
          ) : (
            <p className="px-3 py-8 text-center text-sm text-ink-2">
              Only {standings.length} teams are ranked; {playoffTeams} are
              needed to draw a bracket.
            </p>
          )}
        </Module>

        <StandingsTable
          standings={standings}
          playedState={playedState}
          playoffTeams={playoffTeams}
          byeCount={byeCount}
          complete={complete}
          className="lg:col-span-8"
        />

        <Module
          title="League rules"
          qualifier="From league settings"
          className="lg:col-span-4"
          note="Taken from the league’s saved settings for this season."
        >
          <dl className="divide-y divide-rule-2">
            <RuleRow label="Regular-season weeks" value={regularSeasonWeeks} />
            <RuleRow label="Playoff teams" value={playoffTeams} />
            <RuleRow label="First-round byes" value={byeCount} />
            <RuleRow
              label="League median win"
              value={medianEnabled ? "Enabled" : "Disabled"}
            />
          </dl>

          {medianEnabled && median ? (
            <div className="border-t border-rule px-3 py-3">
              <p className="text-[0.8125rem] leading-relaxed text-ink-2">
                Median wins are on, so every team gets two results a week:
                its opponent and the league median. That is why records add up
                to {regularSeasonWeeks * 2} games, not {regularSeasonWeeks}.
              </p>
              <p className="num mt-3 text-[1.75rem] font-medium leading-none">
                {(median.percentage * 100).toFixed(1)}%
              </p>
              <p className="meta mt-1 text-ink-3">
                of {median.totalWins} head-to-head wins also beat the median (
                {median.winsAboveMedian})
              </p>
            </div>
          ) : null}
        </Module>
      </div>
    </>
  );
}

function RuleRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-[0.8125rem] text-ink-2">{label}</dt>
      <dd className="num text-[0.9375rem] font-medium">{value}</dd>
    </div>
  );
}

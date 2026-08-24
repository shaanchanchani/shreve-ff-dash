import type { PrizeData, TeamStanding } from "@/types/prizes";
import {
  TOTAL_REGULAR_SEASON_WEEKS,
} from "@/lib/prize-calculations";

/**
 * Standings ordering, in one place.
 *
 * This comparator decides three different things — who qualifies for the
 * bracket, the order of the standings table, and which teams the bracket
 * resolver walks — so it must not be reimplemented per caller. Convex sorts the
 * same way in materialization.ts; if that changes, change it here too.
 */
export const compareStandings = (left: TeamStanding, right: TeamStanding) => {
  const leftRecord = left.wins + left.ties * 0.5;
  const rightRecord = right.wins + right.ties * 0.5;
  return rightRecord - leftRecord || right.pointsFor - left.pointsFor;
};

/** Fallbacks for a snapshot that predates canonical season rules. */
export const DEFAULT_RULES = {
  regularSeasonWeeks: TOTAL_REGULAR_SEASON_WEEKS,
  playoffTeamCount: 6,
  playoffByeCount: 2,
} as const;

export const seasonRules = (prizeData: PrizeData) => ({
  regularSeasonWeeks:
    prizeData.rules?.regularSeasonWeeks ?? DEFAULT_RULES.regularSeasonWeeks,
  playoffTeamCount:
    prizeData.rules?.playoffTeamCount ?? DEFAULT_RULES.playoffTeamCount,
  playoffByeCount:
    prizeData.rules?.playoffByeCount ?? DEFAULT_RULES.playoffByeCount,
  medianWinEnabled: prizeData.rules?.medianWinEnabled ?? false,
});

export const sortedStandings = (prizeData: PrizeData) =>
  [...prizeData.standings].sort(compareStandings);

/**
 * The teams the bracket is drawn from. Note this is the *set* of qualifiers,
 * not their seeding — the league does not seed strictly by this ordering, so
 * bye and seed positions must come from the played bracket where one exists.
 */
export const qualifiedFromStandings = (prizeData: PrizeData) =>
  sortedStandings(prizeData)
    .slice(0, seasonRules(prizeData).playoffTeamCount)
    .map((entry) => ({
      teamName: entry.teamName,
      ...(entry.logoURL ? { logoURL: entry.logoURL } : {}),
    }));

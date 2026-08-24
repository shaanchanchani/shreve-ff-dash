/**
 * Championship bracket reconstruction.
 *
 * The provider does not label which playoff-week games belong to the
 * championship bracket and which are consolation, so the bracket is walked
 * forward instead: in each playoff round the bracket games are the ones where
 * *both* teams are still alive, and an alive team that does not play has a bye.
 *
 * Anything that does not fit that shape — a live or tied game, a live team drawn
 * against an eliminated one, a final round that is not a single game — returns
 * null. Reporting nothing is always preferable to reporting a plausible
 * fiction about who won money.
 */

export type BracketSideInput = { entryId: string; score: number | null };

export type BracketGameInput = {
  home: BracketSideInput;
  away: BracketSideInput;
};

export type BracketWeekInput = {
  weekNumber: number;
  games: BracketGameInput[];
};

export type BracketOutcome = {
  championEntryId: string;
  runnerUpEntryId: string;
  finalWeek: number;
  championScore: number;
  runnerUpScore: number;
  /** Entry ids that received a first-round bye, in draw order. */
  byeEntryIds: string[];
  /** Set when a third-place game was played between the two beaten semifinalists. */
  thirdPlaceEntryId?: string;
};

const decided = (game: BracketGameInput) => {
  const home = game.home.score ?? 0;
  const away = game.away.score ?? 0;
  return (home > 0 || away > 0) && home !== away;
};

export const resolveBracket = ({
  weeks,
  qualifiedEntryIds,
}: {
  /** Playoff weeks that have finished, ascending by week number. */
  weeks: BracketWeekInput[];
  qualifiedEntryIds: string[];
}): BracketOutcome | null => {
  if (weeks.length === 0 || qualifiedEntryIds.length < 2) return null;

  let alive = new Set(qualifiedEntryIds);
  const rounds: Array<{
    weekNumber: number;
    games: Array<{ winner: string; loser: string; winScore: number; loseScore: number }>;
    byes: string[];
  }> = [];

  for (const week of weeks) {
    if (alive.size <= 1) break;

    const played = new Set<string>();
    const games: Array<{
      winner: string;
      loser: string;
      winScore: number;
      loseScore: number;
    }> = [];

    for (const game of week.games) {
      const homeAlive = alive.has(game.home.entryId);
      const awayAlive = alive.has(game.away.entryId);
      if (!homeAlive && !awayAlive) continue;
      // A live team against an eliminated one means the shape we assumed does
      // not hold; an undecided game means there is no result to report.
      if (homeAlive !== awayAlive) return null;
      if (!decided(game)) return null;

      const homeScore = game.home.score ?? 0;
      const awayScore = game.away.score ?? 0;
      const homeWon = homeScore > awayScore;
      games.push({
        winner: homeWon ? game.home.entryId : game.away.entryId,
        loser: homeWon ? game.away.entryId : game.home.entryId,
        winScore: homeWon ? homeScore : awayScore,
        loseScore: homeWon ? awayScore : homeScore,
      });
      played.add(game.home.entryId);
      played.add(game.away.entryId);
    }

    if (games.length === 0) continue;

    const byes = Array.from(alive).filter((entryId) => !played.has(entryId));
    rounds.push({ weekNumber: week.weekNumber, games, byes });
    alive = new Set([...games.map((game) => game.winner), ...byes]);
  }

  const finalRound = rounds.at(-1);
  if (!finalRound || finalRound.games.length !== 1 || alive.size !== 1) return null;
  const final = finalRound.games[0];

  // Third place: the game between the two teams beaten in the previous round.
  const semiRound = rounds.at(-2);
  let thirdPlaceEntryId: string | undefined;
  if (semiRound) {
    const semiLosers = new Set(semiRound.games.map((game) => game.loser));
    const candidate = weeks
      .find((week) => week.weekNumber === finalRound.weekNumber)
      ?.games.find(
        (game) =>
          semiLosers.has(game.home.entryId) &&
          semiLosers.has(game.away.entryId) &&
          decided(game),
      );
    if (candidate) {
      const homeScore = candidate.home.score ?? 0;
      const awayScore = candidate.away.score ?? 0;
      thirdPlaceEntryId =
        homeScore > awayScore ? candidate.home.entryId : candidate.away.entryId;
    }
  }

  return {
    championEntryId: final.winner,
    runnerUpEntryId: final.loser,
    finalWeek: finalRound.weekNumber,
    championScore: final.winScore,
    runnerUpScore: final.loseScore,
    byeEntryIds: rounds[0]?.byes ?? [],
    ...(thirdPlaceEntryId ? { thirdPlaceEntryId } : {}),
  };
};

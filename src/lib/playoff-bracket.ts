import type { HistoricalMatchup } from "@/types/history";

/**
 * Reconstructs the championship bracket from the games that were actually
 * played.
 *
 * The provider does not label which playoff-week games belong to the
 * championship bracket and which are consolation, so this walks the bracket
 * forward instead: start with the qualifying teams, and in each playoff week
 * the bracket games are the ones where *both* sides are still alive. Teams that
 * are alive but do not play that week are byes. Anything that does not fit that
 * shape makes the whole reconstruction bail out rather than guess.
 */

export type BracketSide = {
  teamName: string;
  logoURL?: string;
  score: number;
  won: boolean;
};

export type BracketGame = {
  id: string;
  week: number;
  home: BracketSide;
  away: BracketSide;
  winner: string;
  loser: string;
};

export type BracketNode =
  | { kind: "bye"; teamName: string; logoURL?: string }
  | { kind: "game"; game: BracketGame; children: BracketNode[] };

export type ResolvedBracket = {
  /** Columns from first round to final; every column is already in draw order. */
  columns: BracketNode[][];
  weeks: number[];
  final: BracketGame;
  champion: { teamName: string; logoURL?: string };
  runnerUp: { teamName: string; logoURL?: string };
  thirdPlaceGame?: BracketGame;
};

/**
 * A game only counts once it has produced a winner.
 *
 * The history snapshot carries every scheduled matchup, including weeks that
 * are live or have not kicked off, with a score of 0. Without this guard an
 * unplayed final reads as a 0-0 result and the away team gets crowned — so a
 * game with no points, or a tie the score cannot break, is treated as no
 * result at all.
 */
const hasWinner = (matchup: HistoricalMatchup) =>
  (matchup.home.score > 0 || matchup.away.score > 0) &&
  matchup.home.score !== matchup.away.score;

const toGame = (matchup: HistoricalMatchup): BracketGame => {
  const homeWon = matchup.home.score > matchup.away.score;
  return {
    id: matchup.id,
    week: matchup.week,
    home: {
      teamName: matchup.home.teamName,
      ...(matchup.home.logoURL ? { logoURL: matchup.home.logoURL } : {}),
      score: matchup.home.score,
      won: homeWon,
    },
    away: {
      teamName: matchup.away.teamName,
      ...(matchup.away.logoURL ? { logoURL: matchup.away.logoURL } : {}),
      score: matchup.away.score,
      won: !homeWon,
    },
    winner: homeWon ? matchup.home.teamName : matchup.away.teamName,
    loser: homeWon ? matchup.away.teamName : matchup.home.teamName,
  };
};

export const resolvePlayoffBracket = ({
  matchups,
  qualified,
  firstPlayoffWeek,
}: {
  matchups: HistoricalMatchup[];
  qualified: Array<{ teamName: string; logoURL?: string }>;
  firstPlayoffWeek: number | null;
}): ResolvedBracket | null => {
  if (firstPlayoffWeek === null || qualified.length < 2) return null;

  const logos = new Map(
    qualified.map((entry) => [entry.teamName, entry.logoURL]),
  );
  let alive = new Set(qualified.map((entry) => entry.teamName));

  const playoffWeeks = Array.from(
    new Set(
      matchups
        .filter((matchup) => matchup.week >= firstPlayoffWeek)
        .map((matchup) => matchup.week),
    ),
  ).sort((left, right) => left - right);
  if (playoffWeeks.length === 0) return null;

  const rounds: Array<{ week: number; games: BracketGame[]; byes: string[] }> =
    [];

  for (const week of playoffWeeks) {
    if (alive.size <= 1) break;

    const weekGames = matchups.filter((matchup) => matchup.week === week);
    const bracketGames: BracketGame[] = [];
    const played = new Set<string>();

    for (const matchup of weekGames) {
      const homeAlive = alive.has(matchup.home.teamName);
      const awayAlive = alive.has(matchup.away.teamName);
      if (!homeAlive && !awayAlive) continue;
      if (homeAlive !== awayAlive) {
        // A live team drawn against an eliminated one: the shape we assumed
        // does not hold, so report nothing rather than a plausible fiction.
        return null;
      }
      if (!hasWinner(matchup)) {
        // The bracket has reached a game that has not been decided yet, so
        // there is no champion to report. Callers fall back to the projection.
        return null;
      }
      bracketGames.push(toGame(matchup));
      played.add(matchup.home.teamName);
      played.add(matchup.away.teamName);
    }

    if (bracketGames.length === 0) continue;

    const byes = Array.from(alive).filter((team) => !played.has(team));
    rounds.push({ week, games: bracketGames, byes });
    alive = new Set([
      ...bracketGames.map((game) => game.winner),
      ...byes,
    ]);
  }

  const finalRound = rounds.at(-1);
  if (!finalRound || finalRound.games.length !== 1 || alive.size !== 1) {
    return null;
  }
  const final = finalRound.games[0];

  // Walk the bracket backwards so every column comes out in draw order.
  const nodeFor = (teamName: string, roundIndex: number): BracketNode => {
    if (roundIndex < 0) {
      return {
        kind: "bye",
        teamName,
        ...(logos.get(teamName) ? { logoURL: logos.get(teamName) } : {}),
      };
    }
    const source = rounds[roundIndex].games.find(
      (game) => game.winner === teamName,
    );
    if (!source) {
      return {
        kind: "bye",
        teamName,
        ...(logos.get(teamName) ? { logoURL: logos.get(teamName) } : {}),
      };
    }
    return {
      kind: "game",
      game: source,
      children: [
        nodeFor(source.home.teamName, roundIndex - 1),
        nodeFor(source.away.teamName, roundIndex - 1),
      ],
    };
  };

  const root: BracketNode = {
    kind: "game",
    game: final,
    children: [
      nodeFor(final.home.teamName, rounds.length - 2),
      nodeFor(final.away.teamName, rounds.length - 2),
    ],
  };

  const columns: BracketNode[][] = Array.from(
    { length: rounds.length },
    () => [],
  );
  const place = (node: BracketNode, depth: number) => {
    const column = rounds.length - 1 - depth;
    if (column < 0) return;
    columns[column].push(node);
    if (node.kind === "game") {
      node.children.forEach((child) => place(child, depth + 1));
    }
  };
  place(root, 0);

  // Third place: the game between the two losers of the round before the final.
  const semiRound = rounds.at(-2);
  let thirdPlaceGame: BracketGame | undefined;
  if (semiRound) {
    const semiLosers = new Set(semiRound.games.map((game) => game.loser));
    const candidate = matchups.find(
      (matchup) =>
        matchup.week === final.week &&
        semiLosers.has(matchup.home.teamName) &&
        semiLosers.has(matchup.away.teamName),
    );
    if (candidate) thirdPlaceGame = toGame(candidate);
  }

  const championName = final.winner;
  const runnerUpName = final.loser;

  return {
    columns,
    weeks: rounds.map((round) => round.week),
    final,
    champion: {
      teamName: championName,
      ...(logos.get(championName) ? { logoURL: logos.get(championName) } : {}),
    },
    runnerUp: {
      teamName: runnerUpName,
      ...(logos.get(runnerUpName) ? { logoURL: logos.get(runnerUpName) } : {}),
    },
    ...(thirdPlaceGame ? { thirdPlaceGame } : {}),
  };
};

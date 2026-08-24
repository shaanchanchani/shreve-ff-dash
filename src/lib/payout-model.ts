import type { PrizeData } from "@/types/prizes";
import type { LongestCard } from "@/lib/prize-calculations";
import {
  FIRST_PLACE_PAYOUT,
  LONGEST_QB_TD_PAYOUT,
  LONGEST_REC_TD_PAYOUT,
  LONGEST_RUSH_TD_PAYOUT,
  SEASON_PAYOUT,
  SURVIVOR_PAYOUT,
  UNLUCKY_PAYOUT,
  WEEKLY_PAYOUT,
} from "@/lib/prize-calculations";
import { qualifiedFromStandings, seasonRules } from "@/lib/standings";

/**
 * The money picture, prize by prize.
 *
 * A presentation layer only: it reads the locked prize constants and the settled
 * facts in the snapshots, defines no awards, and never invents a payout. A prize
 * counts as decided only when the data names exactly one holder; otherwise it
 * stays open, and only to the teams that could still win it. A prize nobody can
 * win any more is counted in neither column.
 *
 * prize-calculations.ts is untouched and is not the display authority — its
 * getTeamSummaries only ever saw weekly and season-high money.
 */

const LONGEST_AMOUNT: Record<string, number> = {
  longest_started_rushing_td: LONGEST_RUSH_TD_PAYOUT,
  longest_started_receiving_td: LONGEST_REC_TD_PAYOUT,
  longest_started_passing_td: LONGEST_QB_TD_PAYOUT,
};

export const LONGEST_KEYS = Object.keys(LONGEST_AMOUNT);

export const longestAmountFor = (key: string) => LONGEST_AMOUNT[key] ?? 0;

/**
 * Every prize in the structure, summed for this season's rules. Not a pot and
 * not dues — the awards themselves. Weekly scales with the season length.
 */
export const totalAwardsDefined = (prizeData: PrizeData) =>
  WEEKLY_PAYOUT * seasonRules(prizeData).regularSeasonWeeks +
  SEASON_PAYOUT +
  UNLUCKY_PAYOUT +
  SURVIVOR_PAYOUT +
  LONGEST_RUSH_TD_PAYOUT +
  LONGEST_REC_TD_PAYOUT +
  LONGEST_QB_TD_PAYOUT +
  FIRST_PLACE_PAYOUT;

/**
 * Whether the regular season has closed.
 *
 * Prefers `completedWeeks`, which counts only weeks the provider marks final.
 * Older snapshots lack it, so those fall back to counting scored weeks — which
 * settles a few days early during the last week, hence the preference.
 */
export const regularSeasonComplete = (prizeData: PrizeData) => {
  const scheduled = seasonRules(prizeData).regularSeasonWeeks;
  const finished = prizeData.completedWeeks ?? prizeData.weeklyHighScores.length;
  return finished >= scheduled;
};

/**
 * Survivor is the last team standing. The snapshot keeps cutting the lowest
 * scorer every week, so once the pool is down to one it cuts that team too — the
 * award is then unresolved in the data rather than won. We report what the data
 * says and name the last team out, without declaring a winner it does not.
 */
export const survivorState = (prizeData: PrizeData) => {
  const eliminations = [...prizeData.survivorEliminations].sort(
    (left, right) => left.week - right.week,
  );
  const eliminated = new Set(eliminations.map((entry) => entry.teamName));
  const field = new Set<string>([
    ...prizeData.standings.map((entry) => entry.teamName),
    ...eliminations.map((entry) => entry.teamName),
  ]);
  const alive = Array.from(field).filter((name) => !eliminated.has(name)).sort();
  const finalEntrant = eliminations.at(-1);

  return {
    eliminations,
    alive,
    fieldSize: field.size,
    /** The team that outlasted every other before the pool emptied. */
    finalEntrant: alive.length === 0 ? finalEntrant : undefined,
    poolExhausted: alive.length === 0 && eliminations.length > 0,
  };
};

/** Weeks that actually produced a scored winner. */
export const scoredWeeks = (prizeData: PrizeData) =>
  prizeData.weeklyHighScores.filter((winner) => winner.score > 0);

export const weeklyWinCounts = (prizeData: PrizeData) => {
  const counts = new Map<
    string,
    { teamName: string; wins: number; logoURL?: string }
  >();
  scoredWeeks(prizeData).forEach((winner) => {
    const existing = counts.get(winner.teamName);
    if (existing) {
      existing.wins += 1;
      return;
    }
    counts.set(winner.teamName, {
      teamName: winner.teamName,
      wins: 1,
      ...(winner.logoURL ? { logoURL: winner.logoURL } : {}),
    });
  });
  return Array.from(counts.values()).sort(
    (left, right) =>
      right.wins - left.wins || left.teamName.localeCompare(right.teamName),
  );
};

export type PayoutLine = { label: string; amount: number };

export type PayoutRow = {
  teamName: string;
  logoURL?: string;
  /** Prize money the data has actually settled on this team. */
  decided: number;
  /** Decided plus every prize still open to this team. */
  max: number;
  lines: PayoutLine[];
};

export type PayoutLedger = {
  rows: PayoutRow[];
  totalDecided: number;
  totalDefined: number;
  /** False once every prize has a holder or can no longer be won. */
  anythingOpen: boolean;
  /** True while a deferred source has not answered yet. */
  pending: boolean;
  /** True when the survivor award can no longer be won by anyone. */
  survivorUnresolved: boolean;
};

export const buildPayoutLedger = ({
  prizeData,
  longestCards,
  champion,
  pending,
}: {
  prizeData: PrizeData;
  longestCards: LongestCard[];
  champion?: string | null;
  /**
   * Sources that arrive after the prizes snapshot. While one is outstanding its
   * prizes are counted in neither column, so the table never shows a number that
   * is about to change.
   */
  pending?: { longest?: boolean; champion?: boolean };
}): PayoutLedger => {
  const rules = seasonRules(prizeData);
  const complete = regularSeasonComplete(prizeData);
  const survivor = survivorState(prizeData);
  const longestPending = Boolean(pending?.longest);
  const championPending = Boolean(pending?.champion);

  const decided = new Map<string, number>();
  const lines = new Map<string, PayoutLine[]>();
  const openTo = new Map<string, number>();
  let openToAll = 0;

  const logos = new Map(
    prizeData.standings.map((entry) => [entry.teamName, entry.logoURL]),
  );

  const award = (teamName: string | undefined, amount: number, label: string) => {
    if (!teamName || !amount) return;
    decided.set(teamName, (decided.get(teamName) ?? 0) + amount);
    lines.set(teamName, [...(lines.get(teamName) ?? []), { label, amount }]);
  };
  const openFor = (teamNames: string[], amount: number) => {
    teamNames.forEach((teamName) =>
      openTo.set(teamName, (openTo.get(teamName) ?? 0) + amount),
    );
  };

  // Weekly top score — one settled award per scored week.
  const weeks = scoredWeeks(prizeData);
  weeks.forEach((winner) => {
    award(winner.teamName, WEEKLY_PAYOUT, `Week ${winner.week}`);
  });
  openToAll += Math.max(0, rules.regularSeasonWeeks - weeks.length) * WEEKLY_PAYOUT;

  // Season high and unlucky settle when the regular season closes.
  if (prizeData.seasonHighScore && complete) {
    award(prizeData.seasonHighScore.teamName, SEASON_PAYOUT, "Season high");
  } else if (!complete) {
    openToAll += SEASON_PAYOUT;
  }

  const unluckyLeader = prizeData.unluckyTeams[0];
  if (unluckyLeader && complete) {
    award(unluckyLeader.teamName, UNLUCKY_PAYOUT, "Unlucky");
  } else if (!complete) {
    openToAll += UNLUCKY_PAYOUT;
  }

  // Survivor: decided only with exactly one team left. An emptied pool leaves
  // the award unwinnable, so it is neither awarded nor counted as open.
  if (survivor.alive.length === 1) {
    award(survivor.alive[0], SURVIVOR_PAYOUT, "Survivor");
  } else if (!survivor.poolExhausted && survivor.alive.length > 1) {
    openFor(survivor.alive, SURVIVOR_PAYOUT);
  }

  /**
   * Longest touchdowns run over the whole fantasy season, playoffs included —
   * the current rushing record is a week-17 play — so they settle when the
   * season is actually over, not when the regular season closes.
   */
  const seasonOver = Boolean(champion);
  if (!longestPending) {
    LONGEST_KEYS.forEach((key) => {
      const amount = longestAmountFor(key);
      const card = longestCards.find((entry) => entry.key === key);
      if (seasonOver && card?.data.fantasy_owner) {
        award(card.data.fantasy_owner, amount, `Longest ${card.label.toLowerCase()} TD`);
        return;
      }
      // Once the season is over with no holder recorded, nobody can win it.
      if (seasonOver) return;
      openToAll += amount;
    });
  }

  // Championship: decided from the played bracket, otherwise open to the field
  // that qualified once the regular season has closed.
  if (!championPending) {
    if (champion) {
      award(champion, FIRST_PLACE_PAYOUT, "Champion");
    } else if (complete) {
      openFor(
        qualifiedFromStandings(prizeData).map((entry) => entry.teamName),
        FIRST_PLACE_PAYOUT,
      );
    } else {
      openToAll += FIRST_PLACE_PAYOUT;
    }
  }

  const toRow = (teamName: string): PayoutRow => {
    const won = decided.get(teamName) ?? 0;
    return {
      teamName,
      ...(logos.get(teamName) ? { logoURL: logos.get(teamName) } : {}),
      decided: won,
      max: won + openToAll + (openTo.get(teamName) ?? 0),
      lines: lines.get(teamName) ?? [],
    };
  };

  const listed = new Set(prizeData.standings.map((entry) => entry.teamName));
  // A holder the standings do not list — a rename that reached one snapshot but
  // not the other — must still appear, or its money silently disappears.
  const unlisted = Array.from(decided.keys()).filter((name) => !listed.has(name));

  const rows = [...prizeData.standings.map((entry) => entry.teamName), ...unlisted]
    .map(toRow)
    .sort(
      (left, right) =>
        right.decided - left.decided ||
        right.max - left.max ||
        left.teamName.localeCompare(right.teamName),
    );

  return {
    rows,
    totalDecided: rows.reduce((sum, row) => sum + row.decided, 0),
    totalDefined: totalAwardsDefined(prizeData),
    anythingOpen: rows.some((row) => row.max > row.decided),
    pending: longestPending || championPending,
    survivorUnresolved: survivor.poolExhausted,
  };
};

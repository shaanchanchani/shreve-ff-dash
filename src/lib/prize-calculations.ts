import type {
  PrizeData,
  LongestTDs,
  LongestKey,
  LedgerEntry,
  TeamSummary,
  TouchdownData,
} from "@/types/prizes";

export const WEEKLY_PAYOUT = 10;
export const SEASON_PAYOUT = 25;
export const UNLUCKY_PAYOUT = 10;
export const SURVIVOR_PAYOUT = 10;
export const LONGEST_QB_TD_PAYOUT = 15;
export const LONGEST_REC_TD_PAYOUT = 15;
export const LONGEST_RUSH_TD_PAYOUT = 15;
export const FIRST_PLACE_PAYOUT = 210;
export const TOTAL_REGULAR_SEASON_WEEKS = 14;

export const longestConfigs: Array<{ key: LongestKey; label: string }> = [
  { key: "longest_started_rushing_td", label: "Rushing" },
  { key: "longest_started_receiving_td", label: "Receiving" },
  { key: "longest_started_passing_td", label: "Passing" },
];

export type LongestCard = (typeof longestConfigs)[number] & {
  data: TouchdownData;
};

const addCash = (
  ledger: Map<string, LedgerEntry>,
  team: string,
  amount: number,
  note: string,
) => {
  if (!team) return;
  const existing = ledger.get(team) ?? { amount: 0, hits: 0, notes: [] };
  existing.amount += amount;
  existing.hits += 1;
  existing.notes = [...existing.notes, note];
  ledger.set(team, existing);
};

export const buildLedger = (prizeData: PrizeData | null) => {
  const ledger = new Map<string, LedgerEntry>();
  const weeklyWeeks = new Set<number>();

  if (!prizeData) {
    return { ledger, weeklyWeeks };
  }

  prizeData.weeklyHighScores.forEach((winner) => {
    weeklyWeeks.add(winner.week);
    addCash(ledger, winner.teamName, WEEKLY_PAYOUT, `Week ${winner.week}`);
  });

  if (prizeData.seasonHighScore) {
    addCash(
      ledger,
      prizeData.seasonHighScore.teamName,
      SEASON_PAYOUT,
      "Season Apex",
    );
  }

  return { ledger, weeklyWeeks };
};

export const getClaimedRows = (ledger: Map<string, LedgerEntry>) =>
  Array.from(ledger.entries()).sort((a, b) => {
    if (b[1].amount === a[1].amount) return a[0].localeCompare(b[0]);
    return b[1].amount - a[1].amount;
  });

const collectAllTeams = (prizeData: PrizeData): Set<string> => {
  const teams = new Set<string>();
  prizeData.weeklyHighScores.forEach((winner) => teams.add(winner.teamName));
  prizeData.unluckyTeams.forEach((team) => teams.add(team.teamName));
  prizeData.survivorEliminations.forEach((team) => teams.add(team.teamName));
  if (prizeData.seasonHighScore) {
    teams.add(prizeData.seasonHighScore.teamName);
  }
  return teams;
};

export const getTeamSummaries = (
  prizeData: PrizeData,
  ledger: Map<string, LedgerEntry>,
  weeklyWeeks: Set<number>,
): TeamSummary[] => {
  const teamPayouts = Array.from(collectAllTeams(prizeData)).map(
    (teamName) => {
      const currentEarnings = ledger.get(teamName)?.amount ?? 0;
      const remainingWeeks = TOTAL_REGULAR_SEASON_WEEKS - weeklyWeeks.size;

      let maxPayout = currentEarnings;
      maxPayout += remainingWeeks * WEEKLY_PAYOUT;

      if (!prizeData.seasonHighScore) {
        maxPayout += SEASON_PAYOUT;
      }

      const isUnluckyLeader =
        prizeData.unluckyTeams.length > 0 &&
        prizeData.unluckyTeams[0].teamName === teamName;
      if (isUnluckyLeader || prizeData.unluckyTeams.length === 0) {
        maxPayout += UNLUCKY_PAYOUT;
      }

      maxPayout +=
        LONGEST_QB_TD_PAYOUT + LONGEST_REC_TD_PAYOUT + LONGEST_RUSH_TD_PAYOUT;

      const isEliminated = prizeData.survivorEliminations.some(
        (elimination) => elimination.teamName === teamName,
      );
      if (!isEliminated) {
        maxPayout += SURVIVOR_PAYOUT;
      }

      maxPayout += FIRST_PLACE_PAYOUT;

      return {
        teamName,
        minPayout: currentEarnings,
        maxPayout,
      };
    },
  );

  return teamPayouts.sort((a, b) => {
    if (b.minPayout !== a.minPayout) {
      return b.minPayout - a.minPayout;
    }
    return b.maxPayout - a.maxPayout;
  });
};

export const getLongestCards = (longestTDs: LongestTDs | null) => {
  if (!longestTDs) return [] as LongestCard[];

  return longestConfigs
    .map((config) => {
      const payload = longestTDs[config.key];
      if (!payload) return null;
      return { ...config, data: payload };
    })
    .filter((card): card is LongestCard => Boolean(card));
};

export const getTeamLogo = (prizeData: PrizeData, teamName: string) => {
  const weeklyWinner = prizeData.weeklyHighScores.find(
    (winner) => winner.teamName === teamName,
  );
  if (weeklyWinner?.logoURL) return weeklyWinner.logoURL;

  const unlucky = prizeData.unluckyTeams.find(
    (team) => team.teamName === teamName,
  );
  if (unlucky?.logoURL) return unlucky.logoURL;

  const survivor = prizeData.survivorEliminations.find(
    (team) => team.teamName === teamName,
  );
  if (survivor?.logoURL) return survivor.logoURL;

  if (prizeData.seasonHighScore?.teamName === teamName) {
    return prizeData.seasonHighScore.logoURL;
  }

  return undefined;
};

export const getSurvivingTeams = (prizeData: PrizeData) => {
  const eliminatedTeamNames = new Set(
    prizeData.survivorEliminations.map((team) => team.teamName),
  );
  const allTeamNames = new Set([
    ...prizeData.weeklyHighScores.map((winner) => winner.teamName),
    ...prizeData.unluckyTeams.map((team) => team.teamName),
    ...(prizeData.seasonHighScore
      ? [prizeData.seasonHighScore.teamName]
      : []),
    ...prizeData.survivorEliminations.map((team) => team.teamName),
  ]);

  return Array.from(allTeamNames)
    .filter((team) => !eliminatedTeamNames.has(team))
    .sort((a, b) => a.localeCompare(b));
};

export const formatCurrency = (value: number) => `$${Math.round(value)}`;

export interface Player {
  name: string;
  position: string;
  points: number;
  team: string;
  headshot?: string;
}

export interface HighScore {
  teamName: string;
  score: number;
  week?: number;
  logoURL?: string;
  topPlayers?: Player[];
}

export interface WeeklyWinner {
  week: number;
  teamName: string;
  score: number;
  logoURL?: string;
}

export interface EliminatedTeam {
  week: number;
  teamName: string;
  score: number;
  logoURL?: string;
}

export interface UnluckyTeam {
  teamName: string;
  pointsAgainst: number;
  rank: number;
  logoURL?: string;
}

export interface TeamStanding {
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  logoURL?: string;
  playoffOdds?: number; // 0-1 percentage
  byeOdds?: number; // 0-1 percentage
  clinchedPlayoffs?: boolean;
  clinchedBye?: boolean;
}

export interface TouchdownData {
  player: string;
  yards: number;
  week: number;
  fantasy_owner?: string;
  player_id?: number;
}

export interface LongestTDs {
  rushing_tds?: TouchdownData[];
  receiving_tds?: TouchdownData[];
  passing_tds?: TouchdownData[];
  longest_started_rushing_td?: TouchdownData;
  longest_started_receiving_td?: TouchdownData;
  longest_started_passing_td?: TouchdownData;
}

export interface LeagueMedianStat {
  winsAboveMedian: number;
  totalWins: number;
  percentage: number;
}

export interface PlayoffEntryRef {
  seasonEntryId?: string;
  memberId?: string;
  teamName: string;
  logoURL?: string;
}

export interface PlayoffResult {
  champion: PlayoffEntryRef | null;
  runnerUp: PlayoffEntryRef | null;
  finalWeek: number;
  championScore: number;
  runnerUpScore: number;
  byeTeamNames?: string[];
  thirdPlace?: PlayoffEntryRef | null;
}

export interface LiveWeek {
  number: number;
  topScore: { teamName: string; score: number; logoURL?: string } | null;
}

export interface PrizeData {
  /** Regular-season weeks the provider marks final. Absent on older snapshots. */
  completedWeeks?: number;
  /** False when week state was missing and the legacy week filter was used. */
  weekStatesTrustworthy?: boolean;
  seasonStatus?: "planned" | "preseason" | "active" | "complete";
  liveWeek?: LiveWeek | null;
  playoffResult?: PlayoffResult | null;
  rules?: {
    regularSeasonWeeks: number;
    playoffTeamCount: number;
    playoffByeCount: number;
    medianWinEnabled: boolean;
  };
  seasonHighScore: HighScore | null;
  weeklyHighScores: WeeklyWinner[];
  survivorEliminations: EliminatedTeam[];
  unluckyTeams: UnluckyTeam[];
  standings: TeamStanding[];
  leagueMedianStats?: LeagueMedianStat;
}

export type LongestKey =
  | "longest_started_rushing_td"
  | "longest_started_receiving_td"
  | "longest_started_passing_td";

export type LedgerEntry = {
  amount: number;
  hits: number;
  notes: string[];
};

export interface TeamSummary {
  teamName: string;
  minPayout: number;
  maxPayout: number;
}

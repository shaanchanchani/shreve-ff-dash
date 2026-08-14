export type HistoricalPlayer = {
  id: string | number;
  name: string;
  position: string;
  points: number;
  wasDraftedByTeam?: boolean;
  realPosition?: string;
  effectiveWaiverPoints?: number;
  headshotURL?: string;
};

export type HistoricalMatchupTeam = {
  ownerKey: string;
  ownerName: string;
  teamId: string | number;
  teamName: string;
  logoURL?: string;
  score: number;
  /** Absent on the summary read model, which strips lineups. */
  roster?: HistoricalPlayer[];
  rosterUnavailable: boolean;
  waiverPoints: number;
};

export type HistoricalMatchup = {
  id: string;
  seasonId: number;
  week: number;
  /** Canonical week phase. Absent on snapshots built before it was recorded. */
  phase?: "regular" | "playoffs" | "consolation";
  label: string;
  home: HistoricalMatchupTeam;
  away: HistoricalMatchupTeam;
};

export type OwnerSummary = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalPointsFor: number;
  totalPointsAgainst: number;
  totalWaiverPoints: number;
  winPct: number;
  seasonsParticipated: number;
  logos: Array<{ seasonId: number; logoURL?: string }>;
};

export type SeasonDescriptor = {
  seasonId: number;
  hasRosterData: boolean;
  teams: Array<{
    teamId: string | number;
    teamName: string;
    ownerName: string;
    ownerKey: string;
    logoURL?: string;
  }>;
};

export type LeagueHistoryResponse = {
  owners: OwnerSummary[];
  matchups: HistoricalMatchup[];
  seasons: SeasonDescriptor[];
  playerMedia?: Record<string, string>;
  generatedAt: string;
  notes: string[];
};

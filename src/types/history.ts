export type HistoricalPlayer = {
  id: number;
  name: string;
  position: string;
  points: number;
};

export type HistoricalMatchupTeam = {
  ownerKey: string;
  ownerName: string;
  teamId: number;
  teamName: string;
  logoURL?: string;
  score: number;
  roster: HistoricalPlayer[];
  rosterUnavailable: boolean;
};

export type HistoricalMatchup = {
  id: string;
  seasonId: number;
  week: number;
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
  winPct: number;
  seasonsParticipated: number;
  logos: Array<{ seasonId: number; logoURL?: string }>;
};

export type SeasonDescriptor = {
  seasonId: number;
  hasRosterData: boolean;
  teams: Array<{
    teamId: number;
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
  generatedAt: string;
  notes: string[];
};

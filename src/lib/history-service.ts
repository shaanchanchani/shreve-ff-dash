import { Client } from "espn-fantasy-football-api/node";
import type {
  HistoricalMatchup,
  HistoricalMatchupTeam,
  LeagueHistoryResponse,
  OwnerSummary,
  SeasonDescriptor,
} from "@/types/history";

type SeasonSnapshot = SeasonDescriptor & {
  matchups: HistoricalMatchup[];
};

type TeamMeta = SeasonDescriptor["teams"][number];

type ClientTeamResponse = {
  id: number;
  name?: string | null;
  ownerName?: string | null;
  logoURL?: string | null;
};

type ClientRosterEntry = {
  id?: number;
  fullName?: string | null;
  rosteredPosition?: string | null;
  position?: string | null;
  totalPoints?: number;
  player?: {
    id?: number;
    fullName?: string | null;
    name?: string | null;
  };
  athlete?: {
    id?: number;
  };
};

type ClientBoxscore = {
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number;
  awayScore?: number;
  homeRoster?: ClientRosterEntry[];
  awayRoster?: ClientRosterEntry[];
};

type LegacyClient = {
  getHistoricalTeamsAtWeek: (args: {
    seasonId: number;
    scoringPeriodId: number;
  }) => Promise<ClientTeamResponse[]>;
  getHistoricalScoreboardForWeek: (args: {
    seasonId: number;
    matchupPeriodId: number;
    scoringPeriodId: number;
  }) => Promise<ClientBoxscore[]>;
};

const CACHE_DURATION_MS = 1000 * 60 * 60 * 3; // 3 hours
const MAX_EMPTY_WEEKS = 3;
const MAX_SCORING_PERIOD = 18;
const MAX_SEASONS_TO_CHECK = 12;
const OLDEST_SEASON_TO_TRY = 2010;

let cachedHistory: LeagueHistoryResponse | null = null;
let cacheTimestamp = 0;

export async function loadLeagueHistory(): Promise<LeagueHistoryResponse> {
  const now = Date.now();
  if (cachedHistory && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedHistory;
  }

  const leagueId = Number.parseInt(process.env.LEAGUE_ID ?? "", 10);
  if (!leagueId) {
    throw new Error("LEAGUE_ID env var is required to load league history.");
  }

  const client = new Client({
    leagueId,
    espnS2: process.env.espn_s2,
    SWID: process.env.SWID,
  });

  const currentSeason = determineCurrentSeason();
  const seasons: SeasonSnapshot[] = [];
  let consecutiveMisses = 0;

  for (
    let seasonId = currentSeason;
    seasonId >= OLDEST_SEASON_TO_TRY && seasons.length < MAX_SEASONS_TO_CHECK;
    seasonId--
  ) {
    const snapshot = await fetchSeasonSnapshot(client, seasonId);
    if (!snapshot) {
      consecutiveMisses += 1;
      if (consecutiveMisses >= 2 && seasonId < currentSeason) {
        break;
      }
      continue;
    }

    seasons.push(snapshot);
    consecutiveMisses = 0;
  }

  if (!seasons.length) {
    throw new Error("No historical seasons found for this league.");
  }

  const sortedSeasons = seasons.sort((a, b) => b.seasonId - a.seasonId);
  const flattenedMatchups = sortedSeasons.flatMap((season) => season.matchups);
  const owners = buildOwnerSummaries(sortedSeasons, flattenedMatchups);

  const response: LeagueHistoryResponse = {
    owners,
    matchups: flattenedMatchups.sort(sortMatchupsDesc),
    seasons: sortedSeasons.map(({ seasonId, hasRosterData, teams }) => ({
      seasonId,
      hasRosterData,
      teams,
    })),
    generatedAt: new Date().toISOString(),
    notes: [
      "Data comes from the espn-fantasy-football-api client (see reference/ESPN-Fantasy-Football-API).",
      "Roster-level lineups are only available from 2018 forward; earlier ESPN seasons expose scoreboard data but no lineups.",
      `Detected seasons: ${sortedSeasons.map((season) => season.seasonId).join(", ")}`,
    ],
  };

  cachedHistory = response;
  cacheTimestamp = now;
  return response;
}

const determineCurrentSeason = () => {
  const override = Number.parseInt(
    process.env.NEXT_PUBLIC_CURRENT_SEASON ?? "",
    10,
  );
  if (!Number.isNaN(override) && override > 0) {
    return override;
  }
  const year = new Date().getFullYear();
  return year;
};

const fetchSeasonSnapshot = async (
  client: Client,
  seasonId: number,
): Promise<SeasonSnapshot | null> => {
  const hasRosterData = seasonId >= 2018;
  const legacyClient = client as unknown as LegacyClient;
  const teamFetcher = hasRosterData
    ? client.getTeamsAtWeek.bind(client)
    : legacyClient.getHistoricalTeamsAtWeek.bind(client);

  let teamsResponse: ClientTeamResponse[] | null = null;
  try {
    const response = await teamFetcher({
      seasonId,
      scoringPeriodId: 1,
    });
    teamsResponse = Array.isArray(response) ? response : null;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    console.warn(`[history] Failed to fetch team data for ${seasonId}`, error);
    return null;
  }

  if (!Array.isArray(teamsResponse) || teamsResponse.length === 0) {
    return null;
  }

  const teams = teamsResponse.map((team) => ({
    teamId: team.id,
    teamName: team.name ?? `Team ${team.id}`,
    ownerName: team.ownerName ?? team.name ?? `Team ${team.id}`,
    ownerKey: buildOwnerKey(team.ownerName ?? team.name ?? `team-${team.id}`),
    logoURL: team.logoURL ?? undefined,
  }));

  const teamLookup = new Map<number, TeamMeta>();
  teams.forEach((team) => teamLookup.set(team.teamId, team));

  const matchups: HistoricalMatchup[] = [];
  let emptyWeekCount = 0;

  for (let week = 1; week <= MAX_SCORING_PERIOD; week++) {
    const boxscoreFetcher = hasRosterData
      ? client.getBoxscoreForWeek.bind(client)
      : legacyClient.getHistoricalScoreboardForWeek.bind(client);

    let boxscores: ClientBoxscore[] = [];
    try {
      const response = await boxscoreFetcher({
        seasonId,
        matchupPeriodId: week,
        scoringPeriodId: week,
      });
      boxscores = Array.isArray(response) ? response : [];
    } catch (error) {
      if (isNotFoundError(error)) {
        emptyWeekCount += 1;
        if (emptyWeekCount >= MAX_EMPTY_WEEKS) {
          break;
        }
        continue;
      }

      console.warn(
        `[history] Failed to fetch boxscore for season ${seasonId}, week ${week}`,
        error,
      );
      continue;
    }

    if (!Array.isArray(boxscores) || boxscores.length === 0) {
      emptyWeekCount += 1;
      if (emptyWeekCount >= MAX_EMPTY_WEEKS) {
        break;
      }
      continue;
    }

    emptyWeekCount = 0;

    boxscores.forEach((boxscore) => {
      const homeMeta = teamLookup.get(boxscore.homeTeamId);
      const awayMeta = teamLookup.get(boxscore.awayTeamId);

      if (!homeMeta || !awayMeta) {
        return;
      }

      const homeScore = normalizeScore(boxscore.homeScore);
      const awayScore = normalizeScore(boxscore.awayScore);
      const unplayed = homeScore === 0 && awayScore === 0;

      if (unplayed) {
        return;
      }

      matchups.push({
        id: `${seasonId}-${week}-${boxscore.homeTeamId}-${boxscore.awayTeamId}`,
        seasonId,
        week,
        label: `Week ${week}`,
        home: buildMatchupTeam(boxscore.homeRoster, homeMeta, homeScore, hasRosterData),
        away: buildMatchupTeam(boxscore.awayRoster, awayMeta, awayScore, hasRosterData),
      });
    });
  }

  if (!matchups.length) {
    return null;
  }

  return {
    seasonId,
    hasRosterData,
    teams,
    matchups,
  };
};

const buildMatchupTeam = (
  rosterEntries: ClientRosterEntry[] | undefined,
  meta: TeamMeta,
  score: number,
  hasRosterData: boolean,
): HistoricalMatchupTeam => {
  const roster = convertRoster(rosterEntries);
  return {
    ownerKey: meta.ownerKey,
    ownerName: meta.ownerName,
    teamId: meta.teamId,
    teamName: meta.teamName,
    logoURL: meta.logoURL,
    score,
    roster,
    rosterUnavailable: !hasRosterData || roster.length === 0,
  };
};

const convertRoster = (entries: ClientRosterEntry[] | undefined) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      const name =
        entry?.fullName ||
        entry?.player?.fullName ||
        entry?.player?.name ||
        "Unknown Player";

      return {
        id: derivePlayerId(entry, name),
        name,
        position: entry?.rosteredPosition ?? entry?.position ?? "BN",
        points: typeof entry?.totalPoints === "number" ? entry.totalPoints : 0,
      };
    })
    .filter((player) => Number.isFinite(player.points))
    .sort((a, b) => b.points - a.points);
};

const normalizeScore = (score: unknown) => {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 0;
  }
  return Math.round(score * 10) / 10;
};

const buildOwnerSummaries = (
  seasons: SeasonSnapshot[],
  matchups: HistoricalMatchup[],
) => {
  const ownerMap = new Map<string, OwnerSummary & { seasons: Set<number> }>();

  const ensureOwner = (ownerKey: string, ownerName: string) => {
    if (!ownerMap.has(ownerKey)) {
      ownerMap.set(ownerKey, {
        ownerKey,
        ownerName,
        latestTeamName: ownerName,
        totalWins: 0,
        totalLosses: 0,
        totalTies: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        winPct: 0,
        seasonsParticipated: 0,
        logos: [],
        seasons: new Set<number>(),
      });
    }
    return ownerMap.get(ownerKey)!;
  };

  seasons.forEach((season) => {
    season.teams.forEach((team) => {
      const owner = ensureOwner(team.ownerKey, team.ownerName);
      owner.latestTeamName = team.teamName;
      owner.logos.push({ seasonId: season.seasonId, logoURL: team.logoURL });
      owner.seasons.add(season.seasonId);
    });
  });

  matchups.forEach((matchup) => {
    const participants = [
      { team: matchup.home, opponent: matchup.away },
      { team: matchup.away, opponent: matchup.home },
    ];

    participants.forEach(({ team, opponent }) => {
      const owner = ensureOwner(team.ownerKey, team.ownerName);
      owner.totalPointsFor += team.score;
      owner.totalPointsAgainst += opponent.score;

      if (team.score > opponent.score) {
        owner.totalWins += 1;
      } else if (team.score < opponent.score) {
        owner.totalLosses += 1;
      } else {
        owner.totalTies += 1;
      }
    });
  });

  const owners: OwnerSummary[] = Array.from(ownerMap.values()).map(
    ({ seasons, ...owner }) => {
      const games =
        owner.totalWins + owner.totalLosses + owner.totalTies || 1;
      const winPct = (owner.totalWins + 0.5 * owner.totalTies) / games;

      return {
        ...owner,
        winPct: Math.round(winPct * 1000) / 1000,
        seasonsParticipated: seasons.size,
      };
    },
  );

  owners.sort((a, b) => {
    if (b.winPct !== a.winPct) {
      return b.winPct - a.winPct;
    }
    if (b.totalWins !== a.totalWins) {
      return b.totalWins - a.totalWins;
    }
    return a.ownerName.localeCompare(b.ownerName);
  });

  return owners;
};

type AxiosLikeError = {
  response?: {
    status?: number;
  };
};

const isNotFoundError = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as AxiosLikeError).response;
    return typeof response?.status === "number" && response.status === 404;
  }
  return false;
};

const buildOwnerKey = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return normalized || `owner-${Buffer.from(value).toString("hex")}`;
};

const sortMatchupsDesc = (a: HistoricalMatchup, b: HistoricalMatchup) => {
  if (a.seasonId !== b.seasonId) {
    return b.seasonId - a.seasonId;
  }
  return b.week - a.week;
};

const derivePlayerId = (
  entry: ClientRosterEntry,
  fallbackLabel: string,
) => {
  if (typeof entry?.id === "number") return entry.id;
  if (typeof entry?.player?.id === "number") return entry.player.id;
  if (typeof entry?.athlete?.id === "number") return entry.athlete.id;

  const key = `${fallbackLabel}-${entry?.rosteredPosition ?? "slot"}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

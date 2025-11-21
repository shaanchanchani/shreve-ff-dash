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
    defaultPositionId?: number;
  };
  athlete?: {
    id?: number;
  };
};

type ClientDraftPick = {
  id: number;
  playerId?: number;
  teamId: number;
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
    141,
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

  // Fetch draft data if available
  const draftedPlayersSet = new Set<number>();
  if (hasRosterData) {
    try {
      const draftPicks = (await client.getDraftInfo({
        seasonId,
      })) as ClientDraftPick[];
      
      if (Array.isArray(draftPicks)) {
        draftPicks.forEach((pick) => {
          const pid = pick.playerId ?? pick.id;
          if (pid) {
            draftedPlayersSet.add(pid);
          }
        });
      }
    } catch (error) {
      console.warn(`[history] Failed to fetch draft data for ${seasonId}`, error);
      // Not critical, just means waiver stats will be inaccurate for this season
    }
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

  // Track which team "discovered" an undrafted player first
  // Map<PlayerId, TeamId>
  const waiverClaims = new Map<number, number>();
  // Track player roster status from previous week to detect drops
  // Map<PlayerId, TeamId>
  let lastWeekRosters = new Map<number, number>();

  const matchups: HistoricalMatchup[] = [];
  let emptyWeekCount = 0;
  let bootstrappedDraftFromRosters = false;

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

    // Build current week's roster map and update claims
    // We need to do this BEFORE processing matchups for waiver points
    // to capture the state of the league for this week.
    const currentWeekRosters = new Map<number, number>();
    
    // Calculate weekly positional thresholds (Top 24)
    const positionalScores: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [], "D/ST": [], K: [] };
    
    if (hasRosterData) {
       boxscores.forEach((boxscore) => {
          [boxscore.homeRoster, boxscore.awayRoster].forEach((rosterEntries, index) => {
             const teamId = index === 0 ? boxscore.homeTeamId : boxscore.awayTeamId;
             if (!Array.isArray(rosterEntries)) return;
             
             rosterEntries.forEach((entry) => {
                 const pid = derivePlayerId(entry, "unknown");
                 const realPos = getRealPosition(entry);
                 const pts = typeof entry.totalPoints === 'number' ? entry.totalPoints : 0;

                 if (realPos && positionalScores[realPos] && pts > 0) {
                    positionalScores[realPos].push(pts);
                 }
                 
                 // Skip if drafted globally
                 if (draftedPlayersSet.has(pid)) return;
                 
                 currentWeekRosters.set(pid, teamId);
                 
                 // Check claim logic
                 if (!waiverClaims.has(pid)) {
                    // New discovery! Claim it.
                    waiverClaims.set(pid, teamId);
                 } else {
                    const claimedBy = waiverClaims.get(pid);
                    const lastOwner = lastWeekRosters.get(pid);
                    
                    // If owned by someone else last week, and now owned by this team
                    // It's a direct transfer (Trade). Keep original claim.
                    if (lastOwner && lastOwner !== teamId) {
                       // Do nothing. Claim stays with original discoverer.
                    } 
                    // If NOT owned last week (was dropped), but has an old claim
                    // It means they cleared waivers. New Claim!
                    else if (!lastOwner && claimedBy !== teamId) {
                       waiverClaims.set(pid, teamId);
                    }
                 }
             });
          });
       });

       // Offline drafts don't always populate the draft API.
       // If we never got any draft picks, treat the first set of rosters
       // as the drafted player pool so obvious studs (Kyler, etc.) don't
       // show up as waiver snipes.
       if (
         !bootstrappedDraftFromRosters &&
         draftedPlayersSet.size === 0 &&
         currentWeekRosters.size > 0
       ) {
         currentWeekRosters.forEach((_teamId, playerId) => {
           draftedPlayersSet.add(playerId);
         });
         bootstrappedDraftFromRosters = true;
       }
    }

    // Calculate cutoff scores
    const thresholds: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, "D/ST": 0, K: 0 };
    Object.keys(thresholds).forEach((pos) => {
        const scores = positionalScores[pos].sort((a, b) => b - a);
        // Top 24 means index 23. If fewer than 24 players, take the last one.
        if (scores.length > 0) {
           // For positions where we typically start 1 (QB, TE, K, D/ST), maybe strict Top 12 makes more sense?
           // But user asked for Top 24 generally. We can tune this if needed.
           // Standard leagues start ~12 of single-slot positions, ~24 of RB/WR.
           // Let's stick to Top 24 as requested for simplicity unless specified otherwise.
           const index = Math.min(scores.length - 1, 23);
           thresholds[pos] = scores[index];
        }
    });

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
        home: buildMatchupTeam(
          boxscore.homeRoster,
          homeMeta,
          homeScore,
          hasRosterData,
          draftedPlayersSet,
          waiverClaims,
          thresholds,
        ),
        away: buildMatchupTeam(
          boxscore.awayRoster,
          awayMeta,
          awayScore,
          hasRosterData,
          draftedPlayersSet,
          waiverClaims,
          thresholds,
        ),
      });
    });

    // Update roster state for next week
    if (hasRosterData) {
       lastWeekRosters = currentWeekRosters;
    }
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
  allDraftedPlayerIds?: Set<number>,
  waiverClaims?: Map<number, number>,
  thresholds?: Record<string, number>,
): HistoricalMatchupTeam => {
  const roster = convertRoster(rosterEntries, allDraftedPlayerIds);
  
  // Handle Waiver Claims logic
  if (hasRosterData && waiverClaims) {
    roster.forEach((player) => {
      if (player.wasDraftedByTeam) return; // Already drafted globally

      const claimedByTeamId = waiverClaims.get(player.id);
      if (claimedByTeamId && claimedByTeamId !== meta.teamId) {
         // Claimed by someone else (and not dropped in between).
         // Ineligible for points.
         player.wasDraftedByTeam = true;
      }
    });
  }

  // Calculate waiver points
  let waiverPoints = 0;
  if (hasRosterData && allDraftedPlayerIds) {
    waiverPoints = roster.reduce((sum, player) => {
      // Only count starters
      if (player.position === "BN" || player.position === "Bench") return sum;
      
      // Exclude K (optional, but typically kickers are not "snipes")
      if (player.position === "K") return sum;
      
      // D/ST and QB are now allowed if they meet the threshold!
      // if (player.position === "D/ST" || player.position === "QB") return sum;
      
      if (player.wasDraftedByTeam) return sum;

      // Check performance threshold (Top 26 for position)
      // If player doesn't meet threshold, they don't contribute to waiver score
      // even if they were a "waiver snipe".
      if (thresholds && player.realPosition) {
         const cutoff = thresholds[player.realPosition] ?? 0;
         if (player.points < cutoff) {
            return sum;
         }
      }

      // Mark this player as having contributed effectively this week
      player.effectiveWaiverPoints = player.points;

      return sum + player.points;
    }, 0);
  }

  return {
    ownerKey: meta.ownerKey,
    ownerName: meta.ownerName,
    teamId: meta.teamId,
    teamName: meta.teamName,
    logoURL: meta.logoURL,
    score,
    roster,
    rosterUnavailable: !hasRosterData || roster.length === 0,
    waiverPoints,
  };
};

const normalizePosition = (raw: string | undefined | null) => {
  if (!raw) return "BN";
  if (raw === "RB/WR/TE" || raw === "RB/WR") return "FLEX";
  if (raw === "Bench") return "BN";
  return raw;
}

const convertRoster = (
  entries: ClientRosterEntry[] | undefined,
  allDraftedPlayerIds?: Set<number>,
) => {
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
      
      const id = derivePlayerId(entry, name);
      const position = normalizePosition(entry?.rosteredPosition ?? entry?.position);
      const realPosition = getRealPosition(entry);
      
      // wasDraftedByTeam now means "was drafted by ANY team in the league"
      // We use this flag to filter out non-waiver players
      const wasDraftedByTeam = allDraftedPlayerIds?.has(id) ?? false;

      return {
        id,
        name,
        position,
        realPosition,
        points: typeof entry?.totalPoints === "number" ? entry.totalPoints : 0,
        wasDraftedByTeam,
      };
    })
    .filter((player) => Number.isFinite(player.points))
    .sort((a, b) => b.points - a.points);
};

const getRealPosition = (entry: ClientRosterEntry) => {
  if (entry?.player?.defaultPositionId) {
    switch (entry.player.defaultPositionId) {
      case 1: return "QB";
      case 2: return "RB";
      case 3: return "WR";
      case 4: return "TE";
      case 5: return "K";
      case 16: return "D/ST";
    }
  }
  
  if (entry?.position && entry.position !== "Bench" && entry.position !== "BN" && entry.position !== "FLEX" && entry.position !== "RB/WR/TE") {
     return entry.position;
  }
  
  return undefined;
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
        totalWaiverPoints: 0,
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
      owner.totalWaiverPoints += team.waiverPoints; // Aggregate waiver points

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

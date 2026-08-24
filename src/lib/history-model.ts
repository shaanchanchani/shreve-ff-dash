import type {
  HistoricalMatchup,
  HistoricalMatchupTeam,
  SeasonDescriptor,
} from "@/types/history";
import { canonicalOwnerKey, type AggregatedOwner } from "@/lib/owner-utils";

/**
 * Derivations over the history snapshot. Everything here is computed from
 * canonical facts already in the snapshot — no season is hard-coded and no
 * result is assumed.
 */

/**
 * The snapshot carries every scheduled matchup, including weeks that are live
 * or have not kicked off, at 0-0. Those are not results: counted as played they
 * register as ties for both teams and inflate win percentage, and they produce
 * record-book entries like a 0.0-point "widest margin".
 */
export const hasPlayed = (matchup: HistoricalMatchup) =>
  matchup.home.score > 0 || matchup.away.score > 0;

export type Scope = "all" | "regular" | "postseason";

export const SCOPE_LABEL: Record<Scope, string> = {
  all: "All games",
  regular: "Regular season",
  postseason: "Playoffs",
};

/**
 * The first postseason week of a season, derived rather than assumed: the
 * regular season is the stretch where the schedule fields a full slate, and the
 * bracket is the point where it stops doing so because of byes. Returns null
 * when every week is full, in which case the season is treated as all regular.
 */
export const derivePostseasonStart = (
  matchups: HistoricalMatchup[],
): Map<number, number | null> => {
  const bySeason = new Map<number, Map<number, number>>();
  matchups.forEach((matchup) => {
    const weeks = bySeason.get(matchup.seasonId) ?? new Map<number, number>();
    weeks.set(matchup.week, (weeks.get(matchup.week) ?? 0) + 1);
    bySeason.set(matchup.seasonId, weeks);
  });

  const starts = new Map<number, number | null>();
  bySeason.forEach((weeks, seasonId) => {
    const fullSlate = Math.max(...weeks.values());
    const shortWeeks = Array.from(weeks.entries())
      .filter(([, count]) => count < fullSlate)
      .map(([week]) => week)
      .sort((left, right) => left - right);
    starts.set(seasonId, shortWeeks[0] ?? null);
  });
  return starts;
};

export const isPostseason = (
  matchup: HistoricalMatchup,
  starts: Map<number, number | null>,
) => {
  // The snapshot records the week's phase directly when it was built recently
  // enough; the slate-shape inference below is only a fallback for older ones.
  if (matchup.phase) return matchup.phase !== "regular";
  const start = starts.get(matchup.seasonId);
  return start !== null && start !== undefined && matchup.week >= start;
};

export const filterByScope = (
  matchups: HistoricalMatchup[],
  scope: Scope,
  starts: Map<number, number | null>,
) => {
  if (scope === "all") return matchups;
  const wantPostseason = scope === "postseason";
  return matchups.filter(
    (matchup) => isPostseason(matchup, starts) === wantPostseason,
  );
};

export type LedgerRow = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logoURL?: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsPerGame: number;
  seasonsParticipated: number;
};

export const buildLedger = (
  owners: Map<string, AggregatedOwner>,
  matchups: HistoricalMatchup[],
  logoSeason: number | "all",
): LedgerRow[] => {
  const stats = new Map<
    string,
    { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number }
  >();

  const ensure = (key: string) => {
    const existing = stats.get(key);
    if (existing) return existing;
    const created = {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
    stats.set(key, created);
    return created;
  };

  matchups.filter(hasPlayed).forEach((matchup) => {
    const homeKey = teamKey(matchup.home);
    const awayKey = teamKey(matchup.away);
    const home = ensure(homeKey);
    const away = ensure(awayKey);

    home.pointsFor += matchup.home.score;
    home.pointsAgainst += matchup.away.score;
    away.pointsFor += matchup.away.score;
    away.pointsAgainst += matchup.home.score;

    if (matchup.home.score > matchup.away.score) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.home.score < matchup.away.score) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  });

  return Array.from(stats.entries())
    .map(([ownerKey, stat]) => {
      const meta = owners.get(ownerKey);
      const games = stat.wins + stat.losses + stat.ties;
      return {
        ownerKey,
        ownerName: meta?.ownerName ?? "Unknown owner",
        latestTeamName: meta?.latestTeamName ?? "—",
        logoURL: selectLogo(meta, logoSeason),
        wins: stat.wins,
        losses: stat.losses,
        ties: stat.ties,
        games,
        winPct: games ? (stat.wins + stat.ties * 0.5) / games : 0,
        pointsFor: stat.pointsFor,
        pointsAgainst: stat.pointsAgainst,
        pointsPerGame: games ? stat.pointsFor / games : 0,
        seasonsParticipated: meta?.seasonsParticipated ?? 0,
      };
    })
    .filter((row) => row.games > 0)
    .sort(
      (left, right) =>
        right.winPct - left.winPct ||
        right.wins - left.wins ||
        right.pointsPerGame - left.pointsPerGame,
    );
};

export const teamKey = (team: HistoricalMatchupTeam) =>
  canonicalOwnerKey(team.ownerKey, team.ownerName, team.teamName);

export const selectLogo = (
  owner: AggregatedOwner | undefined,
  season: number | "all",
) => {
  if (!owner?.logos?.length) return undefined;
  if (season !== "all") {
    const match = owner.logos.find(
      (logo) => logo.seasonId === season && logo.logoURL,
    );
    if (match?.logoURL) return match.logoURL;
  }
  return [...owner.logos]
    .filter((logo) => logo.logoURL)
    .sort((left, right) => right.seasonId - left.seasonId)[0]?.logoURL;
};

export type RecordEntry = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  holder: string;
  detail: string;
};

export const buildRecordBook = (
  owners: Map<string, AggregatedOwner>,
  allMatchups: HistoricalMatchup[],
  starts: Map<number, number | null>,
): RecordEntry[] => {
  const matchups = allMatchups.filter(hasPlayed);
  if (matchups.length === 0) return [];

  const name = (team: HistoricalMatchupTeam) =>
    owners.get(teamKey(team))?.ownerName ?? team.ownerName;
  const scope = (matchup: HistoricalMatchup) =>
    isPostseason(matchup, starts) ? "playoffs" : "regular season";

  let best: { team: HistoricalMatchupTeam; matchup: HistoricalMatchup } | null =
    null;
  let worst: { team: HistoricalMatchupTeam; matchup: HistoricalMatchup } | null =
    null;
  let widest: HistoricalMatchup | null = null;
  let loudest: HistoricalMatchup | null = null;

  matchups.forEach((matchup) => {
    [matchup.home, matchup.away].forEach((team) => {
      if (team.score <= 0) return;
      if (!best || team.score > best.team.score) best = { team, matchup };
      if (!worst || team.score < worst.team.score) worst = { team, matchup };
    });

    const margin = Math.abs(matchup.home.score - matchup.away.score);
    if (
      !widest ||
      margin > Math.abs(widest.home.score - widest.away.score)
    ) {
      widest = matchup;
    }
    const combined = matchup.home.score + matchup.away.score;
    if (!loudest || combined > loudest.home.score + loudest.away.score) {
      loudest = matchup;
    }
  });

  const streak = longestWinStreak(owners, matchups);
  const highs = mostWeeklyHighs(owners, matchups, starts);

  const entries: RecordEntry[] = [];

  if (best) {
    const { team, matchup } = best as {
      team: HistoricalMatchupTeam;
      matchup: HistoricalMatchup;
    };
    entries.push({
      id: "highest-week",
      label: "Highest week",
      value: team.score.toFixed(1),
      unit: "pts",
      holder: name(team),
      detail: `${matchup.seasonId} · week ${matchup.week} · ${scope(matchup)}`,
    });
  }

  if (widest) {
    const matchup = widest as HistoricalMatchup;
    const winner =
      matchup.home.score >= matchup.away.score ? matchup.home : matchup.away;
    const loser =
      matchup.home.score >= matchup.away.score ? matchup.away : matchup.home;
    entries.push({
      id: "widest-margin",
      label: "Widest margin",
      value: Math.abs(matchup.home.score - matchup.away.score).toFixed(1),
      unit: "pts",
      holder: name(winner),
      detail: `over ${name(loser)} · ${matchup.seasonId} week ${matchup.week}`,
    });
  }

  if (loudest) {
    const matchup = loudest as HistoricalMatchup;
    entries.push({
      id: "highest-combined",
      label: "Highest combined",
      value: (matchup.home.score + matchup.away.score).toFixed(1),
      unit: "pts",
      holder: `${name(matchup.home)} v ${name(matchup.away)}`,
      detail: `${matchup.seasonId} · week ${matchup.week} · ${scope(matchup)}`,
    });
  }

  if (streak) {
    entries.push({
      id: "longest-streak",
      label: "Longest win streak",
      value: String(streak.length),
      unit: "wins",
      holder: streak.ownerName,
      detail: streak.span,
    });
  }

  if (highs) {
    entries.push({
      id: "weekly-highs",
      label: "Most weekly highs",
      value: String(highs.count),
      unit: "weeks",
      holder: highs.ownerName,
      detail: "Top score in a scoring period, all seasons",
    });
  }

  if (worst) {
    const { team, matchup } = worst as {
      team: HistoricalMatchupTeam;
      matchup: HistoricalMatchup;
    };
    entries.push({
      id: "lowest-week",
      label: "Lowest week",
      value: team.score.toFixed(1),
      unit: "pts",
      holder: name(team),
      detail: `${matchup.seasonId} · week ${matchup.week} · ${scope(matchup)}`,
    });
  }

  return entries;
};

const longestWinStreak = (
  owners: Map<string, AggregatedOwner>,
  matchups: HistoricalMatchup[],
) => {
  const timeline = new Map<
    string,
    Array<{ seasonId: number; week: number; won: boolean }>
  >();

  matchups.forEach((matchup) => {
    [
      [matchup.home, matchup.away],
      [matchup.away, matchup.home],
    ].forEach(([team, opponent]) => {
      const key = teamKey(team);
      const list = timeline.get(key) ?? [];
      list.push({
        seasonId: matchup.seasonId,
        week: matchup.week,
        won: team.score > opponent.score,
      });
      timeline.set(key, list);
    });
  });

  let best: { ownerName: string; length: number; span: string } | null = null;

  timeline.forEach((games, ownerKey) => {
    const ordered = [...games].sort(
      (left, right) =>
        left.seasonId - right.seasonId || left.week - right.week,
    );
    let run = 0;
    let runStart: { seasonId: number; week: number } | null = null;

    ordered.forEach((game) => {
      if (!game.won) {
        run = 0;
        runStart = null;
        return;
      }
      if (run === 0) runStart = game;
      run += 1;
      if (!best || run > best.length) {
        const start = runStart as { seasonId: number; week: number } | null;
        best = {
          ownerName: owners.get(ownerKey)?.ownerName ?? "Unknown owner",
          length: run,
          span: start
            ? start.seasonId === game.seasonId
              ? `${game.seasonId} · weeks ${start.week}–${game.week}`
              : `${start.seasonId} week ${start.week} → ${game.seasonId} week ${game.week}`
            : `${game.seasonId}`,
        };
      }
    });
  });

  return best as { ownerName: string; length: number; span: string } | null;
};

const mostWeeklyHighs = (
  owners: Map<string, AggregatedOwner>,
  matchups: HistoricalMatchup[],
  starts: Map<number, number | null>,
) => {
  const periods = new Map<string, { ownerKey: string; score: number }>();

  matchups.forEach((matchup) => {
    if (isPostseason(matchup, starts)) return;
    if (!hasPlayed(matchup)) return;
    const period = `${matchup.seasonId}-${matchup.week}`;
    [matchup.home, matchup.away].forEach((team) => {
      const leader = periods.get(period);
      if (!leader || team.score > leader.score) {
        periods.set(period, { ownerKey: teamKey(team), score: team.score });
      }
    });
  });

  const counts = new Map<string, number>();
  periods.forEach(({ ownerKey }) => {
    counts.set(ownerKey, (counts.get(ownerKey) ?? 0) + 1);
  });

  const top = Array.from(counts.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0];
  if (!top) return null;

  return {
    ownerName: owners.get(top[0])?.ownerName ?? "Unknown owner",
    count: top[1],
  };
};

export type SeriesMeeting = {
  id: string;
  seasonId: number;
  week: number;
  postseason: boolean;
  forScore: number;
  againstScore: number;
  opponentName: string;
  opponentTeam: string;
  won: boolean;
  tied: boolean;
};

export type Series = {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  meetings: SeriesMeeting[];
};

export const buildSeries = (
  owners: Map<string, AggregatedOwner>,
  matchups: HistoricalMatchup[],
  primaryKey: string,
  opponentKey: string | "all",
  starts: Map<number, number | null>,
): Series => {
  const meetings: SeriesMeeting[] = [];
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  matchups.filter(hasPlayed).forEach((matchup) => {
    const homeKey = teamKey(matchup.home);
    const awayKey = teamKey(matchup.away);
    const isHome = homeKey === primaryKey;
    const isAway = awayKey === primaryKey;
    if (!isHome && !isAway) return;

    const team = isHome ? matchup.home : matchup.away;
    const opponent = isHome ? matchup.away : matchup.home;
    const opponentOwnerKey = isHome ? awayKey : homeKey;
    if (opponentKey !== "all" && opponentOwnerKey !== opponentKey) return;

    pointsFor += team.score;
    pointsAgainst += opponent.score;
    const won = team.score > opponent.score;
    const tied = team.score === opponent.score;
    if (won) wins += 1;
    else if (tied) ties += 1;
    else losses += 1;

    meetings.push({
      id: matchup.id,
      seasonId: matchup.seasonId,
      week: matchup.week,
      postseason: isPostseason(matchup, starts),
      forScore: team.score,
      againstScore: opponent.score,
      opponentName:
        owners.get(opponentOwnerKey)?.ownerName ?? opponent.ownerName,
      opponentTeam: opponent.teamName,
      won,
      tied,
    });
  });

  meetings.sort(
    (left, right) =>
      right.seasonId - left.seasonId || right.week - left.week,
  );

  return {
    games: meetings.length,
    wins,
    losses,
    ties,
    pointsFor,
    pointsAgainst,
    meetings,
  };
};

export type WaiverPlayerRow = {
  key: string;
  playerName: string;
  headshotURL?: string;
  seasonId: number;
  points: number;
  weeksStarted: number;
};

export type WaiverRow = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logoURL?: string;
  totalWaiverPoints: number;
  waiverPointsPerGame: number;
  waiverShare: number;
  gamesWithRosterData: number;
  topPlayers: WaiverPlayerRow[];
};

/**
 * Pickups that actually started and actually produced. The snapshot already
 * decides which weeks clear the impact threshold via effectiveWaiverPoints, so
 * this only aggregates — it does not re-score anyone.
 */
export const buildWaiverRows = (
  owners: Map<string, AggregatedOwner>,
  matchups: HistoricalMatchup[],
  logoSeason: number | "all",
): WaiverRow[] => {
  const stats = new Map<
    string,
    {
      totalPoints: number;
      games: number;
      players: Map<string, WaiverPlayerRow>;
    }
  >();

  const ensure = (key: string) => {
    const existing = stats.get(key);
    if (existing) return existing;
    const created = {
      totalPoints: 0,
      games: 0,
      players: new Map<string, WaiverPlayerRow>(),
    };
    stats.set(key, created);
    return created;
  };

  matchups.filter(hasPlayed).forEach((matchup) => {
    [matchup.home, matchup.away].forEach((team) => {
      const stat = ensure(teamKey(team));
      stat.totalPoints += team.score;
      if (team.rosterUnavailable || !team.roster) return;
      stat.games += 1;

      team.roster.forEach((player) => {
        if (player.position === "BN" || player.position === "Bench") return;
        if (player.wasDraftedByTeam) return;
        const impact = player.effectiveWaiverPoints ?? 0;
        if (impact <= 0) return;

        const key = `${player.id}-${matchup.seasonId}`;
        const existing = stat.players.get(key);
        if (existing) {
          existing.points += impact;
          existing.weeksStarted += 1;
          return;
        }
        stat.players.set(key, {
          key,
          playerName: player.name,
          ...(player.headshotURL ? { headshotURL: player.headshotURL } : {}),
          seasonId: matchup.seasonId,
          points: impact,
          weeksStarted: 1,
        });
      });
    });
  });

  return Array.from(stats.entries())
    .map(([ownerKey, stat]) => {
      const meta = owners.get(ownerKey);
      const players = Array.from(stat.players.values());
      const totalWaiverPoints = players.reduce(
        (sum, player) => sum + player.points,
        0,
      );
      return {
        ownerKey,
        ownerName: meta?.ownerName ?? "Unknown owner",
        latestTeamName: meta?.latestTeamName ?? "—",
        logoURL: selectLogo(meta, logoSeason),
        totalWaiverPoints,
        waiverPointsPerGame: stat.games ? totalWaiverPoints / stat.games : 0,
        waiverShare: stat.totalPoints ? totalWaiverPoints / stat.totalPoints : 0,
        gamesWithRosterData: stat.games,
        topPlayers: players
          .sort((left, right) => right.points - left.points)
          .slice(0, 6),
      };
    })
    .filter((row) => row.gamesWithRosterData > 0)
    .sort((left, right) => right.totalWaiverPoints - left.totalWaiverPoints);
};

export type Volume = {
  seasonId: number;
  index: number;
  entries: number;
  matchups: number;
  hasRosterData: boolean;
  postseasonStart: number | null;
};

export const buildVolumes = (
  seasons: SeasonDescriptor[],
  matchups: HistoricalMatchup[],
  starts: Map<number, number | null>,
): Volume[] => {
  const ordered = [...seasons].sort(
    (left, right) => left.seasonId - right.seasonId,
  );
  return ordered
    .map((season, index) => ({
      seasonId: season.seasonId,
      index: index + 1,
      entries: season.teams.length,
      matchups: matchups.filter(
        (matchup) => matchup.seasonId === season.seasonId && hasPlayed(matchup),
      ).length,
      hasRosterData: season.hasRosterData,
      postseasonStart: starts.get(season.seasonId) ?? null,
    }))
    .reverse();
};

export type NormalizedSeasonRules = {
  effectiveWeek: number;
  regularSeasonWeeks: number;
  playoffTeamCount: number;
  playoffByeCount: number;
  medianWinEnabled: boolean;
  rosterSlots: Array<{ slot: string; count: number }>;
  pointRules: Array<{ stat: string; points: number }>;
};

type SleeperLeagueSettings = {
  playoff_week_start?: number | null;
  playoff_teams?: number | null;
  league_average_match?: number | null;
};

type SleeperLeagueRulesPayload = {
  settings?: SleeperLeagueSettings | null;
  roster_positions?: string[] | null;
  scoring_settings?: Record<string, number | null> | null;
};

type EspnLeagueRulesPayload = {
  rosterSettings?: {
    lineupPositionCount?: Record<string, number | null> | null;
  } | null;
  scheduleSettings?: {
    numberOfRegularSeasonMatchups?: number | null;
    regularSeasonMatchupLength?: number | null;
    numberOfPlayoffTeams?: number | null;
  } | null;
  scoringSettings?: Record<string, number | null> | null;
};

const positiveInteger = (value: number | null | undefined, name: string) => {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value!;
};

export const playoffByeCountFor = (playoffTeamCount: number) => {
  const teams = positiveInteger(playoffTeamCount, "Playoff Team count");
  const bracketSize = 2 ** Math.ceil(Math.log2(teams));
  return bracketSize - teams;
};

const countedRosterSlots = (slots: string[]) => {
  const counts = new Map<string, number>();
  for (const rawSlot of slots) {
    const slot = rawSlot.trim();
    if (!slot) continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return Array.from(counts, ([slot, count]) => ({ slot, count })).sort(
    (left, right) => left.slot.localeCompare(right.slot),
  );
};

const countedRosterSettings = (
  settings: Record<string, number | null> | null | undefined,
) =>
  Object.entries(settings ?? {})
    .flatMap(([rawSlot, rawCount]) => {
      const slot = rawSlot.trim();
      return slot && Number.isFinite(rawCount) && (rawCount ?? 0) > 0
        ? [{ slot, count: rawCount! }]
        : [];
    })
    .sort((left, right) => left.slot.localeCompare(right.slot));

const normalizedPointRules = (
  settings: Record<string, number | null> | null | undefined,
) =>
  Object.entries(settings ?? {})
    .flatMap(([rawStat, rawPoints]) => {
      const stat = rawStat.trim();
      return stat && Number.isFinite(rawPoints)
        ? [{ stat, points: rawPoints! }]
        : [];
    })
    .sort((left, right) => left.stat.localeCompare(right.stat));

export const normalizeSleeperSeasonRules = (
  league: SleeperLeagueRulesPayload,
): NormalizedSeasonRules => {
  const playoffWeekStart = positiveInteger(
    league.settings?.playoff_week_start,
    "Sleeper playoff Week start",
  );
  const playoffTeamCount = positiveInteger(
    league.settings?.playoff_teams,
    "Sleeper playoff Team count",
  );
  const rosterSlots = countedRosterSlots(league.roster_positions ?? []);
  if (rosterSlots.length === 0) {
    throw new Error("Sleeper league has no roster positions.");
  }
  return {
    effectiveWeek: 1,
    regularSeasonWeeks: playoffWeekStart - 1,
    playoffTeamCount,
    playoffByeCount: playoffByeCountFor(playoffTeamCount),
    medianWinEnabled: league.settings?.league_average_match === 1,
    rosterSlots,
    pointRules: normalizedPointRules(league.scoring_settings),
  };
};

export const normalizeEspnSeasonRules = (
  league: EspnLeagueRulesPayload,
  options: { medianWinEnabled: boolean },
): NormalizedSeasonRules => {
  const regularSeasonMatchups = positiveInteger(
    league.scheduleSettings?.numberOfRegularSeasonMatchups,
    "ESPN regular-season Matchup count",
  );
  const matchupLength = positiveInteger(
    league.scheduleSettings?.regularSeasonMatchupLength,
    "ESPN regular-season Matchup length",
  );
  const playoffTeamCount = positiveInteger(
    league.scheduleSettings?.numberOfPlayoffTeams,
    "ESPN playoff Team count",
  );
  const rosterSlots = countedRosterSettings(
    league.rosterSettings?.lineupPositionCount,
  );
  if (rosterSlots.length === 0) {
    throw new Error("ESPN league has no lineup positions.");
  }
  return {
    effectiveWeek: 1,
    regularSeasonWeeks: regularSeasonMatchups * matchupLength,
    playoffTeamCount,
    playoffByeCount: playoffByeCountFor(playoffTeamCount),
    medianWinEnabled: options.medianWinEnabled,
    rosterSlots,
    pointRules: normalizedPointRules(league.scoringSettings),
  };
};

import { query } from "./_generated/server";

export const all = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db.query("historySeasonSnapshots").collect();
    if (snapshots.length === 0) return null;
    const payloads = snapshots
      .map((snapshot) => snapshot.payload)
      .sort((left, right) => right.season.seasonId - left.season.seasonId);
    const seasons = payloads.map((payload) => payload.season);
    const matchups = payloads
      .flatMap((payload) => payload.matchups)
      .sort(
        (left, right) =>
          right.seasonId - left.seasonId || right.week - left.week,
      );

    const owners = new Map();
    const ensureOwner = (ownerKey: string, ownerName: string) => {
      if (!owners.has(ownerKey)) {
        owners.set(ownerKey, {
          ownerKey,
          ownerName,
          latestTeamName: ownerName,
          totalWins: 0,
          totalLosses: 0,
          totalTies: 0,
          totalPointsFor: 0,
          totalPointsAgainst: 0,
          totalWaiverPoints: 0,
          seasons: new Set(),
          logos: [],
        });
      }
      return owners.get(ownerKey);
    };

    for (const season of seasons) {
      for (const team of season.teams) {
        const owner = ensureOwner(team.ownerKey, team.ownerName);
        if (owner.seasons.size === 0) owner.latestTeamName = team.teamName;
        owner.seasons.add(season.seasonId);
        owner.logos.push({
          seasonId: season.seasonId,
          ...(team.logoURL ? { logoURL: team.logoURL } : {}),
        });
      }
    }
    for (const matchup of matchups) {
      for (const [team, opponent] of [
        [matchup.home, matchup.away],
        [matchup.away, matchup.home],
      ]) {
        const owner = ensureOwner(team.ownerKey, team.ownerName);
        owner.totalPointsFor += team.score;
        owner.totalPointsAgainst += opponent.score;
        owner.totalWaiverPoints += team.waiverPoints;
        if (team.score > opponent.score) owner.totalWins += 1;
        else if (team.score < opponent.score) owner.totalLosses += 1;
        else owner.totalTies += 1;
      }
    }

    const ownerSummaries = Array.from(owners.values())
      .map(({ seasons: ownerSeasons, ...owner }) => {
        const games = owner.totalWins + owner.totalLosses + owner.totalTies;
        return {
          ...owner,
          winPct:
            games > 0
              ? Math.round(
                  ((owner.totalWins + owner.totalTies * 0.5) / games) * 1_000,
                ) / 1_000
              : 0,
          seasonsParticipated: ownerSeasons.size,
        };
      })
      .sort(
        (left, right) =>
          right.winPct - left.winPct ||
          right.totalWins - left.totalWins ||
          left.ownerName.localeCompare(right.ownerName),
      );
    const generatedAt = Math.max(
      ...snapshots.map((snapshot) => snapshot.generatedAt),
    );
    return {
      owners: ownerSummaries,
      matchups,
      seasons,
      generatedAt: new Date(generatedAt).toISOString(),
      notes: [
        "Data is served from canonical Convex season snapshots.",
        "ESPN remains the historical provider for 2022–2025.",
        `Detected seasons: ${seasons.map((season) => season.seasonId).join(", ")}`,
      ],
    };
  },
});

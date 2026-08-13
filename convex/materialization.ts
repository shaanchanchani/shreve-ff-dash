import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const CALCULATION_VERSION = 1;

type ScoredParticipant = {
  participant: Doc<"matchupParticipants">;
  entry: Doc<"seasonEntries">;
  score: number;
};

const compareScoredParticipants = (
  left: ScoredParticipant,
  right: ScoredParticipant,
) => right.score - left.score || left.entry._id.localeCompare(right.entry._id);

export const dashboard = internalMutation({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) throw new Error("Canonical Shreve league is missing.");

    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!season) throw new Error(`League season ${args.seasonYear} is missing.`);

    const [
      entries,
      weeks,
      matchups,
      allParticipants,
      lineups,
      players,
      playerProviderRefs,
      memberships,
      scoringRuleVersions,
    ] = await Promise.all([
        ctx.db
          .query("seasonEntries")
          .withIndex("by_season", (q) => q.eq("leagueSeasonId", season._id))
          .collect(),
        ctx.db
          .query("weeks")
          .withIndex("by_season_number", (q) =>
            q.eq("leagueSeasonId", season._id),
          )
          .collect(),
        ctx.db
          .query("matchups")
          .withIndex("by_season_week", (q) =>
            q.eq("leagueSeasonId", season._id),
          )
          .collect(),
        ctx.db.query("matchupParticipants").collect(),
        ctx.db
          .query("lineupEntries")
          .withIndex("by_season", (q) => q.eq("leagueSeasonId", season._id))
          .collect(),
        ctx.db.query("players").collect(),
        ctx.db.query("playerProviderRefs").collect(),
        ctx.db.query("seasonEntryMembers").collect(),
        ctx.db
          .query("scoringRuleVersions")
          .withIndex("by_season_effective_week", (q) =>
            q.eq("leagueSeasonId", season._id),
          )
          .collect(),
      ]);

    if (entries.length === 0 || matchups.length === 0) {
      throw new Error("Canonical season facts must be imported before materialization.");
    }
    if (scoringRuleVersions.length === 0) {
      throw new Error(
        "Canonical Season Rules must be imported before materialization.",
      );
    }
    const sortedRuleVersions = [...scoringRuleVersions].sort(
      (left, right) => left.effectiveWeek - right.effectiveWeek,
    );
    const currentRules = sortedRuleVersions.at(-1)!;
    const rulesForWeek = (weekNumber: number) =>
      [...sortedRuleVersions]
        .reverse()
        .find((rules) => rules.effectiveWeek <= weekNumber) ??
      sortedRuleVersions[0];

    const entryById = new Map(entries.map((entry) => [entry._id, entry]));
    const playerById = new Map(players.map((player) => [player._id, player]));
    const espnPlayerIdByPlayerId = new Map(
      playerProviderRefs
        .filter((reference) => reference.provider === "espn")
        .map((reference) => [reference.playerId, reference.externalPlayerId]),
    );
    const memberByEntryId = new Map(
      memberships
        .filter(
          (membership) =>
            membership.leagueSeasonId === season._id &&
            membership.role === "primary",
        )
        .map((membership) => [membership.seasonEntryId, membership.memberId]),
    );
    const matchupIds = new Set(matchups.map((matchup) => matchup._id));
    const participants = allParticipants.filter((participant) =>
      matchupIds.has(participant.matchupId),
    );
    const participantsByMatchup = new Map<
      Id<"matchups">,
      Doc<"matchupParticipants">[]
    >();
    for (const participant of participants) {
      const current = participantsByMatchup.get(participant.matchupId) ?? [];
      current.push(participant);
      participantsByMatchup.set(participant.matchupId, current);
    }
    const lineupsByParticipant = new Map<
      Id<"matchupParticipants">,
      Doc<"lineupEntries">[]
    >();
    for (const lineup of lineups) {
      const current = lineupsByParticipant.get(lineup.matchupParticipantId) ?? [];
      current.push(lineup);
      lineupsByParticipant.set(lineup.matchupParticipantId, current);
    }

    const standingByEntry = new Map(
      entries.map((entry) => [
        entry._id,
        {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        },
      ]),
    );
    const eliminatedEntries = new Set<Id<"seasonEntries">>();
    const weeklyHighScores: Array<Record<string, unknown>> = [];
    const survivorEliminations: Array<Record<string, unknown>> = [];
    let seasonHigh: ScoredParticipant | null = null;
    let winsAboveMedian = 0;
    let totalWins = 0;

    const sortedWeeks = weeks
      .filter(
        (week) => week.phase === "regular" && week.state !== "scheduled",
      )
      .sort((left, right) => left.number - right.number);
    for (const week of sortedWeeks) {
      const weekMatchups = matchups.filter((matchup) => matchup.weekId === week._id);
      const scoredParticipants: ScoredParticipant[] = [];

      for (const matchup of weekMatchups) {
        const pair = participantsByMatchup.get(matchup._id) ?? [];
        if (pair.length !== 2) continue;
        const [first, second] = pair;
        const firstEntry = entryById.get(first.seasonEntryId);
        const secondEntry = entryById.get(second.seasonEntryId);
        if (!firstEntry || !secondEntry) continue;

        const firstScore = first.score ?? 0;
        const secondScore = second.score ?? 0;
        scoredParticipants.push(
          { participant: first, entry: firstEntry, score: firstScore },
          { participant: second, entry: secondEntry, score: secondScore },
        );

        const firstStanding = standingByEntry.get(firstEntry._id)!;
        const secondStanding = standingByEntry.get(secondEntry._id)!;
        firstStanding.pointsFor += firstScore;
        firstStanding.pointsAgainst += secondScore;
        secondStanding.pointsFor += secondScore;
        secondStanding.pointsAgainst += firstScore;

        if (firstScore > secondScore) {
          firstStanding.wins += 1;
          secondStanding.losses += 1;
        } else if (secondScore > firstScore) {
          secondStanding.wins += 1;
          firstStanding.losses += 1;
        } else {
          firstStanding.ties += 1;
          secondStanding.ties += 1;
        }
      }

      if (scoredParticipants.length === 0) continue;
      if (scoredParticipants.every(({ score }) => score === 0)) continue;
      const orderedScores = scoredParticipants.map(({ score }) => score).sort(
        (left, right) => left - right,
      );
      const midpoint = Math.floor(orderedScores.length / 2);
      const median =
        orderedScores.length % 2 === 0
          ? (orderedScores[midpoint - 1] + orderedScores[midpoint]) / 2
          : orderedScores[midpoint];

      if (rulesForWeek(week.number).medianWinEnabled) {
        for (const scored of scoredParticipants) {
          const standing = standingByEntry.get(scored.entry._id)!;
          if (scored.score > median) standing.wins += 1;
          else if (scored.score < median) standing.losses += 1;
          else standing.ties += 1;
        }
      }
      for (const matchup of weekMatchups) {
        const pair = participantsByMatchup.get(matchup._id) ?? [];
        if (pair.length !== 2) continue;
        const firstScore = pair[0].score ?? 0;
        const secondScore = pair[1].score ?? 0;
        if (firstScore === secondScore) continue;
        totalWins += 1;
        if (Math.max(firstScore, secondScore) > median) winsAboveMedian += 1;
      }

      scoredParticipants.sort(compareScoredParticipants);
      const weeklyWinner = scoredParticipants[0];
      weeklyHighScores.push({
        week: week.number,
        seasonEntryId: weeklyWinner.entry._id,
        memberId: memberByEntryId.get(weeklyWinner.entry._id),
        teamName: weeklyWinner.entry.displayName,
        score: weeklyWinner.score,
        logoURL: weeklyWinner.entry.avatarUrl,
      });
      if (!seasonHigh || compareScoredParticipants(seasonHigh, weeklyWinner) > 0) {
        seasonHigh = weeklyWinner;
      }

      const survivorCandidate = [...scoredParticipants]
        .filter(
          ({ entry, score }) => score > 0 && !eliminatedEntries.has(entry._id),
        )
        .sort(
          (left, right) =>
            left.score - right.score ||
            left.entry._id.localeCompare(right.entry._id),
        )[0];
      if (survivorCandidate) {
        eliminatedEntries.add(survivorCandidate.entry._id);
        survivorEliminations.push({
          week: week.number,
          seasonEntryId: survivorCandidate.entry._id,
          memberId: memberByEntryId.get(survivorCandidate.entry._id),
          teamName: survivorCandidate.entry.displayName,
          score: survivorCandidate.score,
          logoURL: survivorCandidate.entry.avatarUrl,
        });
      }
    }

    const sortedStandings = entries
      .map((entry) => ({ entry, stats: standingByEntry.get(entry._id)! }))
      .sort((left, right) => {
        const leftRecord = left.stats.wins + left.stats.ties * 0.5;
        const rightRecord = right.stats.wins + right.stats.ties * 0.5;
        return (
          rightRecord - leftRecord ||
          right.stats.pointsFor - left.stats.pointsFor ||
          left.entry._id.localeCompare(right.entry._id)
        );
      });

    const standings = sortedStandings.map(({ entry, stats }, index) => ({
      seasonEntryId: entry._id,
      memberId: memberByEntryId.get(entry._id),
      teamName: entry.displayName,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      pointsFor: Math.round(stats.pointsFor * 100) / 100,
      logoURL: entry.avatarUrl,
      playoffOdds: index < currentRules.playoffTeamCount ? 1 : 0,
      byeOdds: index < currentRules.playoffByeCount ? 1 : 0,
      clinchedPlayoffs: index < currentRules.playoffTeamCount,
      clinchedBye: index < currentRules.playoffByeCount,
    }));

    const unluckyTeams = entries
      .map((entry) => ({
        seasonEntryId: entry._id,
        memberId: memberByEntryId.get(entry._id),
        teamName: entry.displayName,
        pointsAgainst:
          Math.round(standingByEntry.get(entry._id)!.pointsAgainst * 100) / 100,
        logoURL: entry.avatarUrl,
      }))
      .sort(
        (left, right) =>
          right.pointsAgainst - left.pointsAgainst ||
          left.seasonEntryId.localeCompare(right.seasonEntryId),
      )
      .slice(0, 3)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    let seasonHighScore: Record<string, unknown> | null = null;
    if (seasonHigh) {
      const topPlayers = (lineupsByParticipant.get(seasonHigh.participant._id) ?? [])
        .filter((lineup) => lineup.started && lineup.points > 0)
        .sort((left, right) => right.points - left.points)
        .slice(0, 4)
        .flatMap((lineup) => {
          const player = playerById.get(lineup.playerId);
          if (!player) return [];
          return [
            {
              playerId: player._id,
              name: player.fullName,
              position: lineup.rosterSlot,
              points: lineup.points,
              team: player.nflTeam ?? "",
              ...(espnPlayerIdByPlayerId.get(player._id)
                ? {
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${espnPlayerIdByPlayerId.get(player._id)}.png`,
                  }
                : {}),
            },
          ];
        });
      seasonHighScore = {
        seasonEntryId: seasonHigh.entry._id,
        memberId: memberByEntryId.get(seasonHigh.entry._id),
        teamName: seasonHigh.entry.displayName,
        score: seasonHigh.score,
        week: participants.find(
          (participant) => participant._id === seasonHigh!.participant._id,
        )
          ? weeks.find((week) => week._id === seasonHigh!.participant.weekId)?.number
          : undefined,
        logoURL: seasonHigh.entry.avatarUrl,
        topPlayers,
      };
    }

    const payload = {
      seasonYear: args.seasonYear,
      rules: {
        regularSeasonWeeks: currentRules.regularSeasonWeeks,
        playoffTeamCount: currentRules.playoffTeamCount,
        playoffByeCount: currentRules.playoffByeCount,
        medianWinEnabled: currentRules.medianWinEnabled,
      },
      seasonHighScore,
      weeklyHighScores,
      survivorEliminations,
      unluckyTeams,
      standings,
      leagueMedianStats: {
        winsAboveMedian,
        totalWins,
        percentage: totalWins > 0 ? winsAboveMedian / totalWins : 0,
      },
    };

    const latestSyncRun = await ctx.db
      .query("syncRuns")
      .withIndex("by_season_status", (q) =>
        q.eq("leagueSeasonId", season._id).eq("status", "succeeded"),
      )
      .order("desc")
      .first();
    const generatedAt = Date.now();
    const existingSnapshot = await ctx.db
      .query("dashboardSnapshots")
      .withIndex("by_season_kind", (q) =>
        q.eq("leagueSeasonId", season._id).eq("kind", "prizes"),
      )
      .order("desc")
      .first();

    if (existingSnapshot) {
      await ctx.db.patch(existingSnapshot._id, {
        calculationVersion: CALCULATION_VERSION,
        generatedAt,
        ...(latestSyncRun ? { sourceSyncRunId: latestSyncRun._id } : {}),
        payload,
      });
    } else {
      await ctx.db.insert("dashboardSnapshots", {
        leagueSeasonId: season._id,
        kind: "prizes",
        calculationVersion: CALCULATION_VERSION,
        generatedAt,
        ...(latestSyncRun ? { sourceSyncRunId: latestSyncRun._id } : {}),
        payload,
      });
    }

    return {
      seasonYear: args.seasonYear,
      calculationVersion: CALCULATION_VERSION,
      weeklyWinnerCount: weeklyHighScores.length,
      survivorEliminationCount: survivorEliminations.length,
      standingsCount: standings.length,
      generatedAt,
    };
  },
});

export const longestTouchdowns = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }
    const generatedAt = Date.now();
    const existingSnapshot = await ctx.db
      .query("dashboardSnapshots")
      .withIndex("by_season_kind", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("kind", "longest_touchdowns"),
      )
      .order("desc")
      .first();
    const values = {
      calculationVersion: CALCULATION_VERSION,
      generatedAt,
      sourceSyncRunId: syncRun._id,
      payload: args.payload,
    };
    if (existingSnapshot) {
      await ctx.db.patch(existingSnapshot._id, values);
    } else {
      await ctx.db.insert("dashboardSnapshots", {
        leagueSeasonId: syncRun.leagueSeasonId,
        kind: "longest_touchdowns",
        ...values,
      });
    }
    await ctx.db.patch(syncRun._id, {
      status: "succeeded",
      completedAt: generatedAt,
    });
    return { generatedAt, calculationVersion: CALCULATION_VERSION };
  },
});

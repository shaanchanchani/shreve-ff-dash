import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

const SCORE_TOLERANCE = 0.01;

export const season = internalQuery({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) {
      throw new Error("Canonical Shreve league is missing.");
    }
    const leagueSeason = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!leagueSeason) {
      throw new Error(`League season ${args.seasonYear} is missing.`);
    }

    const [weeks, matchups, entries, participants, lineups, exceptions] =
      await Promise.all([
        ctx.db
          .query("weeks")
          .withIndex("by_season_number", (q) =>
            q.eq("leagueSeasonId", leagueSeason._id),
          )
          .collect(),
        ctx.db
          .query("matchups")
          .withIndex("by_season_week", (q) =>
            q.eq("leagueSeasonId", leagueSeason._id),
          )
          .collect(),
        ctx.db
          .query("seasonEntries")
          .withIndex("by_season", (q) =>
            q.eq("leagueSeasonId", leagueSeason._id),
          )
          .collect(),
        ctx.db.query("matchupParticipants").collect(),
        ctx.db
          .query("lineupEntries")
          .withIndex("by_season", (q) =>
            q.eq("leagueSeasonId", leagueSeason._id),
          )
          .collect(),
        ctx.db
          .query("identityExceptions")
          .withIndex("by_season_status", (q) =>
            q
              .eq("leagueSeasonId", leagueSeason._id)
              .eq("status", "unresolved"),
          )
          .collect(),
      ]);

    const matchupIds = new Set(matchups.map((matchup) => matchup._id));
    const seasonParticipants = participants.filter((participant) =>
      matchupIds.has(participant.matchupId),
    );
    const participantIds = new Set(
      seasonParticipants.map((participant) => participant._id),
    );
    const seasonLineups = lineups.filter((lineup) =>
      participantIds.has(lineup.matchupParticipantId),
    );
    const lineupsByParticipant = new Map<string, typeof seasonLineups>();
    for (const lineup of seasonLineups) {
      const current = lineupsByParticipant.get(lineup.matchupParticipantId) ?? [];
      current.push(lineup);
      lineupsByParticipant.set(lineup.matchupParticipantId, current);
    }

    const scoreMismatches = seasonParticipants.flatMap((participant) => {
      const providerScore = participant.providerScore;
      if (providerScore === undefined) return [];
      const startedTotal = (
        lineupsByParticipant.get(participant._id) ?? []
      )
        .filter((lineup) => lineup.started)
        .reduce((total, lineup) => total + lineup.points, 0);
      const difference = Math.abs(startedTotal - providerScore);
      if (difference <= SCORE_TOLERANCE) return [];
      return [
        {
          participantId: participant._id,
          providerScore,
          startedTotal: Math.round(startedTotal * 100) / 100,
          difference: Math.round(difference * 100) / 100,
        },
      ];
    });

    const structuralIssues: string[] = [];
    const expectedRegularSeasonMatchups = entries.length / 2;
    for (const week of weeks) {
      const weekMatchups = matchups.filter(
        (matchup) => matchup.weekId === week._id,
      );
      if (
        week.phase === "regular" &&
        weekMatchups.length !== expectedRegularSeasonMatchups
      ) {
        structuralIssues.push(
          `Week ${week.number} has ${weekMatchups.length} matchups; expected ${expectedRegularSeasonMatchups}.`,
        );
      }
      for (const matchup of weekMatchups) {
        const matchupParticipants = seasonParticipants.filter(
          (participant) => participant.matchupId === matchup._id,
        );
        if (matchupParticipants.length !== 2) {
          structuralIssues.push(
            `Matchup ${matchup._id} has ${matchupParticipants.length} participants; expected 2.`,
          );
        }
      }
    }

    return {
      seasonYear: args.seasonYear,
      counts: {
        weeks: weeks.length,
        matchups: matchups.length,
        seasonEntries: entries.length,
        participants: seasonParticipants.length,
        lineupEntries: seasonLineups.length,
      },
      unresolvedIdentityExceptions: exceptions.length,
      structuralIssues,
      scoreMismatchCount: scoreMismatches.length,
      scoreMismatches: scoreMismatches.slice(0, 20),
      passed:
        structuralIssues.length === 0 &&
        scoreMismatches.length === 0 &&
        exceptions.length === 0,
    };
  },
});

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const CALCULATION_VERSION = 2;

const normalizeRosterSlot = (slot: string) => {
  if (slot === "RB/WR/TE" || slot === "RB/WR") return "FLEX";
  if (slot === "Bench") return "BN";
  return slot;
};

export const season = internalMutation({
  args: { seasonYear: v.number() },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) throw new Error("Canonical Shreve league is missing.");
    const leagueSeason = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!leagueSeason) {
      throw new Error(`League season ${args.seasonYear} is missing.`);
    }

    const [
      entries,
      memberships,
      members,
      weeks,
      matchups,
      allParticipants,
      lineups,
      players,
      playerRefs,
      draftPicks,
      transactions,
      transactionMovements,
    ] = await Promise.all([
      ctx.db
        .query("seasonEntries")
        .withIndex("by_season", (q) =>
          q.eq("leagueSeasonId", leagueSeason._id),
        )
        .collect(),
      ctx.db.query("seasonEntryMembers").collect(),
      ctx.db.query("members").collect(),
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
      ctx.db.query("matchupParticipants").collect(),
      ctx.db
        .query("lineupEntries")
        .withIndex("by_season", (q) =>
          q.eq("leagueSeasonId", leagueSeason._id),
        )
        .collect(),
      ctx.db.query("players").collect(),
      ctx.db.query("playerProviderRefs").collect(),
      ctx.db
        .query("draftPicks")
        .withIndex("by_season_entry", (q) =>
          q.eq("leagueSeasonId", leagueSeason._id),
        )
        .collect(),
      ctx.db
        .query("transactions")
        .withIndex("by_season_week", (q) =>
          q.eq("leagueSeasonId", leagueSeason._id),
        )
        .collect(),
      ctx.db.query("transactionMovements").collect(),
    ]);

    const entryById = new Map(entries.map((entry) => [entry._id, entry]));
    const memberById = new Map(members.map((member) => [member._id, member]));
    const memberByEntry = new Map(
      memberships
        .filter(
          (membership) =>
            membership.leagueSeasonId === leagueSeason._id &&
            membership.role === "primary",
        )
        .map((membership) => [
          membership.seasonEntryId,
          memberById.get(membership.memberId),
        ]),
    );
    const playerById = new Map(players.map((player) => [player._id, player]));
    const espnPlayerIdByPlayer = new Map<Id<"players">, string>();
    for (const reference of playerRefs) {
      if (reference.provider === "espn") {
        espnPlayerIdByPlayer.set(
          reference.playerId,
          reference.externalPlayerId,
        );
      }
    }
    const draftedPlayerIds = new Set(draftPicks.map((pick) => pick.playerId));
    const playerMedia = new Map<string, string>();
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

    const waiverClaims = new Map<Id<"players">, Id<"seasonEntries">>();
    const qualifyingTransactionTime = new Map(
      transactions
        .filter(
          (transaction) =>
            transaction.kind === "waiver" ||
            transaction.kind === "free_agent",
        )
        .map((transaction) => [transaction._id, transaction.occurredAt]),
    );
    const qualifyingAdds = transactionMovements
      .filter(
        (movement) =>
          movement.direction === "add" &&
          qualifyingTransactionTime.has(movement.transactionId),
      )
      .sort(
        (left, right) =>
          qualifyingTransactionTime.get(left.transactionId)! -
          qualifyingTransactionTime.get(right.transactionId)!,
      );
    for (const movement of qualifyingAdds) {
      if (
        !draftedPlayerIds.has(movement.playerId) &&
        !waiverClaims.has(movement.playerId)
      ) {
        waiverClaims.set(movement.playerId, movement.seasonEntryId);
      }
    }
    let lastWeekRosters = new Map<Id<"players">, Id<"seasonEntries">>();
    const historicalMatchups: Array<Record<string, unknown>> = [];
    /**
     * Only finished weeks belong in history. Including scheduled and live weeks
     * put 0-0 rows in the snapshot, which every consumer then counted as a tie
     * for both teams and which could crown an unplayed final's away team.
     */
    const sortedWeeks = [...weeks]
      .filter((week) => week.state === "final")
      .sort((left, right) => left.number - right.number);

    for (const week of sortedWeeks) {
      const weekMatchups = matchups.filter((matchup) => matchup.weekId === week._id);
      const weekParticipants = weekMatchups.flatMap(
        (matchup) => participantsByMatchup.get(matchup._id) ?? [],
      );
      const currentWeekRosters = new Map<
        Id<"players">,
        Id<"seasonEntries">
      >();
      const positionalScores = new Map<string, number[]>();

      for (const participant of weekParticipants) {
        for (const lineup of lineupsByParticipant.get(participant._id) ?? []) {
          const player = playerById.get(lineup.playerId);
          if (player?.position && lineup.points > 0) {
            const scores = positionalScores.get(player.position) ?? [];
            scores.push(lineup.points);
            positionalScores.set(player.position, scores);
          }
          if (draftedPlayerIds.has(lineup.playerId)) continue;
          currentWeekRosters.set(lineup.playerId, participant.seasonEntryId);
          if (!waiverClaims.has(lineup.playerId)) {
            waiverClaims.set(lineup.playerId, participant.seasonEntryId);
            continue;
          }
          const claimedBy = waiverClaims.get(lineup.playerId);
          const lastOwner = lastWeekRosters.get(lineup.playerId);
          if (lastOwner && lastOwner !== participant.seasonEntryId) continue;
          if (!lastOwner && claimedBy !== participant.seasonEntryId) {
            waiverClaims.set(lineup.playerId, participant.seasonEntryId);
          }
        }
      }

      const thresholds = new Map<string, number>();
      for (const [position, values] of positionalScores) {
        values.sort((left, right) => right - left);
        thresholds.set(position, values[Math.min(values.length - 1, 23)] ?? 0);
      }

      const buildTeam = (participant: Doc<"matchupParticipants">) => {
        const entry = entryById.get(participant.seasonEntryId);
        const member = memberByEntry.get(participant.seasonEntryId);
        if (!entry || !member) return null;
        let waiverPoints = 0;
        const roster = (lineupsByParticipant.get(participant._id) ?? [])
          .flatMap((lineup) => {
            const player = playerById.get(lineup.playerId);
            if (!player) return [];
            const espnPlayerId = espnPlayerIdByPlayer.get(lineup.playerId);
            if (espnPlayerId) {
              playerMedia.set(
                String(player._id),
                `https://a.espncdn.com/i/headshots/nfl/players/full/${espnPlayerId}.png`,
              );
            }
            const originallyDrafted = draftedPlayerIds.has(lineup.playerId);
            const claimedBy = waiverClaims.get(lineup.playerId);
            const eligibleClaim =
              !originallyDrafted && claimedBy === participant.seasonEntryId;
            const cutoff = player.position
              ? thresholds.get(player.position) ?? 0
              : 0;
            const effectiveWaiverPoints =
              eligibleClaim &&
              lineup.started &&
              player.position !== "K" &&
              lineup.points >= cutoff &&
              lineup.points > 0
                ? lineup.points
                : undefined;
            if (effectiveWaiverPoints) waiverPoints += effectiveWaiverPoints;
            return [
              {
                id: String(player._id),
                name: player.fullName,
                position: normalizeRosterSlot(lineup.rosterSlot),
                points: lineup.points,
                wasDraftedByTeam: !eligibleClaim,
                ...(player.position ? { realPosition: player.position } : {}),
                ...(effectiveWaiverPoints
                  ? { effectiveWaiverPoints }
                  : {}),
              },
            ];
          })
          .sort((left, right) => right.points - left.points);

        return {
          ownerKey: member.canonicalKey,
          ownerName: member.displayName,
          teamId: String(entry._id),
          teamName: entry.displayName,
          ...(entry.avatarUrl ? { logoURL: entry.avatarUrl } : {}),
          score: participant.score ?? 0,
          roster,
          rosterUnavailable: roster.length === 0,
          waiverPoints,
        };
      };

      for (const matchup of weekMatchups) {
        const pair = [...(participantsByMatchup.get(matchup._id) ?? [])].sort(
          (left, right) => left.slot - right.slot,
        );
        if (pair.length !== 2) continue;
        const home = buildTeam(pair[0]);
        const away = buildTeam(pair[1]);
        if (!home || !away) continue;
        historicalMatchups.push({
          id: `${args.seasonYear}-${week.number}-${home.teamId}-${away.teamId}`,
          seasonId: args.seasonYear,
          week: week.number,
          phase: week.phase,
          label: `Week ${week.number}`,
          home,
          away,
        });
      }
      lastWeekRosters = currentWeekRosters;
    }

    const teams = entries
      .map((entry) => {
        const member = memberByEntry.get(entry._id);
        if (!member) return null;
        return {
          teamId: String(entry._id),
          teamName: entry.displayName,
          ownerName: member.displayName,
          ownerKey: member.canonicalKey,
          ...(entry.avatarUrl ? { logoURL: entry.avatarUrl } : {}),
        };
      })
      .filter((team): team is NonNullable<typeof team> => team !== null);
    const latestSyncRun = await ctx.db
      .query("syncRuns")
      .withIndex("by_season_status", (q) =>
        q.eq("leagueSeasonId", leagueSeason._id).eq("status", "succeeded"),
      )
      .order("desc")
      .first();
    const generatedAt = Date.now();
    const payload = {
      season: {
        seasonId: args.seasonYear,
        hasRosterData: true,
        teams,
      },
      matchups: historicalMatchups,
      playerMedia: Array.from(playerMedia, ([playerId, headshotURL]) => ({
        playerId,
        headshotURL,
      })),
    };
    const existing = await ctx.db
      .query("historySeasonSnapshots")
      .withIndex("by_season", (q) => q.eq("leagueSeasonId", leagueSeason._id))
      .unique();
    const values = {
      calculationVersion: CALCULATION_VERSION,
      generatedAt,
      ...(latestSyncRun ? { sourceSyncRunId: latestSyncRun._id } : {}),
      payload,
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else {
      await ctx.db.insert("historySeasonSnapshots", {
        leagueSeasonId: leagueSeason._id,
        ...values,
      });
    }
    return {
      seasonYear: args.seasonYear,
      teamCount: teams.length,
      matchupCount: historicalMatchups.length,
      generatedAt,
    };
  },
});

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { providerValidator } from "./model";
import {
  resolveMemberIdentity,
  syntheticOwnerExternalId,
} from "./identity";

export const startSyncRun = internalMutation({
  args: {
    seasonYear: v.number(),
    provider: providerValidator,
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) {
      throw new Error("Canonical Shreve league has not been bootstrapped.");
    }

    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!season) {
      throw new Error(`League season ${args.seasonYear} has not been created.`);
    }
    if (season.authoritativeProvider !== args.provider) {
      throw new Error(
        `${args.provider} is not authoritative for ${args.seasonYear}.`,
      );
    }

    return await ctx.db.insert("syncRuns", {
      leagueSeasonId: season._id,
      provider: args.provider,
      scope: args.scope,
      status: "running",
      startedAt: Date.now(),
      attempt: 1,
    });
  },
});

export const failSyncRun = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("syncRuns", args.syncRunId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error.slice(0, 1_000),
    });
  },
});

export const skipSyncRun = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("syncRuns", args.syncRunId, {
      status: "skipped",
      completedAt: Date.now(),
      error: args.reason.slice(0, 1_000),
    });
  },
});

export const upsertSeasonEntries = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    contentHash: v.string(),
    teams: v.array(
      v.object({
        externalTeamId: v.string(),
        ownerName: v.string(),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }

    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("provider", syncRun.provider),
      )
      .unique();
    if (!providerRef) {
      throw new Error("League provider reference is missing.");
    }
    let membersCreated = 0;
    let entriesCreated = 0;
    let entriesUpdated = 0;
    let membershipsCreated = 0;

    for (const team of args.teams) {
      const externalOwnerId = syntheticOwnerExternalId(team.ownerName);
      let memberRef = await ctx.db
        .query("memberProviderRefs")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("externalUserId", externalOwnerId),
        )
        .unique();

      let memberId = memberRef?.memberId;
      if (!memberId) {
        const identity = resolveMemberIdentity(team.ownerName);
        let member = await ctx.db
          .query("members")
          .withIndex("by_canonical_key", (q) =>
            q.eq("canonicalKey", identity.canonicalKey),
          )
          .unique();

        if (!member) {
          const createdMemberId = await ctx.db.insert("members", {
            canonicalKey: identity.canonicalKey,
            displayName: identity.displayName,
            active: true,
          });
          member = await ctx.db.get(createdMemberId);
          membersCreated += 1;
        }
        if (!member) {
          throw new Error(`Failed to create Member for ${team.ownerName}.`);
        }

        memberId = member._id;
        const memberRefId = await ctx.db.insert("memberProviderRefs", {
          memberId,
          provider: syncRun.provider,
          externalUserId: externalOwnerId,
          externalIdKind: "synthetic",
          displayNameAtImport: team.ownerName,
          mappingMethod: identity.mappingMethod,
        });
        memberRef = await ctx.db.get(memberRefId);
      }

      if (!memberId || !memberRef) {
        throw new Error(`Failed to resolve Member for ${team.ownerName}.`);
      }

      const entryRef = await ctx.db
        .query("seasonEntryProviderRefs")
        .withIndex("by_provider_league_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("leagueProviderRefId", providerRef._id)
            .eq("externalEntryId", team.externalTeamId),
        )
        .unique();

      let seasonEntryId = entryRef?.seasonEntryId;
      if (!seasonEntryId) {
        seasonEntryId = await ctx.db.insert("seasonEntries", {
          leagueSeasonId: syncRun.leagueSeasonId,
          displayName: team.displayName,
          ...(team.avatarUrl ? { avatarUrl: team.avatarUrl } : {}),
          active: true,
        });
        await ctx.db.insert("seasonEntryProviderRefs", {
          seasonEntryId,
          leagueProviderRefId: providerRef._id,
          provider: syncRun.provider,
          externalEntryId: team.externalTeamId,
        });
        entriesCreated += 1;
      } else {
        await ctx.db.patch("seasonEntries", seasonEntryId, {
          displayName: team.displayName,
          ...(team.avatarUrl ? { avatarUrl: team.avatarUrl } : {}),
          active: true,
        });
        entriesUpdated += 1;
      }

      const memberships = await ctx.db
        .query("seasonEntryMembers")
        .withIndex("by_entry", (q) => q.eq("seasonEntryId", seasonEntryId))
        .collect();
      const primaryMembership = memberships.find(
        (membership) => membership.role === "primary",
      );

      if (!primaryMembership) {
        await ctx.db.insert("seasonEntryMembers", {
          leagueSeasonId: syncRun.leagueSeasonId,
          seasonEntryId,
          memberId,
          role: "primary",
        });
        membershipsCreated += 1;
      } else if (primaryMembership.memberId !== memberId) {
        await ctx.db.insert("identityExceptions", {
          leagueSeasonId: syncRun.leagueSeasonId,
          entityType: "member",
          provider: syncRun.provider,
          externalId: externalOwnerId,
          candidateInternalId: memberId,
          reason: `Provider owner conflicts with the existing primary Member for entry ${team.externalTeamId}.`,
          status: "unresolved",
        });
      }
    }

    const completedAt = Date.now();
    await ctx.db.insert("sourceFetches", {
      syncRunId: syncRun._id,
      provider: syncRun.provider,
      resource: "season_entries",
      externalKey: providerRef.externalLeagueId,
      fetchedAt: completedAt,
      contentHash: args.contentHash,
      recordCount: args.teams.length,
    });
    await ctx.db.patch(providerRef._id, { lastSyncedAt: completedAt });
    await ctx.db.patch(syncRun._id, {
      status: "succeeded",
      completedAt,
    });

    return {
      teamCount: args.teams.length,
      membersCreated,
      entriesCreated,
      entriesUpdated,
      membershipsCreated,
    };
  },
});

export const upsertWeek = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    contentHash: v.string(),
    weekNumber: v.number(),
    state: v.union(
      v.literal("scheduled"),
      v.literal("live"),
      v.literal("final"),
    ),
    matchups: v.array(
      v.object({
        externalMatchupId: v.string(),
        participants: v.array(
          v.object({
            externalTeamId: v.string(),
            slot: v.union(v.literal(1), v.literal(2)),
            score: v.number(),
            providerScore: v.optional(v.number()),
            commissionerAdjustment: v.optional(v.number()),
            result: v.union(
              v.literal("pending"),
              v.literal("win"),
              v.literal("loss"),
              v.literal("tie"),
              v.literal("bye"),
            ),
            roster: v.array(
              v.object({
                externalPlayerId: v.string(),
                fullName: v.string(),
                position: v.optional(v.string()),
                nflTeam: v.optional(v.string()),
                rosterSlot: v.string(),
                started: v.boolean(),
                points: v.number(),
              }),
            ),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }

    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("provider", syncRun.provider),
      )
      .unique();
    if (!providerRef) {
      throw new Error("League provider reference is missing.");
    }
    const season = await ctx.db.get(syncRun.leagueSeasonId);
    if (!season) {
      throw new Error("League Season is missing.");
    }
    const phase =
      args.weekNumber <= season.regularSeasonWeeks ? "regular" : "playoffs";

    let week = await ctx.db
      .query("weeks")
      .withIndex("by_season_number", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("number", args.weekNumber),
      )
      .unique();
    if (!week) {
      const weekId = await ctx.db.insert("weeks", {
        leagueSeasonId: syncRun.leagueSeasonId,
        number: args.weekNumber,
        phase,
        state: args.state,
      });
      week = await ctx.db.get(weekId);
    } else {
      await ctx.db.patch(week._id, { phase, state: args.state });
    }
    if (!week) {
      throw new Error(`Failed to create Week ${args.weekNumber}.`);
    }

    let matchupsCreated = 0;
    let matchupsUpdated = 0;
    let participantsCreated = 0;
    let playersCreated = 0;
    let lineupEntriesCreated = 0;
    let lineupEntriesUpdated = 0;
    let staleLineupEntriesRemoved = 0;

    for (const matchupInput of args.matchups) {
      if (matchupInput.participants.length !== 2) {
        throw new Error(
          `Matchup ${matchupInput.externalMatchupId} must have two participants.`,
        );
      }

      const matchupRef = await ctx.db
        .query("matchupProviderRefs")
        .withIndex("by_provider_league_week_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("leagueProviderRefId", providerRef._id)
            .eq("weekNumber", args.weekNumber)
            .eq("externalMatchupId", matchupInput.externalMatchupId),
        )
        .unique();

      let matchupId = matchupRef?.matchupId;
      if (!matchupId) {
        matchupId = await ctx.db.insert("matchups", {
          leagueSeasonId: syncRun.leagueSeasonId,
          weekId: week._id,
          weekNumber: args.weekNumber,
          state: args.state,
          dataQuality: "verified",
        });
        await ctx.db.insert("matchupProviderRefs", {
          matchupId,
          leagueProviderRefId: providerRef._id,
          provider: syncRun.provider,
          weekNumber: args.weekNumber,
          externalMatchupId: matchupInput.externalMatchupId,
        });
        matchupsCreated += 1;
      } else {
        await ctx.db.patch(matchupId, {
          state: args.state,
          dataQuality: "verified",
        });
        matchupsUpdated += 1;
      }

      const existingParticipants = await ctx.db
        .query("matchupParticipants")
        .withIndex("by_matchup", (q) => q.eq("matchupId", matchupId))
        .collect();

      for (const participantInput of matchupInput.participants) {
        const entryRef = await ctx.db
          .query("seasonEntryProviderRefs")
          .withIndex("by_provider_league_external", (q) =>
            q
              .eq("provider", syncRun.provider)
              .eq("leagueProviderRefId", providerRef._id)
              .eq("externalEntryId", participantInput.externalTeamId),
          )
          .unique();
        if (!entryRef) {
          throw new Error(
            `Season Entry ${participantInput.externalTeamId} must be imported before Week ${args.weekNumber}.`,
          );
        }

        let participant = existingParticipants.find(
          (candidate) => candidate.seasonEntryId === entryRef.seasonEntryId,
        );
        if (!participant) {
          const participantId = await ctx.db.insert("matchupParticipants", {
            matchupId,
            weekId: week._id,
            seasonEntryId: entryRef.seasonEntryId,
            slot: participantInput.slot,
            score: participantInput.score,
            providerScore:
              participantInput.providerScore ?? participantInput.score,
            ...(participantInput.commissionerAdjustment !== undefined
              ? {
                  commissionerAdjustment:
                    participantInput.commissionerAdjustment,
                }
              : {}),
            result: participantInput.result,
          });
          participant = (await ctx.db.get(participantId)) ?? undefined;
          participantsCreated += 1;
        } else {
          await ctx.db.patch(participant._id, {
            slot: participantInput.slot,
            score: participantInput.score,
            providerScore:
              participantInput.providerScore ?? participantInput.score,
            ...(participantInput.commissionerAdjustment !== undefined
              ? {
                  commissionerAdjustment:
                    participantInput.commissionerAdjustment,
                }
              : {}),
            result: participantInput.result,
          });
        }
        if (!participant) {
          throw new Error("Failed to create Matchup Participant.");
        }

        const existingLineupEntries = await ctx.db
          .query("lineupEntries")
          .withIndex("by_participant", (q) =>
            q.eq("matchupParticipantId", participant._id),
          )
          .collect();
        const seenLineupEntryIds = new Set<string>();

        for (const rosterEntry of participantInput.roster) {
          let playerRef = await ctx.db
            .query("playerProviderRefs")
            .withIndex("by_provider_external", (q) =>
              q
                .eq("provider", syncRun.provider)
                .eq("externalPlayerId", rosterEntry.externalPlayerId),
            )
            .unique();

          let playerId = playerRef?.playerId;
          if (!playerId) {
            playerId = await ctx.db.insert("players", {
              canonicalKey: `unresolved:${syncRun.provider}:${rosterEntry.externalPlayerId}`,
              fullName: rosterEntry.fullName,
              ...(rosterEntry.position
                ? { position: rosterEntry.position }
                : {}),
              ...(rosterEntry.nflTeam
                ? { nflTeam: rosterEntry.nflTeam }
                : {}),
              active: true,
            });
            const playerRefId = await ctx.db.insert("playerProviderRefs", {
              playerId,
              provider: syncRun.provider,
              externalPlayerId: rosterEntry.externalPlayerId,
              mappingMethod: "provider_claim",
            });
            playerRef = await ctx.db.get(playerRefId);
            playersCreated += 1;
          } else {
            await ctx.db.patch(playerId, {
              fullName: rosterEntry.fullName,
              ...(rosterEntry.position
                ? { position: rosterEntry.position }
                : {}),
              ...(rosterEntry.nflTeam
                ? { nflTeam: rosterEntry.nflTeam }
                : {}),
            });
          }
          if (!playerId || !playerRef) {
            throw new Error(
              `Failed to resolve Player ${rosterEntry.externalPlayerId}.`,
            );
          }

          const lineupEntry = existingLineupEntries.find(
            (candidate) => candidate.playerId === playerId,
          );
          if (!lineupEntry) {
            const lineupEntryId = await ctx.db.insert("lineupEntries", {
              leagueSeasonId: syncRun.leagueSeasonId,
              matchupParticipantId: participant._id,
              playerId,
              rosterSlot: rosterEntry.rosterSlot,
              started: rosterEntry.started,
              points: rosterEntry.points,
            });
            seenLineupEntryIds.add(lineupEntryId);
            lineupEntriesCreated += 1;
          } else {
            await ctx.db.patch(lineupEntry._id, {
              rosterSlot: rosterEntry.rosterSlot,
              started: rosterEntry.started,
              points: rosterEntry.points,
            });
            seenLineupEntryIds.add(lineupEntry._id);
            lineupEntriesUpdated += 1;
          }
        }

        for (const staleEntry of existingLineupEntries) {
          if (!seenLineupEntryIds.has(staleEntry._id)) {
            await ctx.db.delete(staleEntry._id);
            staleLineupEntriesRemoved += 1;
          }
        }
      }
    }

    const completedAt = Date.now();
    await ctx.db.insert("sourceFetches", {
      syncRunId: syncRun._id,
      provider: syncRun.provider,
      resource: "weekly_matchups",
      externalKey: `${providerRef.externalLeagueId}:${args.weekNumber}`,
      fetchedAt: completedAt,
      contentHash: args.contentHash,
      recordCount: args.matchups.length,
    });
    await ctx.db.patch(providerRef._id, { lastSyncedAt: completedAt });
    await ctx.db.patch(syncRun._id, {
      status: "succeeded",
      completedAt,
    });

    return {
      weekNumber: args.weekNumber,
      matchupCount: args.matchups.length,
      matchupsCreated,
      matchupsUpdated,
      participantsCreated,
      playersCreated,
      lineupEntriesCreated,
      lineupEntriesUpdated,
      staleLineupEntriesRemoved,
    };
  },
});

export const upsertDraft = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    contentHash: v.string(),
    picks: v.array(
      v.object({
        externalTeamId: v.string(),
        externalPlayerId: v.string(),
        fullName: v.string(),
        position: v.optional(v.string()),
        nflTeam: v.optional(v.string()),
        round: v.number(),
        pickNumber: v.number(),
        keeper: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }
    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("provider", syncRun.provider),
      )
      .unique();
    if (!providerRef) {
      throw new Error("League provider reference is missing.");
    }

    let playersCreated = 0;
    let picksCreated = 0;
    let picksUpdated = 0;

    for (const pick of args.picks) {
      const entryRef = await ctx.db
        .query("seasonEntryProviderRefs")
        .withIndex("by_provider_league_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("leagueProviderRefId", providerRef._id)
            .eq("externalEntryId", pick.externalTeamId),
        )
        .unique();
      if (!entryRef) {
        throw new Error(
          `Draft pick references unknown Season Entry ${pick.externalTeamId}.`,
        );
      }

      let playerRef = await ctx.db
        .query("playerProviderRefs")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("externalPlayerId", pick.externalPlayerId),
        )
        .unique();
      let playerId = playerRef?.playerId;
      if (!playerId) {
        playerId = await ctx.db.insert("players", {
          canonicalKey: `unresolved:${syncRun.provider}:${pick.externalPlayerId}`,
          fullName: pick.fullName,
          ...(pick.position ? { position: pick.position } : {}),
          ...(pick.nflTeam ? { nflTeam: pick.nflTeam } : {}),
          active: true,
        });
        const playerRefId = await ctx.db.insert("playerProviderRefs", {
          playerId,
          provider: syncRun.provider,
          externalPlayerId: pick.externalPlayerId,
          mappingMethod: "provider_claim",
        });
        playerRef = await ctx.db.get(playerRefId);
        playersCreated += 1;
      }
      if (!playerId || !playerRef) {
        throw new Error(`Failed to resolve Player ${pick.externalPlayerId}.`);
      }

      const existingPick = await ctx.db
        .query("draftPicks")
        .withIndex("by_season_player", (q) =>
          q
            .eq("leagueSeasonId", syncRun.leagueSeasonId)
            .eq("playerId", playerId),
        )
        .unique();
      const values = {
        seasonEntryId: entryRef.seasonEntryId,
        round: pick.round,
        pickNumber: pick.pickNumber,
        ...(pick.keeper !== undefined ? { keeper: pick.keeper } : {}),
        sourceSyncRunId: syncRun._id,
      };
      if (existingPick) {
        await ctx.db.patch(existingPick._id, values);
        picksUpdated += 1;
      } else {
        await ctx.db.insert("draftPicks", {
          leagueSeasonId: syncRun.leagueSeasonId,
          playerId,
          ...values,
        });
        picksCreated += 1;
      }
    }

    const completedAt = Date.now();
    await ctx.db.insert("sourceFetches", {
      syncRunId: syncRun._id,
      provider: syncRun.provider,
      resource: "draft_picks",
      externalKey: providerRef.externalLeagueId,
      fetchedAt: completedAt,
      contentHash: args.contentHash,
      recordCount: args.picks.length,
    });
    await ctx.db.patch(syncRun._id, {
      status: "succeeded",
      completedAt,
    });

    return {
      pickCount: args.picks.length,
      picksCreated,
      picksUpdated,
      playersCreated,
    };
  },
});

export const upsertSleeperPlayerCrosswalks = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    players: v.array(
      v.object({
        externalPlayerId: v.string(),
        espnPlayerId: v.optional(v.string()),
        fullName: v.string(),
        position: v.optional(v.string()),
        nflTeam: v.optional(v.string()),
        active: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }
    if (syncRun.provider !== "sleeper") {
      throw new Error("Sleeper Player crosswalk ingestion requires Sleeper.");
    }

    let crosswalked = 0;
    let providerClaimsCreated = 0;
    let referencesMigrated = 0;
    let conflicts = 0;

    for (const input of args.players) {
      let sleeperRef = await ctx.db
        .query("playerProviderRefs")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", "sleeper")
            .eq("externalPlayerId", input.externalPlayerId),
        )
        .unique();
      const espnRef = input.espnPlayerId
        ? await ctx.db
            .query("playerProviderRefs")
            .withIndex("by_provider_external", (q) =>
              q
                .eq("provider", "espn")
                .eq("externalPlayerId", input.espnPlayerId!),
            )
            .unique()
        : null;

      let playerId = espnRef?.playerId ?? sleeperRef?.playerId;
      if (espnRef && sleeperRef && espnRef.playerId !== sleeperRef.playerId) {
        const oldPlayer = await ctx.db.get(sleeperRef.playerId);
        if (!oldPlayer?.canonicalKey.startsWith("unresolved:sleeper:")) {
          await ctx.db.insert("identityExceptions", {
            leagueSeasonId: syncRun.leagueSeasonId,
            entityType: "player",
            provider: "sleeper",
            externalId: input.externalPlayerId,
            candidateInternalId: espnRef.playerId,
            reason: `Sleeper player maps to ESPN ${input.espnPlayerId}, but its existing canonical Player is not unresolved.`,
            status: "unresolved",
          });
          conflicts += 1;
          continue;
        }

        const oldPlayerId = sleeperRef.playerId;
        const targetPlayerId = espnRef.playerId;
        const lineups = await ctx.db
          .query("lineupEntries")
          .withIndex("by_player", (q) => q.eq("playerId", oldPlayerId))
          .collect();
        for (const lineup of lineups) {
          const participantLineups = await ctx.db
            .query("lineupEntries")
            .withIndex("by_participant", (q) =>
              q.eq("matchupParticipantId", lineup.matchupParticipantId),
            )
            .collect();
          if (
            participantLineups.some(
              (candidate) => candidate.playerId === targetPlayerId,
            )
          ) {
            await ctx.db.delete(lineup._id);
          } else {
            await ctx.db.patch(lineup._id, { playerId: targetPlayerId });
          }
          referencesMigrated += 1;
        }
        const draftPicks = await ctx.db
          .query("draftPicks")
          .withIndex("by_player", (q) => q.eq("playerId", oldPlayerId))
          .collect();
        for (const pick of draftPicks) {
          await ctx.db.patch(pick._id, { playerId: targetPlayerId });
          referencesMigrated += 1;
        }
        const movements = await ctx.db
          .query("transactionMovements")
          .withIndex("by_player", (q) => q.eq("playerId", oldPlayerId))
          .collect();
        for (const movement of movements) {
          const transactionMovements = await ctx.db
            .query("transactionMovements")
            .withIndex("by_transaction", (q) =>
              q.eq("transactionId", movement.transactionId),
            )
            .collect();
          if (
            transactionMovements.some(
              (candidate) =>
                candidate.playerId === targetPlayerId &&
                candidate.seasonEntryId === movement.seasonEntryId &&
                candidate.direction === movement.direction,
            )
          ) {
            await ctx.db.delete(movement._id);
          } else {
            await ctx.db.patch(movement._id, { playerId: targetPlayerId });
          }
          referencesMigrated += 1;
        }
        await ctx.db.patch(sleeperRef._id, {
          playerId: targetPlayerId,
          mappingMethod: "provider_crosswalk",
        });
        const remainingRefs = await ctx.db
          .query("playerProviderRefs")
          .withIndex("by_player_provider", (q) => q.eq("playerId", oldPlayerId))
          .collect();
        if (remainingRefs.length === 0) await ctx.db.delete(oldPlayerId);
        playerId = targetPlayerId;
        crosswalked += 1;
      } else if (espnRef) {
        playerId = espnRef.playerId;
        if (sleeperRef) {
          await ctx.db.patch(sleeperRef._id, {
            playerId,
            mappingMethod: "provider_crosswalk",
          });
        } else {
          const refId = await ctx.db.insert("playerProviderRefs", {
            playerId,
            provider: "sleeper",
            externalPlayerId: input.externalPlayerId,
            mappingMethod: "provider_crosswalk",
          });
          sleeperRef = await ctx.db.get(refId);
        }
        crosswalked += 1;
      } else if (input.espnPlayerId) {
        if (!playerId) {
          playerId = await ctx.db.insert("players", {
            canonicalKey: `crosswalk:espn:${input.espnPlayerId}`,
            fullName: input.fullName,
            ...(input.position ? { position: input.position } : {}),
            ...(input.nflTeam ? { nflTeam: input.nflTeam } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          });
        }
        await ctx.db.insert("playerProviderRefs", {
          playerId,
          provider: "espn",
          externalPlayerId: input.espnPlayerId,
          mappingMethod: "provider_crosswalk",
        });
        if (sleeperRef) {
          await ctx.db.patch(sleeperRef._id, {
            playerId,
            mappingMethod: "provider_crosswalk",
          });
        } else {
          const refId = await ctx.db.insert("playerProviderRefs", {
            playerId,
            provider: "sleeper",
            externalPlayerId: input.externalPlayerId,
            mappingMethod: "provider_crosswalk",
          });
          sleeperRef = await ctx.db.get(refId);
        }
        const exceptions = await ctx.db
          .query("identityExceptions")
          .withIndex("by_provider_external", (q) =>
            q
              .eq("provider", "sleeper")
              .eq("externalId", input.externalPlayerId),
          )
          .collect();
        for (const exception of exceptions) {
          if (exception.status === "unresolved") {
            await ctx.db.patch(exception._id, {
              candidateInternalId: playerId,
              status: "resolved",
            });
          }
        }
        crosswalked += 1;
      } else if (!playerId) {
        playerId = await ctx.db.insert("players", {
          canonicalKey: `unresolved:sleeper:${input.externalPlayerId}`,
          fullName: input.fullName,
          ...(input.position ? { position: input.position } : {}),
          ...(input.nflTeam ? { nflTeam: input.nflTeam } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        });
        const refId = await ctx.db.insert("playerProviderRefs", {
          playerId,
          provider: "sleeper",
          externalPlayerId: input.externalPlayerId,
          mappingMethod: "provider_claim",
        });
        sleeperRef = await ctx.db.get(refId);
        await ctx.db.insert("identityExceptions", {
          leagueSeasonId: syncRun.leagueSeasonId,
          entityType: "player",
          provider: "sleeper",
          externalId: input.externalPlayerId,
          reason: "Sleeper did not provide an ESPN crosswalk for this rostered Player.",
          status: "unresolved",
        });
        providerClaimsCreated += 1;
      }

      if (!playerId || !sleeperRef) {
        throw new Error(`Failed to resolve Sleeper Player ${input.externalPlayerId}.`);
      }
      await ctx.db.patch(playerId, {
        fullName: input.fullName,
        ...(input.position ? { position: input.position } : {}),
        ...(input.nflTeam ? { nflTeam: input.nflTeam } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      });
    }

    return {
      playerCount: args.players.length,
      crosswalked,
      providerClaimsCreated,
      referencesMigrated,
      conflicts,
    };
  },
});

export const upsertSleeperPlayerCatalogChunk = internalMutation({
  args: {
    updatedAt: v.number(),
    players: v.array(
      v.object({
        externalPlayerId: v.string(),
        fullName: v.string(),
        position: v.optional(v.string()),
        nflTeam: v.optional(v.string()),
        active: v.optional(v.boolean()),
        espnPlayerId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const player of args.players) {
      const existing = await ctx.db
        .query("sleeperPlayerCatalog")
        .withIndex("by_external_player", (q) =>
          q.eq("externalPlayerId", player.externalPlayerId),
        )
        .unique();
      const values = {
        fullName: player.fullName,
        ...(player.position ? { position: player.position } : {}),
        ...(player.nflTeam ? { nflTeam: player.nflTeam } : {}),
        ...(player.active !== undefined ? { active: player.active } : {}),
        ...(player.espnPlayerId
          ? { espnPlayerId: player.espnPlayerId }
          : {}),
        updatedAt: args.updatedAt,
      };
      if (existing) {
        await ctx.db.patch(existing._id, values);
        updated += 1;
      } else {
        await ctx.db.insert("sleeperPlayerCatalog", {
          externalPlayerId: player.externalPlayerId,
          ...values,
        });
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});

export const completeSleeperPlayerCatalog = internalMutation({
  args: {
    fetchedAt: v.number(),
    contentHash: v.string(),
    recordCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerCatalogState")
      .withIndex("by_provider_resource", (q) =>
        q.eq("provider", "sleeper").eq("resource", "nfl_players"),
      )
      .unique();
    const values = {
      fetchedAt: args.fetchedAt,
      contentHash: args.contentHash,
      recordCount: args.recordCount,
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else {
      await ctx.db.insert("providerCatalogState", {
        provider: "sleeper",
        resource: "nfl_players",
        ...values,
      });
    }
  },
});

export const upsertTransactions = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    contentHash: v.string(),
    weekNumber: v.number(),
    transactions: v.array(
      v.object({
        externalTransactionId: v.string(),
        kind: v.union(
          v.literal("waiver"),
          v.literal("free_agent"),
          v.literal("trade"),
          v.literal("commissioner"),
        ),
        occurredAt: v.number(),
        movements: v.array(
          v.object({
            externalTeamId: v.string(),
            externalPlayerId: v.string(),
            direction: v.union(v.literal("add"), v.literal("drop")),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }
    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("provider", syncRun.provider),
      )
      .unique();
    if (!providerRef) throw new Error("League provider reference is missing.");

    let transactionsCreated = 0;
    let transactionsUpdated = 0;
    let movementsCreated = 0;
    for (const input of args.transactions) {
      const transactionRef = await ctx.db
        .query("transactionProviderRefs")
        .withIndex("by_provider_league_external", (q) =>
          q
            .eq("provider", syncRun.provider)
            .eq("leagueProviderRefId", providerRef._id)
            .eq("externalTransactionId", input.externalTransactionId),
        )
        .unique();
      let transactionId = transactionRef?.transactionId;
      if (transactionId) {
        await ctx.db.patch(transactionId, {
          weekNumber: args.weekNumber,
          kind: input.kind,
          occurredAt: input.occurredAt,
          dataQuality: "verified",
        });
        const staleMovements = await ctx.db
          .query("transactionMovements")
          .withIndex("by_transaction", (q) =>
            q.eq("transactionId", transactionId!),
          )
          .collect();
        for (const movement of staleMovements) await ctx.db.delete(movement._id);
        transactionsUpdated += 1;
      } else {
        transactionId = await ctx.db.insert("transactions", {
          leagueSeasonId: syncRun.leagueSeasonId,
          weekNumber: args.weekNumber,
          kind: input.kind,
          occurredAt: input.occurredAt,
          dataQuality: "verified",
        });
        await ctx.db.insert("transactionProviderRefs", {
          transactionId,
          leagueProviderRefId: providerRef._id,
          provider: syncRun.provider,
          externalTransactionId: input.externalTransactionId,
        });
        transactionsCreated += 1;
      }
      for (const movement of input.movements) {
        const [entryRef, playerRef] = await Promise.all([
          ctx.db
            .query("seasonEntryProviderRefs")
            .withIndex("by_provider_league_external", (q) =>
              q
                .eq("provider", syncRun.provider)
                .eq("leagueProviderRefId", providerRef._id)
                .eq("externalEntryId", movement.externalTeamId),
            )
            .unique(),
          ctx.db
            .query("playerProviderRefs")
            .withIndex("by_provider_external", (q) =>
              q
                .eq("provider", syncRun.provider)
                .eq("externalPlayerId", movement.externalPlayerId),
            )
            .unique(),
        ]);
        if (!entryRef || !playerRef) {
          throw new Error(
            `Transaction ${input.externalTransactionId} references an unknown Roster or Player.`,
          );
        }
        await ctx.db.insert("transactionMovements", {
          transactionId,
          seasonEntryId: entryRef.seasonEntryId,
          playerId: playerRef.playerId,
          direction: movement.direction,
        });
        movementsCreated += 1;
      }
    }
    const completedAt = Date.now();
    await ctx.db.insert("sourceFetches", {
      syncRunId: syncRun._id,
      provider: syncRun.provider,
      resource: "transactions",
      externalKey: `${providerRef.externalLeagueId}:${args.weekNumber}`,
      fetchedAt: completedAt,
      contentHash: args.contentHash,
      recordCount: args.transactions.length,
    });
    await ctx.db.patch(syncRun._id, { status: "succeeded", completedAt });
    return {
      weekNumber: args.weekNumber,
      transactionCount: args.transactions.length,
      transactionsCreated,
      transactionsUpdated,
      movementsCreated,
    };
  },
});

export const upsertSleeperSeasonEntries = internalMutation({
  args: {
    syncRunId: v.id("syncRuns"),
    contentHash: v.string(),
    entries: v.array(
      v.object({
        externalRosterId: v.string(),
        externalOwnerId: v.optional(v.string()),
        displayName: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const syncRun = await ctx.db.get(args.syncRunId);
    if (!syncRun || syncRun.status !== "running") {
      throw new Error("Sync Run is missing or is not running.");
    }
    if (syncRun.provider !== "sleeper") {
      throw new Error("Sleeper Season Entry ingestion requires Sleeper.");
    }
    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q
          .eq("leagueSeasonId", syncRun.leagueSeasonId)
          .eq("provider", "sleeper"),
      )
      .unique();
    if (!providerRef) throw new Error("Sleeper league reference is missing.");

    let entriesCreated = 0;
    let entriesUpdated = 0;
    let membershipsLinked = 0;
    let unresolvedOwners = 0;

    for (const input of args.entries) {
      let entryRef = await ctx.db
        .query("seasonEntryProviderRefs")
        .withIndex("by_provider_league_external", (q) =>
          q
            .eq("provider", "sleeper")
            .eq("leagueProviderRefId", providerRef._id)
            .eq("externalEntryId", input.externalRosterId),
        )
        .unique();
      let seasonEntryId = entryRef?.seasonEntryId;
      if (!seasonEntryId) {
        seasonEntryId = await ctx.db.insert("seasonEntries", {
          leagueSeasonId: syncRun.leagueSeasonId,
          displayName: input.displayName,
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
          active: true,
        });
        const entryRefId = await ctx.db.insert("seasonEntryProviderRefs", {
          seasonEntryId,
          leagueProviderRefId: providerRef._id,
          provider: "sleeper",
          externalEntryId: input.externalRosterId,
          ...(input.externalOwnerId
            ? { externalOwnerId: input.externalOwnerId }
            : {}),
        });
        entryRef = await ctx.db.get(entryRefId);
        entriesCreated += 1;
      } else {
        await ctx.db.patch(seasonEntryId, {
          displayName: input.displayName,
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
          active: true,
        });
        if (entryRef) {
          await ctx.db.patch(entryRef._id, {
            ...(input.externalOwnerId
              ? { externalOwnerId: input.externalOwnerId }
              : {}),
          });
        }
        entriesUpdated += 1;
      }
      if (!seasonEntryId || !entryRef || !input.externalOwnerId) continue;

      const memberRef = await ctx.db
        .query("memberProviderRefs")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", "sleeper")
            .eq("externalUserId", input.externalOwnerId!),
        )
        .unique();
      if (memberRef) {
        const existingMembership = await ctx.db
          .query("seasonEntryMembers")
          .withIndex("by_entry", (q) => q.eq("seasonEntryId", seasonEntryId))
          .filter((q) => q.eq(q.field("role"), "primary"))
          .unique();
        if (existingMembership) {
          if (existingMembership.memberId !== memberRef.memberId) {
            await ctx.db.patch(existingMembership._id, {
              memberId: memberRef.memberId,
            });
          }
        } else {
          await ctx.db.insert("seasonEntryMembers", {
            leagueSeasonId: syncRun.leagueSeasonId,
            seasonEntryId,
            memberId: memberRef.memberId,
            role: "primary",
          });
        }
        membershipsLinked += 1;
        continue;
      }

      const existingExceptions = await ctx.db
        .query("identityExceptions")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", "sleeper")
            .eq("externalId", input.externalOwnerId!),
        )
        .collect();
      if (
        !existingExceptions.some(
          (exception) =>
            exception.leagueSeasonId === syncRun.leagueSeasonId &&
            exception.status === "unresolved",
        )
      ) {
        await ctx.db.insert("identityExceptions", {
          leagueSeasonId: syncRun.leagueSeasonId,
          entityType: "member",
          provider: "sleeper",
          externalId: input.externalOwnerId,
          reason: `Sleeper owner for roster ${input.externalRosterId} requires an explicit Member crosswalk.`,
          status: "unresolved",
        });
      }
      unresolvedOwners += 1;
    }

    const completedAt = Date.now();
    await ctx.db.insert("sourceFetches", {
      syncRunId: syncRun._id,
      provider: "sleeper",
      resource: "season_entries",
      externalKey: providerRef.externalLeagueId,
      fetchedAt: completedAt,
      contentHash: args.contentHash,
      recordCount: args.entries.length,
    });
    await ctx.db.patch(providerRef._id, { lastSyncedAt: completedAt });
    await ctx.db.patch(syncRun._id, {
      status: "succeeded",
      completedAt,
    });
    return {
      entryCount: args.entries.length,
      entriesCreated,
      entriesUpdated,
      membershipsLinked,
      unresolvedOwners,
    };
  },
});

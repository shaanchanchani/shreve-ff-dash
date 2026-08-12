import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const linkSleeperMember = internalMutation({
  args: {
    sleeperUserId: v.string(),
    canonicalMemberKey: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_canonical_key", (q) =>
        q.eq("canonicalKey", args.canonicalMemberKey),
      )
      .unique();
    if (!member) {
      throw new Error(`Unknown Member ${args.canonicalMemberKey}.`);
    }
    const existingRef = await ctx.db
      .query("memberProviderRefs")
      .withIndex("by_provider_external", (q) =>
        q.eq("provider", "sleeper").eq("externalUserId", args.sleeperUserId),
      )
      .unique();
    if (existingRef) {
      await ctx.db.patch(existingRef._id, {
        memberId: member._id,
        externalIdKind: "native",
        mappingMethod: "manual",
      });
    } else {
      await ctx.db.insert("memberProviderRefs", {
        memberId: member._id,
        provider: "sleeper",
        externalUserId: args.sleeperUserId,
        externalIdKind: "native",
        mappingMethod: "manual",
      });
    }

    const entryRefs = (await ctx.db.query("seasonEntryProviderRefs").collect()).filter(
      (reference) =>
        reference.provider === "sleeper" &&
        reference.externalOwnerId === args.sleeperUserId,
    );
    for (const entryRef of entryRefs) {
      const entry = await ctx.db.get(entryRef.seasonEntryId);
      if (!entry) continue;
      const primary = await ctx.db
        .query("seasonEntryMembers")
        .withIndex("by_entry", (q) => q.eq("seasonEntryId", entry._id))
        .filter((q) => q.eq(q.field("role"), "primary"))
        .unique();
      if (primary) await ctx.db.patch(primary._id, { memberId: member._id });
      else {
        await ctx.db.insert("seasonEntryMembers", {
          leagueSeasonId: entry.leagueSeasonId,
          seasonEntryId: entry._id,
          memberId: member._id,
          role: "primary",
        });
      }
    }

    const exceptions = await ctx.db
      .query("identityExceptions")
      .withIndex("by_provider_external", (q) =>
        q.eq("provider", "sleeper").eq("externalId", args.sleeperUserId),
      )
      .collect();
    for (const exception of exceptions) {
      if (exception.status === "unresolved") {
        await ctx.db.patch(exception._id, {
          candidateInternalId: member._id,
          status: "resolved",
        });
      }
    }
    return { memberId: member._id, linkedEntryCount: entryRefs.length };
  },
});

export const sleeperCrosswalk = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [members, entryRefs, entries, memberRefs, memberships] =
      await Promise.all([
        ctx.db.query("members").collect(),
        ctx.db.query("seasonEntryProviderRefs").collect(),
        ctx.db.query("seasonEntries").collect(),
        ctx.db.query("memberProviderRefs").collect(),
        ctx.db.query("seasonEntryMembers").collect(),
      ]);
    const memberById = new Map(members.map((member) => [member._id, member]));
    const entryById = new Map(entries.map((entry) => [entry._id, entry]));
    return entryRefs
      .filter((reference) => reference.provider === "sleeper")
      .map((reference) => {
        const membership = memberships.find(
          (candidate) =>
            candidate.seasonEntryId === reference.seasonEntryId &&
            candidate.role === "primary",
        );
        const member = membership
          ? memberById.get(membership.memberId)
          : undefined;
        const directRef = reference.externalOwnerId
          ? memberRefs.find(
              (candidate) =>
                candidate.provider === "sleeper" &&
                candidate.externalUserId === reference.externalOwnerId,
            )
          : undefined;
        return {
          sleeperRosterId: reference.externalEntryId,
          sleeperUserId: reference.externalOwnerId,
          teamName: entryById.get(reference.seasonEntryId)?.displayName,
          canonicalMemberKey: member?.canonicalKey,
          linked: Boolean(member && directRef),
        };
      });
  },
});

export const sleeperPlayersByExternalIds = internalQuery({
  args: { externalPlayerIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const rows = [];
    for (const externalPlayerId of args.externalPlayerIds) {
      const sleeperRef = await ctx.db
        .query("playerProviderRefs")
        .withIndex("by_provider_external", (q) =>
          q
            .eq("provider", "sleeper")
            .eq("externalPlayerId", externalPlayerId),
        )
        .unique();
      if (!sleeperRef) continue;
      const player = await ctx.db.get(sleeperRef.playerId);
      if (!player) continue;
      const espnRef = await ctx.db
        .query("playerProviderRefs")
        .withIndex("by_player_provider", (q) =>
          q.eq("playerId", player._id).eq("provider", "espn"),
        )
        .unique();
      rows.push({
        externalPlayerId,
        ...(espnRef ? { espnPlayerId: espnRef.externalPlayerId } : {}),
        fullName: player.fullName,
        ...(player.position ? { position: player.position } : {}),
        ...(player.nflTeam ? { nflTeam: player.nflTeam } : {}),
        ...(player.active !== undefined ? { active: player.active } : {}),
      });
    }
    return rows;
  },
});

export const sleeperCatalogStatus = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("providerCatalogState")
      .withIndex("by_provider_resource", (q) =>
        q.eq("provider", "sleeper").eq("resource", "nfl_players"),
      )
      .unique(),
});

export const sleeperCatalogPlayers = internalQuery({
  args: { externalPlayerIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const players = [];
    for (const externalPlayerId of args.externalPlayerIds) {
      const player = await ctx.db
        .query("sleeperPlayerCatalog")
        .withIndex("by_external_player", (q) =>
          q.eq("externalPlayerId", externalPlayerId),
        )
        .unique();
      if (player) players.push(player);
    }
    return players;
  },
});

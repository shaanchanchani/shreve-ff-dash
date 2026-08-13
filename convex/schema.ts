import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  dataQualityValidator,
  matchupResultValidator,
  matchupStateValidator,
  providerValidator,
  seasonStatusValidator,
  syncStatusValidator,
  transactionKindValidator,
} from "./model";

export default defineSchema({
  leagues: defineTable({
    slug: v.string(),
    name: v.string(),
    sport: v.literal("nfl"),
  }).index("by_slug", ["slug"]),

  leagueSeasons: defineTable({
    leagueId: v.id("leagues"),
    year: v.number(),
    status: seasonStatusValidator,
    authoritativeProvider: providerValidator,
    regularSeasonWeeks: v.number(),
  })
    .index("by_league_year", ["leagueId", "year"])
    .index("by_year", ["year"]),

  leagueProviderRefs: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    provider: providerValidator,
    externalLeagueId: v.string(),
    previousExternalLeagueId: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_season_provider", ["leagueSeasonId", "provider"])
    .index("by_provider_external", ["provider", "externalLeagueId"]),

  members: defineTable({
    canonicalKey: v.string(),
    displayName: v.string(),
    active: v.boolean(),
  }).index("by_canonical_key", ["canonicalKey"]),

  memberProviderRefs: defineTable({
    memberId: v.id("members"),
    provider: providerValidator,
    externalUserId: v.string(),
    externalIdKind: v.union(v.literal("native"), v.literal("synthetic")),
    displayNameAtImport: v.optional(v.string()),
    mappingMethod: v.union(
      v.literal("verified"),
      v.literal("provider_crosswalk"),
      v.literal("provider_claim"),
      v.literal("manual"),
    ),
  })
    .index("by_member_provider", ["memberId", "provider"])
    .index("by_provider_external", ["provider", "externalUserId"]),

  seasonEntries: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    active: v.boolean(),
  }).index("by_season", ["leagueSeasonId"]),

  seasonEntryMembers: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    seasonEntryId: v.id("seasonEntries"),
    memberId: v.id("members"),
    role: v.union(v.literal("primary"), v.literal("co_owner")),
  })
    .index("by_entry", ["seasonEntryId"])
    .index("by_member_season", ["memberId", "leagueSeasonId"]),

  seasonEntryProviderRefs: defineTable({
    seasonEntryId: v.id("seasonEntries"),
    leagueProviderRefId: v.id("leagueProviderRefs"),
    provider: providerValidator,
    externalEntryId: v.string(),
    externalOwnerId: v.optional(v.string()),
  })
    .index("by_entry_provider", ["seasonEntryId", "provider"])
    .index("by_provider_league_external", [
      "provider",
      "leagueProviderRefId",
      "externalEntryId",
    ]),

  weeks: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    number: v.number(),
    phase: v.union(
      v.literal("regular"),
      v.literal("playoffs"),
      v.literal("consolation"),
    ),
    state: matchupStateValidator,
    startsAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_season_number", ["leagueSeasonId", "number"]),

  matchups: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    weekId: v.id("weeks"),
    weekNumber: v.number(),
    state: matchupStateValidator,
    dataQuality: dataQualityValidator,
  })
    .index("by_week", ["weekId"])
    .index("by_season_week", ["leagueSeasonId", "weekNumber"]),

  matchupProviderRefs: defineTable({
    matchupId: v.id("matchups"),
    leagueProviderRefId: v.id("leagueProviderRefs"),
    provider: providerValidator,
    weekNumber: v.number(),
    externalMatchupId: v.string(),
  }).index("by_provider_league_week_external", [
    "provider",
    "leagueProviderRefId",
    "weekNumber",
    "externalMatchupId",
  ]),

  matchupParticipants: defineTable({
    matchupId: v.id("matchups"),
    weekId: v.id("weeks"),
    seasonEntryId: v.id("seasonEntries"),
    slot: v.union(v.literal(1), v.literal(2)),
    score: v.optional(v.number()),
    providerScore: v.optional(v.number()),
    commissionerAdjustment: v.optional(v.number()),
    result: matchupResultValidator,
  })
    .index("by_matchup", ["matchupId"])
    .index("by_entry_week", ["seasonEntryId", "weekId"]),

  players: defineTable({
    canonicalKey: v.string(),
    fullName: v.string(),
    position: v.optional(v.string()),
    nflTeam: v.optional(v.string()),
    active: v.optional(v.boolean()),
  }).index("by_canonical_key", ["canonicalKey"]),

  playerProviderRefs: defineTable({
    playerId: v.id("players"),
    provider: providerValidator,
    externalPlayerId: v.string(),
    mappingMethod: v.union(
      v.literal("provider_crosswalk"),
      v.literal("provider_claim"),
      v.literal("verified"),
      v.literal("manual"),
    ),
  })
    .index("by_player_provider", ["playerId", "provider"])
    .index("by_provider_external", ["provider", "externalPlayerId"]),

  sleeperPlayerCatalog: defineTable({
    externalPlayerId: v.string(),
    fullName: v.string(),
    position: v.optional(v.string()),
    nflTeam: v.optional(v.string()),
    active: v.optional(v.boolean()),
    espnPlayerId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_external_player", ["externalPlayerId"]),

  providerCatalogState: defineTable({
    provider: providerValidator,
    resource: v.string(),
    fetchedAt: v.number(),
    contentHash: v.string(),
    recordCount: v.number(),
  }).index("by_provider_resource", ["provider", "resource"]),

  lineupEntries: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    matchupParticipantId: v.id("matchupParticipants"),
    playerId: v.id("players"),
    rosterSlot: v.string(),
    started: v.boolean(),
    points: v.number(),
  })
    .index("by_season", ["leagueSeasonId"])
    .index("by_participant", ["matchupParticipantId"])
    .index("by_player", ["playerId"])
    .index("by_player_season", ["playerId", "leagueSeasonId"]),

  draftPicks: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    seasonEntryId: v.id("seasonEntries"),
    playerId: v.id("players"),
    round: v.number(),
    pickNumber: v.number(),
    keeper: v.optional(v.boolean()),
    sourceSyncRunId: v.optional(v.id("syncRuns")),
  })
    .index("by_season_entry", ["leagueSeasonId", "seasonEntryId"])
    .index("by_player", ["playerId"])
    .index("by_season_player", ["leagueSeasonId", "playerId"]),

  transactions: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    weekNumber: v.number(),
    kind: transactionKindValidator,
    occurredAt: v.number(),
    dataQuality: dataQualityValidator,
  }).index("by_season_week", ["leagueSeasonId", "weekNumber"]),

  transactionProviderRefs: defineTable({
    transactionId: v.id("transactions"),
    leagueProviderRefId: v.id("leagueProviderRefs"),
    provider: providerValidator,
    externalTransactionId: v.string(),
  }).index("by_provider_league_external", [
    "provider",
    "leagueProviderRefId",
    "externalTransactionId",
  ]),

  transactionMovements: defineTable({
    transactionId: v.id("transactions"),
    seasonEntryId: v.id("seasonEntries"),
    playerId: v.id("players"),
    direction: v.union(v.literal("add"), v.literal("drop")),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_player", ["playerId"]),

  scoringRuleVersions: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    effectiveWeek: v.number(),
    regularSeasonWeeks: v.number(),
    playoffTeamCount: v.number(),
    playoffByeCount: v.number(),
    medianWinEnabled: v.boolean(),
    rosterSlots: v.array(
      v.object({
        slot: v.string(),
        count: v.number(),
      }),
    ),
    pointRules: v.array(
      v.object({
        stat: v.string(),
        points: v.number(),
      }),
    ),
    sourceHash: v.string(),
    sourceSyncRunId: v.id("syncRuns"),
  }).index("by_season_effective_week", ["leagueSeasonId", "effectiveWeek"]),

  syncRuns: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    provider: providerValidator,
    scope: v.string(),
    status: syncStatusValidator,
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    cursor: v.optional(v.string()),
    attempt: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_season_status", ["leagueSeasonId", "status"])
    .index("by_provider_started", ["provider", "startedAt"]),

  sourceFetches: defineTable({
    syncRunId: v.id("syncRuns"),
    provider: providerValidator,
    resource: v.string(),
    externalKey: v.string(),
    fetchedAt: v.number(),
    contentHash: v.string(),
    recordCount: v.optional(v.number()),
  }).index("by_sync_run", ["syncRunId"]),

  identityExceptions: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    entityType: v.union(v.literal("member"), v.literal("player")),
    provider: providerValidator,
    externalId: v.string(),
    candidateInternalId: v.optional(v.string()),
    reason: v.string(),
    status: v.union(
      v.literal("unresolved"),
      v.literal("resolved"),
      v.literal("ignored"),
    ),
  })
    .index("by_season_status", ["leagueSeasonId", "status"])
    .index("by_provider_external", ["provider", "externalId"]),

  dashboardSnapshots: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    kind: v.union(
      v.literal("prizes"),
      v.literal("standings"),
      v.literal("history_summary"),
      v.literal("longest_touchdowns"),
    ),
    calculationVersion: v.number(),
    generatedAt: v.number(),
    sourceSyncRunId: v.optional(v.id("syncRuns")),
    payload: v.any(),
  }).index("by_season_kind", ["leagueSeasonId", "kind"]),

  historySeasonSnapshots: defineTable({
    leagueSeasonId: v.id("leagueSeasons"),
    calculationVersion: v.number(),
    generatedAt: v.number(),
    sourceSyncRunId: v.optional(v.id("syncRuns")),
    payload: v.any(),
  }).index("by_season", ["leagueSeasonId"]),
});

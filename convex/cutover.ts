import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { providerValidator } from "./model";

type Provider = "espn" | "sleeper";
type SeasonStatus = "planned" | "preseason" | "active" | "complete";
type Finding = { code: string; message: string; count?: number };

type CutoverReadiness = {
  ready: boolean;
  seasonYear: number;
  provider: Provider;
  season: {
    exists: boolean;
    status: SeasonStatus | null;
    authoritativeProvider: Provider | null;
  };
  configuredExternalLeagueId: string | null;
  counts: {
    entries: number;
    linkedPrimaryMembers: number;
    matchups: number;
    participants: number;
    lineupEntries: number;
    providerPlayers: number;
    dualProviderPlayers: number;
    unresolvedIdentityExceptions: number;
    seasonRuleVersions: number;
  };
  freshness: {
    lastSuccessfulSyncAt: number | null;
    dashboardGeneratedAt: number | null;
    historyGeneratedAt: number | null;
    playerCatalogFetchedAt: number | null;
  };
  blockers: Finding[];
  warnings: Finding[];
};

type SleeperVerificationSummary = {
  passed: boolean;
  seasonYear: number;
  issues: string[];
  [key: string]: unknown;
};

type SleeperPreparationResult = {
  verification: SleeperVerificationSummary;
  seasonEntries: Record<string, unknown>;
  draft: Record<string, unknown>;
  crosswalk: Array<Record<string, unknown>>;
  readiness: CutoverReadiness;
};

const emptyCounts = () => ({
  entries: 0,
  linkedPrimaryMembers: 0,
  matchups: 0,
  participants: 0,
  lineupEntries: 0,
  providerPlayers: 0,
  dualProviderPlayers: 0,
  unresolvedIdentityExceptions: 0,
  seasonRuleVersions: 0,
});

export const prepareSleeper = internalAction({
  args: {
    seasonYear: v.number(),
    externalLeagueId: v.string(),
    verificationWeek: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SleeperPreparationResult> => {
    const verificationWeek = args.verificationWeek ?? 1;
    if (!Number.isInteger(verificationWeek) || verificationWeek < 1) {
      throw new Error("Verification Week must be a positive integer.");
    }
    const verification = (await ctx.runAction(
      internal.providers.sleeper.verifyLeaguePayload,
      {
        externalLeagueId: args.externalLeagueId,
        week: verificationWeek,
      },
    )) as SleeperVerificationSummary;
    if (verification.seasonYear !== args.seasonYear) {
      throw new Error(
        `Sleeper league season ${verification.seasonYear} does not match ${args.seasonYear}.`,
      );
    }
    if (!verification.passed) {
      throw new Error(
        `Sleeper payload verification failed: ${verification.issues.join(" ")}`,
      );
    }

    const seasonEntries = (await ctx.runAction(
      internal.providers.sleeper.syncSeasonEntries,
      {
        seasonYear: args.seasonYear,
        externalLeagueId: args.externalLeagueId,
      },
    )) as Record<string, unknown>;
    const draft = (await ctx.runAction(internal.providers.sleeper.syncDraft, {
      seasonYear: args.seasonYear,
      externalLeagueId: args.externalLeagueId,
    })) as Record<string, unknown>;
    const crosswalk = (await ctx.runQuery(
      internal.identityManagement.sleeperCrosswalk,
      {},
    )) as Array<Record<string, unknown>>;
    const readiness: CutoverReadiness = await ctx.runQuery(
      internal.cutover.readiness,
      { seasonYear: args.seasonYear, provider: "sleeper" },
    );
    return {
      verification,
      seasonEntries,
      draft,
      crosswalk,
      readiness,
    };
  },
});

export const readiness = internalQuery({
  args: {
    seasonYear: v.number(),
    provider: providerValidator,
  },
  handler: async (ctx, args): Promise<CutoverReadiness> => {
    const blockers: Finding[] = [];
    const warnings: Finding[] = [];
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    const season = league
      ? await ctx.db
          .query("leagueSeasons")
          .withIndex("by_league_year", (q) =>
            q.eq("leagueId", league._id).eq("year", args.seasonYear),
          )
          .unique()
      : null;

    if (!season) {
      blockers.push({
        code: "season_missing",
        message: `Canonical season ${args.seasonYear} does not exist.`,
      });
      return {
        ready: false,
        seasonYear: args.seasonYear,
        provider: args.provider,
        season: {
          exists: false,
          status: null,
          authoritativeProvider: null,
        },
        configuredExternalLeagueId: null,
        counts: emptyCounts(),
        freshness: {
          lastSuccessfulSyncAt: null,
          dashboardGeneratedAt: null,
          historyGeneratedAt: null,
          playerCatalogFetchedAt: null,
        },
        blockers,
        warnings,
      };
    }

    if (season.authoritativeProvider !== args.provider) {
      blockers.push({
        code: "authoritative_provider_mismatch",
        message: `Season ${args.seasonYear} is authoritative from ${season.authoritativeProvider}, not ${args.provider}.`,
      });
    }
    if (season.status === "planned") {
      blockers.push({
        code: "season_not_initialized",
        message: "The season is still planned; import provider rosters first.",
      });
    }

    const providerRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q.eq("leagueSeasonId", season._id).eq("provider", args.provider),
      )
      .unique();
    if (!providerRef) {
      blockers.push({
        code: "provider_league_missing",
        message: `No ${args.provider} league ID is attached to ${args.seasonYear}.`,
      });
    }

    const [
      entries,
      allEntryRefs,
      allMemberships,
      allMemberRefs,
      matchups,
      allParticipants,
      allMatchupRefs,
      lineups,
      draftPicks,
      exceptions,
      dashboard,
      historySnapshot,
      providerRuns,
      seasonRuleVersions,
    ] = await Promise.all([
      ctx.db
        .query("seasonEntries")
        .withIndex("by_season", (q) => q.eq("leagueSeasonId", season._id))
        .collect(),
      ctx.db.query("seasonEntryProviderRefs").collect(),
      ctx.db.query("seasonEntryMembers").collect(),
      ctx.db.query("memberProviderRefs").collect(),
      ctx.db
        .query("matchups")
        .withIndex("by_season_week", (q) => q.eq("leagueSeasonId", season._id))
        .collect(),
      ctx.db.query("matchupParticipants").collect(),
      ctx.db.query("matchupProviderRefs").collect(),
      ctx.db
        .query("lineupEntries")
        .withIndex("by_season", (q) => q.eq("leagueSeasonId", season._id))
        .collect(),
      ctx.db
        .query("draftPicks")
        .withIndex("by_season_entry", (q) => q.eq("leagueSeasonId", season._id))
        .collect(),
      ctx.db
        .query("identityExceptions")
        .withIndex("by_season_status", (q) =>
          q.eq("leagueSeasonId", season._id).eq("status", "unresolved"),
        )
        .collect(),
      ctx.db
        .query("dashboardSnapshots")
        .withIndex("by_season_kind", (q) =>
          q.eq("leagueSeasonId", season._id).eq("kind", "prizes"),
        )
        .order("desc")
        .first(),
      ctx.db
        .query("historySeasonSnapshots")
        .withIndex("by_season", (q) => q.eq("leagueSeasonId", season._id))
        .unique(),
      ctx.db
        .query("syncRuns")
        .withIndex("by_provider_started", (q) => q.eq("provider", args.provider))
        .order("desc")
        .collect(),
      ctx.db
        .query("scoringRuleVersions")
        .withIndex("by_season_effective_week", (q) =>
          q.eq("leagueSeasonId", season._id),
        )
        .collect(),
    ]);

    if (seasonRuleVersions.length === 0) {
      blockers.push({
        code: "season_rules_missing",
        message: "Canonical Season Rules have not been imported.",
      });
    } else {
      const currentRules = [...seasonRuleVersions].sort(
        (left, right) => right.effectiveWeek - left.effectiveWeek,
      )[0];
      if (currentRules.regularSeasonWeeks !== season.regularSeasonWeeks) {
        blockers.push({
          code: "season_rules_mismatch",
          message: `League Season has ${season.regularSeasonWeeks} regular weeks, but its current rules specify ${currentRules.regularSeasonWeeks}.`,
        });
      }
    }

    const entryIds = new Set(entries.map((entry) => String(entry._id)));
    const entryRefs = allEntryRefs.filter(
      (reference) =>
        entryIds.has(String(reference.seasonEntryId)) &&
        reference.provider === args.provider,
    );
    const memberships = allMemberships.filter((membership) =>
      entryIds.has(String(membership.seasonEntryId)),
    );
    const activeEntries = entries.filter((entry) => entry.active);

    if (activeEntries.length === 0) {
      blockers.push({
        code: "season_entries_missing",
        message: "No active canonical season entries have been imported.",
      });
    }

    let linkedPrimaryMembers = 0;
    let missingEntryRefs = 0;
    let primaryMembershipIssues = 0;
    let missingMemberCrosswalks = 0;
    for (const entry of activeEntries) {
      const ref = entryRefs.find(
        (candidate) => candidate.seasonEntryId === entry._id,
      );
      if (!ref) {
        missingEntryRefs += 1;
        continue;
      }
      const primaries = memberships.filter(
        (membership) =>
          membership.seasonEntryId === entry._id && membership.role === "primary",
      );
      if (primaries.length !== 1) {
        primaryMembershipIssues += 1;
        continue;
      }
      if (ref.externalOwnerId) {
        const directRef = allMemberRefs.find(
          (candidate) =>
            candidate.provider === args.provider &&
            candidate.externalUserId === ref.externalOwnerId &&
            candidate.memberId === primaries[0].memberId,
        );
        if (!directRef) {
          missingMemberCrosswalks += 1;
          continue;
        }
      }
      linkedPrimaryMembers += 1;
    }
    if (missingEntryRefs > 0) {
      blockers.push({
        code: "entry_provider_refs_missing",
        message: `${missingEntryRefs} active entries lack a ${args.provider} roster reference.`,
        count: missingEntryRefs,
      });
    }
    if (primaryMembershipIssues > 0) {
      blockers.push({
        code: "primary_membership_invalid",
        message: `${primaryMembershipIssues} active entries do not have exactly one primary canonical Member.`,
        count: primaryMembershipIssues,
      });
    }
    if (missingMemberCrosswalks > 0) {
      blockers.push({
        code: "member_crosswalk_incomplete",
        message: `${missingMemberCrosswalks} provider owners are not explicitly linked to their primary canonical Member.`,
        count: missingMemberCrosswalks,
      });
    }
    if (exceptions.length > 0) {
      blockers.push({
        code: "unresolved_identity_exceptions",
        message: `${exceptions.length} identity exceptions still require resolution or an explicit ignore decision.`,
        count: exceptions.length,
      });
    }

    const matchupIds = new Set(matchups.map((matchup) => String(matchup._id)));
    const participants = allParticipants.filter((participant) =>
      matchupIds.has(String(participant.matchupId)),
    );
    let invalidParticipantMatchups = 0;
    let missingMatchupRefs = 0;
    let missingLineups = 0;
    let scoreMismatches = 0;
    const lineupsByParticipant = new Map<string, typeof lineups>();
    for (const lineup of lineups) {
      const key = String(lineup.matchupParticipantId);
      const rows = lineupsByParticipant.get(key) ?? [];
      rows.push(lineup);
      lineupsByParticipant.set(key, rows);
    }
    for (const matchup of matchups) {
      const matchupParticipants = participants.filter(
        (participant) => participant.matchupId === matchup._id,
      );
      if (matchupParticipants.length !== 2) invalidParticipantMatchups += 1;
      if (
        providerRef &&
        !allMatchupRefs.some(
          (reference) =>
            reference.matchupId === matchup._id &&
            reference.provider === args.provider &&
            reference.leagueProviderRefId === providerRef._id,
        )
      ) {
        missingMatchupRefs += 1;
      }
      for (const participant of matchupParticipants) {
        const participantLineups =
          lineupsByParticipant.get(String(participant._id)) ?? [];
        if (matchup.state !== "scheduled" && participantLineups.length === 0) {
          missingLineups += 1;
        }
        if (participant.providerScore !== undefined) {
          const startedTotal = participantLineups
            .filter((lineup) => lineup.started)
            .reduce((total, lineup) => total + lineup.points, 0);
          if (Math.abs(startedTotal - participant.providerScore) > 0.01) {
            scoreMismatches += 1;
          }
        }
      }
    }
    for (const [code, count, message] of [
      [
        "matchup_participants_invalid",
        invalidParticipantMatchups,
        "matchups do not have exactly two participants",
      ],
      [
        "matchup_provider_refs_missing",
        missingMatchupRefs,
        `matchups lack a ${args.provider} source reference`,
      ],
      ["lineups_missing", missingLineups, "participants lack lineup facts"],
      [
        "provider_score_mismatch",
        scoreMismatches,
        "participant provider scores do not equal started-player totals",
      ],
    ] as const) {
      if (count > 0) {
        blockers.push({
          code,
          message: `${count} ${message}.`,
          count,
        });
      }
    }

    const seasonRuns = providerRuns.filter(
      (run) => run.leagueSeasonId === season._id,
    );
    const latestByScope = new Map<string, (typeof seasonRuns)[number]>();
    for (const run of seasonRuns) {
      if (!latestByScope.has(run.scope)) latestByScope.set(run.scope, run);
    }
    const latestFailures = Array.from(latestByScope.values()).filter(
      (run) => run.status === "failed",
    );
    if (latestFailures.length > 0) {
      blockers.push({
        code: "latest_sync_failed",
        message: `${latestFailures.length} provider sync scopes most recently failed: ${latestFailures.map((run) => run.scope).join(", ")}.`,
        count: latestFailures.length,
      });
    }
    const dashboardInputRuns = seasonRuns.filter(
      (run) => run.scope === "season_entries" || run.scope.startsWith("week:"),
    );
    const latestSuccessfulRun = dashboardInputRuns.find(
      (run) => run.status === "succeeded" && run.completedAt !== undefined,
    );
    const latestHistoryInputRun = seasonRuns.find(
      (run) =>
        run.status === "succeeded" &&
        run.completedAt !== undefined &&
        (run.scope === "season_entries" ||
          run.scope === "draft" ||
          run.scope.startsWith("week:") ||
          run.scope.startsWith("transactions:")),
    );
    const seasonEntriesRun = seasonRuns.find(
      (run) => run.scope === "season_entries" && run.status === "succeeded",
    );
    if (!seasonEntriesRun) {
      blockers.push({
        code: "season_entries_sync_missing",
        message: `No successful ${args.provider} season-entry sync exists.`,
      });
    }
    const lastSuccessfulSyncAt = latestSuccessfulRun?.completedAt ?? null;
    if (season.status === "active") {
      const fifteenMinutes = 15 * 60 * 1_000;
      if (!lastSuccessfulSyncAt || Date.now() - lastSuccessfulSyncAt > fifteenMinutes) {
        blockers.push({
          code: "active_sync_stale",
          message: "The active-season provider data has not synced successfully in the last 15 minutes.",
        });
      }
    }

    if (!dashboard) {
      blockers.push({
        code: "dashboard_snapshot_missing",
        message: "The warm prizes/standings dashboard snapshot has not been materialized.",
      });
    } else if (
      lastSuccessfulSyncAt !== null &&
      dashboard.generatedAt < lastSuccessfulSyncAt
    ) {
      blockers.push({
        code: "dashboard_snapshot_stale",
        message: "The dashboard snapshot predates the latest successful provider sync.",
      });
    }
    if (matchups.length > 0 && !historySnapshot) {
      blockers.push({
        code: "history_snapshot_missing",
        message: "Canonical matchups exist, but the warm history snapshot has not been materialized.",
      });
    } else if (
      historySnapshot &&
      latestHistoryInputRun?.completedAt !== undefined &&
      historySnapshot.generatedAt < latestHistoryInputRun.completedAt
    ) {
      blockers.push({
        code: "history_snapshot_stale",
        message: "The history snapshot predates the latest successful provider sync.",
      });
    }

    let playerCatalogFetchedAt: number | null = null;
    if (args.provider === "sleeper") {
      const catalog = await ctx.db
        .query("providerCatalogState")
        .withIndex("by_provider_resource", (q) =>
          q.eq("provider", "sleeper").eq("resource", "nfl_players"),
        )
        .unique();
      playerCatalogFetchedAt = catalog?.fetchedAt ?? null;
      const twoDays = 48 * 60 * 60 * 1_000;
      if (!catalog) {
        blockers.push({
          code: "player_catalog_missing",
          message: "The Sleeper NFL player catalog has not been cached.",
        });
      } else if (Date.now() - catalog.fetchedAt > twoDays) {
        blockers.push({
          code: "player_catalog_stale",
          message: "The Sleeper NFL player catalog is older than 48 hours.",
        });
      }
    }

    const seasonPlayerIds = new Set([
      ...lineups.map((lineup) => String(lineup.playerId)),
      ...draftPicks.map((pick) => String(pick.playerId)),
    ]);
    const allPlayerRefs = await ctx.db.query("playerProviderRefs").collect();
    const providerPlayerIds = new Set(
      allPlayerRefs
        .filter(
          (reference) =>
            reference.provider === args.provider &&
            seasonPlayerIds.has(String(reference.playerId)),
        )
        .map((reference) => String(reference.playerId)),
    );
    const otherProvider = args.provider === "sleeper" ? "espn" : "sleeper";
    const otherPlayerIds = new Set(
      allPlayerRefs
        .filter(
          (reference) =>
            reference.provider === otherProvider &&
            seasonPlayerIds.has(String(reference.playerId)),
        )
        .map((reference) => String(reference.playerId)),
    );
    const dualProviderPlayers = Array.from(providerPlayerIds).filter((playerId) =>
      otherPlayerIds.has(playerId),
    ).length;
    const missingProviderPlayers = seasonPlayerIds.size - providerPlayerIds.size;
    if (missingProviderPlayers > 0) {
      blockers.push({
        code: "player_provider_refs_missing",
        message: `${missingProviderPlayers} season players lack a ${args.provider} source identity.`,
        count: missingProviderPlayers,
      });
    }
    const missingHistoricalCrosswalks =
      providerPlayerIds.size - dualProviderPlayers;
    if (missingHistoricalCrosswalks > 0) {
      warnings.push({
        code: "player_historical_crosswalk_partial",
        message: `${missingHistoricalCrosswalks} ${args.provider} players have no ${otherProvider} identity; this is expected for provider-only IDs and rookies but should be reviewed.`,
        count: missingHistoricalCrosswalks,
      });
    }

    return {
      ready: blockers.length === 0,
      seasonYear: args.seasonYear,
      provider: args.provider,
      season: {
        exists: true,
        status: season.status,
        authoritativeProvider: season.authoritativeProvider,
      },
      configuredExternalLeagueId: providerRef?.externalLeagueId ?? null,
      counts: {
        entries: activeEntries.length,
        linkedPrimaryMembers,
        matchups: matchups.length,
        participants: participants.length,
        lineupEntries: lineups.length,
        providerPlayers: providerPlayerIds.size,
        dualProviderPlayers,
        unresolvedIdentityExceptions: exceptions.length,
        seasonRuleVersions: seasonRuleVersions.length,
      },
      freshness: {
        lastSuccessfulSyncAt,
        dashboardGeneratedAt: dashboard?.generatedAt ?? null,
        historyGeneratedAt: historySnapshot?.generatedAt ?? null,
        playerCatalogFetchedAt,
      },
      blockers,
      warnings,
    };
  },
});

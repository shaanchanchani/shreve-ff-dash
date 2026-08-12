import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type SleeperLeague = {
  league_id: string;
  season: string;
  draft_id?: string | null;
  previous_league_id?: string | null;
  roster_positions?: string[] | null;
};

type SleeperUser = {
  user_id: string;
  display_name?: string | null;
  avatar?: string | null;
  metadata?: { team_name?: string | null } | null;
};

type SleeperRoster = {
  roster_id: number;
  owner_id?: string | null;
};

type SleeperMatchup = {
  roster_id: number;
  matchup_id?: number | null;
  points?: number | null;
  custom_points?: number | null;
  players?: string[] | null;
  starters?: string[] | null;
  players_points?: Record<string, number | null> | null;
};

type SleeperPlayer = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
  active?: boolean | null;
  espn_id?: string | number | null;
};

type SleeperDraft = {
  draft_id: string;
  season: string;
  status: string;
  created?: number | null;
};

type SleeperDraftPick = {
  player_id: string;
  roster_id?: string | number | null;
  round: number;
  pick_no: number;
  is_keeper?: boolean | null;
  metadata?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
    team?: string | null;
  } | null;
};

type SleeperTransaction = {
  transaction_id: string;
  type: string;
  status: string;
  status_updated?: number | null;
  created?: number | null;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
};

type SeasonEntrySyncResult = {
  entryCount: number;
  entriesCreated: number;
  entriesUpdated: number;
  membershipsLinked: number;
  unresolvedOwners: number;
};

type WeekSyncResult = {
  weekNumber: number;
  matchupCount: number;
  matchupsCreated: number;
  matchupsUpdated: number;
  participantsCreated: number;
  playersCreated: number;
  lineupEntriesCreated: number;
  lineupEntriesUpdated: number;
  staleLineupEntriesRemoved: number;
};

type PlayerCatalogSyncResult = {
  status: "fresh" | "updated";
  recordCount: number;
};

type DraftSyncResult = {
  pickCount: number;
  picksCreated: number;
  picksUpdated: number;
  playersCreated: number;
};

type TransactionSyncResult = {
  weekNumber: number;
  transactionCount: number;
  transactionsCreated: number;
  transactionsUpdated: number;
  movementsCreated: number;
};

const weekStateValidator = v.union(
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("final"),
);

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sleeper returned HTTP ${response.status}.`);
  return (await response.json()) as T;
};

const contentHash = async (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const requiredLeagueId = (value?: string) => {
  const externalLeagueId = value ?? process.env.SLEEPER_LEAGUE_ID;
  if (!externalLeagueId) throw new Error("A Sleeper league ID is required.");
  return externalLeagueId;
};

const resultFor = (score: number, opponentScore: number, final: boolean) => {
  if (!final) return "pending" as const;
  if (score > opponentScore) return "win" as const;
  if (score < opponentScore) return "loss" as const;
  return "tie" as const;
};

const playerName = (externalPlayerId: string, player?: SleeperPlayer) =>
  player?.full_name?.trim() ||
  [player?.first_name, player?.last_name].filter(Boolean).join(" ").trim() ||
  `Sleeper Player ${externalPlayerId}`;

export const probe = internalAction({
  args: { externalLeagueId: v.string() },
  handler: async (_ctx, args) => {
    const base = `https://api.sleeper.app/v1/league/${args.externalLeagueId}`;
    const [league, users, rosters] = await Promise.all([
      getJson<SleeperLeague>(base),
      getJson<SleeperUser[]>(`${base}/users`),
      getJson<SleeperRoster[]>(`${base}/rosters`),
    ]);
    return {
      season: Number.parseInt(league.season, 10),
      userCount: users.length,
      rosterCount: rosters.length,
      previousLeagueId: league.previous_league_id ?? null,
    };
  },
});

export const syncSeasonEntries = internalAction({
  args: {
    seasonYear: v.number(),
    externalLeagueId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SeasonEntrySyncResult> => {
    const externalLeagueId = requiredLeagueId(args.externalLeagueId);
    const base = `https://api.sleeper.app/v1/league/${externalLeagueId}`;
    const [league, users, rosters] = await Promise.all([
      getJson<SleeperLeague>(base),
      getJson<SleeperUser[]>(`${base}/users`),
      getJson<SleeperRoster[]>(`${base}/rosters`),
    ]);
    if (Number.parseInt(league.season, 10) !== args.seasonYear) {
      throw new Error(
        `Sleeper league season ${league.season} does not match ${args.seasonYear}.`,
      );
    }
    await ctx.runMutation(internal.bootstrap.attachSleeperLeague, {
      externalLeagueId,
      ...(league.previous_league_id
        ? { previousExternalLeagueId: league.previous_league_id }
        : {}),
    });
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      { seasonYear: args.seasonYear, provider: "sleeper", scope: "season_entries" },
    );
    try {
      const userById = new Map(users.map((user) => [user.user_id, user]));
      const entries = rosters.map((roster) => {
        const user = roster.owner_id ? userById.get(roster.owner_id) : undefined;
        const displayName =
          user?.metadata?.team_name?.trim() ||
          user?.display_name?.trim() ||
          `Sleeper Roster ${roster.roster_id}`;
        return {
          externalRosterId: String(roster.roster_id),
          ...(roster.owner_id ? { externalOwnerId: roster.owner_id } : {}),
          displayName,
          ...(user?.avatar
            ? { avatarUrl: `https://sleepercdn.com/avatars/${user.avatar}` }
            : {}),
        };
      });
      return await ctx.runMutation(
        internal.ingestion.upsertSleeperSeasonEntries,
        {
          syncRunId,
          contentHash: await contentHash(entries),
          entries,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Sleeper sync failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

export const syncPlayerCatalog = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<PlayerCatalogSyncResult> => {
    const status = await ctx.runQuery(
      internal.identityManagement.sleeperCatalogStatus,
      {},
    );
    const oneDay = 24 * 60 * 60 * 1_000;
    if (!args.force && status && Date.now() - status.fetchedAt < oneDay) {
      return { status: "fresh", recordCount: status.recordCount };
    }

    const playerCatalog = await getJson<Record<string, SleeperPlayer>>(
      "https://api.sleeper.app/v1/players/nfl",
    );
    const fetchedAt = Date.now();
    const players = Object.entries(playerCatalog).map(
      ([externalPlayerId, player]) => ({
        externalPlayerId,
        fullName: playerName(externalPlayerId, player),
        ...(player.position ? { position: player.position } : {}),
        ...(player.team ? { nflTeam: player.team } : {}),
        ...(typeof player.active === "boolean" ? { active: player.active } : {}),
        ...(player.espn_id != null && String(player.espn_id).length > 0
          ? { espnPlayerId: String(player.espn_id) }
          : {}),
      }),
    );
    const chunkSize = 250;
    for (let index = 0; index < players.length; index += chunkSize) {
      await ctx.runMutation(internal.ingestion.upsertSleeperPlayerCatalogChunk, {
        updatedAt: fetchedAt,
        players: players.slice(index, index + chunkSize),
      });
    }
    await ctx.runMutation(internal.ingestion.completeSleeperPlayerCatalog, {
      fetchedAt,
      contentHash: await contentHash(playerCatalog),
      recordCount: players.length,
    });
    return { status: "updated", recordCount: players.length };
  },
});

export const syncDraft = internalAction({
  args: {
    seasonYear: v.number(),
    externalLeagueId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DraftSyncResult> => {
    const externalLeagueId = requiredLeagueId(args.externalLeagueId);
    const base = `https://api.sleeper.app/v1/league/${externalLeagueId}`;
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "sleeper",
        scope: "draft",
      },
    );
    try {
      const [league, drafts] = await Promise.all([
        getJson<SleeperLeague>(base),
        getJson<SleeperDraft[]>(`${base}/drafts`),
      ]);
      const draft = drafts
        .filter(
          (candidate) =>
            Number.parseInt(candidate.season, 10) === args.seasonYear &&
            candidate.status === "complete",
        )
        .sort((left, right) => (right.created ?? 0) - (left.created ?? 0))[0];
      const draftId = draft?.draft_id ?? league.draft_id;
      if (!draftId || draft?.status !== "complete") {
        await ctx.runMutation(internal.ingestion.skipSyncRun, {
          syncRunId,
          reason: `Sleeper does not have a completed ${args.seasonYear} draft.`,
        });
        return {
          pickCount: 0,
          picksCreated: 0,
          picksUpdated: 0,
          playersCreated: 0,
        };
      }
      const rawPicks = await getJson<SleeperDraftPick[]>(
        `https://api.sleeper.app/v1/draft/${draftId}/picks`,
      );
      const relevantPlayerIds = rawPicks.map((pick) => pick.player_id);
      await ctx.runAction(internal.providers.sleeper.syncPlayerCatalog, {});
      const catalogPlayers = await ctx.runQuery(
        internal.identityManagement.sleeperCatalogPlayers,
        { externalPlayerIds: relevantPlayerIds },
      );
      const catalogById = new Map(
        catalogPlayers.map((player) => [player.externalPlayerId, player]),
      );
      const playerInputs = relevantPlayerIds.map((externalPlayerId) => {
        const player = catalogById.get(externalPlayerId);
        return {
          externalPlayerId,
          ...(player?.espnPlayerId
            ? { espnPlayerId: player.espnPlayerId }
            : {}),
          fullName: player?.fullName ?? `Sleeper Player ${externalPlayerId}`,
          ...(player?.position ? { position: player.position } : {}),
          ...(player?.nflTeam ? { nflTeam: player.nflTeam } : {}),
          ...(player?.active !== undefined ? { active: player.active } : {}),
        };
      });
      const crosswalkResult = await ctx.runMutation(
        internal.ingestion.upsertSleeperPlayerCrosswalks,
        { syncRunId, players: playerInputs },
      );
      if (crosswalkResult.conflicts > 0) {
        throw new Error(
          `${crosswalkResult.conflicts} Sleeper Player crosswalk conflicts require review.`,
        );
      }
      const picks = rawPicks.flatMap((pick) => {
        if (pick.roster_id == null) return [];
        const catalogPlayer = catalogById.get(pick.player_id);
        const metadataName = [
          pick.metadata?.first_name,
          pick.metadata?.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        return [{
          externalTeamId: String(pick.roster_id),
          externalPlayerId: pick.player_id,
          fullName:
            catalogPlayer?.fullName ||
            metadataName ||
            `Sleeper Player ${pick.player_id}`,
          ...(catalogPlayer?.position || pick.metadata?.position
            ? {
                position:
                  catalogPlayer?.position ?? pick.metadata?.position ?? undefined,
              }
            : {}),
          ...(catalogPlayer?.nflTeam || pick.metadata?.team
            ? {
                nflTeam:
                  catalogPlayer?.nflTeam ?? pick.metadata?.team ?? undefined,
              }
            : {}),
          round: pick.round,
          pickNumber: pick.pick_no,
          ...(typeof pick.is_keeper === "boolean"
            ? { keeper: pick.is_keeper }
            : {}),
        }];
      });
      return await ctx.runMutation(internal.ingestion.upsertDraft, {
        syncRunId,
        contentHash: await contentHash(picks),
        picks,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Sleeper draft failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

export const syncTransactions = internalAction({
  args: {
    seasonYear: v.number(),
    week: v.number(),
    externalLeagueId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<TransactionSyncResult> => {
    const externalLeagueId = requiredLeagueId(args.externalLeagueId);
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "sleeper",
        scope: `transactions:${args.week}`,
      },
    );
    try {
      const rawTransactions = await getJson<SleeperTransaction[]>(
        `https://api.sleeper.app/v1/league/${externalLeagueId}/transactions/${args.week}`,
      );
      const completeTransactions = rawTransactions.filter(
        (transaction) => transaction.status === "complete",
      );
      const relevantPlayerIds = Array.from(
        new Set(
          completeTransactions.flatMap((transaction) => [
            ...Object.keys(transaction.adds ?? {}),
            ...Object.keys(transaction.drops ?? {}),
          ]),
        ),
      );
      if (relevantPlayerIds.length > 0) {
        await ctx.runAction(internal.providers.sleeper.syncPlayerCatalog, {});
        const catalogPlayers = await ctx.runQuery(
          internal.identityManagement.sleeperCatalogPlayers,
          { externalPlayerIds: relevantPlayerIds },
        );
        const catalogById = new Map(
          catalogPlayers.map((player) => [player.externalPlayerId, player]),
        );
        const crosswalkResult = await ctx.runMutation(
          internal.ingestion.upsertSleeperPlayerCrosswalks,
          {
            syncRunId,
            players: relevantPlayerIds.map((externalPlayerId) => {
              const player = catalogById.get(externalPlayerId);
              return {
                externalPlayerId,
                ...(player?.espnPlayerId
                  ? { espnPlayerId: player.espnPlayerId }
                  : {}),
                fullName:
                  player?.fullName ?? `Sleeper Player ${externalPlayerId}`,
                ...(player?.position ? { position: player.position } : {}),
                ...(player?.nflTeam ? { nflTeam: player.nflTeam } : {}),
                ...(player?.active !== undefined
                  ? { active: player.active }
                  : {}),
              };
            }),
          },
        );
        if (crosswalkResult.conflicts > 0) {
          throw new Error(
            `${crosswalkResult.conflicts} Sleeper Player crosswalk conflicts require review.`,
          );
        }
      }
      const kindFor = (type: string) => {
        if (type === "waiver") return "waiver" as const;
        if (type === "free_agent") return "free_agent" as const;
        if (type === "trade") return "trade" as const;
        return "commissioner" as const;
      };
      const transactions = completeTransactions.map((transaction) => ({
        externalTransactionId: transaction.transaction_id,
        kind: kindFor(transaction.type),
        occurredAt:
          transaction.status_updated ?? transaction.created ?? Date.now(),
        movements: [
          ...Object.entries(transaction.adds ?? {}).map(
            ([externalPlayerId, rosterId]) => ({
              externalTeamId: String(rosterId),
              externalPlayerId,
              direction: "add" as const,
            }),
          ),
          ...Object.entries(transaction.drops ?? {}).map(
            ([externalPlayerId, rosterId]) => ({
              externalTeamId: String(rosterId),
              externalPlayerId,
              direction: "drop" as const,
            }),
          ),
        ],
      }));
      return await ctx.runMutation(internal.ingestion.upsertTransactions, {
        syncRunId,
        contentHash: await contentHash(transactions),
        weekNumber: args.week,
        transactions,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Sleeper transaction failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

export const syncWeek = internalAction({
  args: {
    seasonYear: v.number(),
    week: v.number(),
    state: weekStateValidator,
    externalLeagueId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<WeekSyncResult> => {
    const externalLeagueId = requiredLeagueId(args.externalLeagueId);
    const base = `https://api.sleeper.app/v1/league/${externalLeagueId}`;
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "sleeper",
        scope: `week:${args.week}`,
      },
    );

    try {
      const [league, rawMatchups] = await Promise.all([
        getJson<SleeperLeague>(base),
        getJson<SleeperMatchup[]>(`${base}/matchups/${args.week}`),
      ]);
      if (Number.parseInt(league.season, 10) !== args.seasonYear) {
        throw new Error(
          `Sleeper league season ${league.season} does not match ${args.seasonYear}.`,
        );
      }

      const grouped = new Map<string, SleeperMatchup[]>();
      for (const matchup of rawMatchups) {
        if (matchup.matchup_id == null) continue;
        const key = String(matchup.matchup_id);
        const participants = grouped.get(key) ?? [];
        participants.push(matchup);
        grouped.set(key, participants);
      }
      const pairedMatchups = Array.from(grouped.entries()).filter(
        ([, participants]) => participants.length === 2,
      );
      if (pairedMatchups.length === 0) {
        await ctx.runMutation(internal.ingestion.skipSyncRun, {
          syncRunId,
          reason: `Sleeper returned no paired matchups for ${args.seasonYear} Week ${args.week}.`,
        });
        return {
          weekNumber: args.week,
          matchupCount: 0,
          matchupsCreated: 0,
          matchupsUpdated: 0,
          participantsCreated: 0,
          playersCreated: 0,
          lineupEntriesCreated: 0,
          lineupEntriesUpdated: 0,
          staleLineupEntriesRemoved: 0,
        };
      }

      const relevantPlayerIds = new Set(
        pairedMatchups.flatMap(([, participants]) =>
          participants.flatMap((participant) => participant.players ?? []),
        ),
      );
      const cachedPlayers = await ctx.runQuery(
        internal.identityManagement.sleeperPlayersByExternalIds,
        { externalPlayerIds: Array.from(relevantPlayerIds) },
      );
      const playerCatalog: Record<string, SleeperPlayer> = Object.fromEntries(
        cachedPlayers.map((player) => [
          player.externalPlayerId,
          {
            full_name: player.fullName,
            ...(player.espnPlayerId ? { espn_id: player.espnPlayerId } : {}),
            ...(player.position ? { position: player.position } : {}),
            ...(player.nflTeam ? { team: player.nflTeam } : {}),
            ...(player.active !== undefined ? { active: player.active } : {}),
          },
        ]),
      );
      if (cachedPlayers.length !== relevantPlayerIds.size) {
        await ctx.runAction(internal.providers.sleeper.syncPlayerCatalog, {});
        const catalogPlayers = await ctx.runQuery(
          internal.identityManagement.sleeperCatalogPlayers,
          { externalPlayerIds: Array.from(relevantPlayerIds) },
        );
        for (const player of catalogPlayers) {
          playerCatalog[player.externalPlayerId] = {
            full_name: player.fullName,
            ...(player.espnPlayerId ? { espn_id: player.espnPlayerId } : {}),
            ...(player.position ? { position: player.position } : {}),
            ...(player.nflTeam ? { team: player.nflTeam } : {}),
            ...(player.active !== undefined ? { active: player.active } : {}),
          };
        }
      }
      const playerInputs = Array.from(relevantPlayerIds).map(
        (externalPlayerId) => {
          const player = playerCatalog[externalPlayerId];
          return {
            externalPlayerId,
            ...(player?.espn_id != null
              ? { espnPlayerId: String(player.espn_id) }
              : {}),
            fullName: playerName(externalPlayerId, player),
            ...(player?.position ? { position: player.position } : {}),
            ...(player?.team ? { nflTeam: player.team } : {}),
            ...(typeof player?.active === "boolean"
              ? { active: player.active }
              : {}),
          };
        },
      );
      const crosswalkResult = await ctx.runMutation(
        internal.ingestion.upsertSleeperPlayerCrosswalks,
        { syncRunId, players: playerInputs },
      );
      if (crosswalkResult.conflicts > 0) {
        throw new Error(
          `${crosswalkResult.conflicts} Sleeper Player crosswalk conflicts require review.`,
        );
      }

      const starterSlots = (league.roster_positions ?? []).filter(
        (slot) => !["BN", "IR", "TAXI"].includes(slot),
      );
      const final = args.state === "final";
      const matchups = pairedMatchups.map(([externalMatchupId, inputs]) => {
        const sorted = [...inputs].sort(
          (left, right) => left.roster_id - right.roster_id,
        );
        const scores = sorted.map((participant) => {
          const providerScore =
            typeof participant.points === "number" ? participant.points : 0;
          const score =
            typeof participant.custom_points === "number"
              ? participant.custom_points
              : providerScore;
          return { score, providerScore };
        });
        return {
          externalMatchupId: `${args.week}:${externalMatchupId}`,
          participants: sorted.map((participant, index) => {
            const starters = participant.starters ?? [];
            const starterIndex = new Map(
              starters.map((externalPlayerId, slotIndex) => [
                externalPlayerId,
                slotIndex,
              ]),
            );
            const roster = (participant.players ?? []).map(
              (externalPlayerId) => {
                const player = playerCatalog[externalPlayerId];
                const indexInStarters = starterIndex.get(externalPlayerId);
                const started = indexInStarters !== undefined;
                return {
                  externalPlayerId,
                  fullName: playerName(externalPlayerId, player),
                  ...(player?.position ? { position: player.position } : {}),
                  ...(player?.team ? { nflTeam: player.team } : {}),
                  rosterSlot: started
                    ? (starterSlots[indexInStarters] ?? player?.position ?? "START")
                    : "BN",
                  started,
                  points:
                    participant.players_points?.[externalPlayerId] ?? 0,
                };
              },
            );
            const opponent = scores[index === 0 ? 1 : 0];
            const own = scores[index];
            return {
              externalTeamId: String(participant.roster_id),
              slot: (index === 0 ? 1 : 2) as 1 | 2,
              score: own.score,
              providerScore: own.providerScore,
              commissionerAdjustment: own.score - own.providerScore,
              result: resultFor(own.score, opponent.score, final),
              roster,
            };
          }),
        };
      });

      return await ctx.runMutation(internal.ingestion.upsertWeek, {
        syncRunId,
        contentHash: await contentHash(matchups),
        weekNumber: args.week,
        state: args.state,
        matchups,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Sleeper sync failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

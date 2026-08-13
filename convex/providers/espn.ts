"use node";

import { v } from "convex/values";
import { createHash } from "node:crypto";
import { Client } from "espn-fantasy-football-api/node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { normalizeEspnSeasonRules } from "../seasonRules";

type EspnTeam = {
  id: number;
  name?: string | null;
  ownerName?: string | null;
  logoURL?: string | null;
};

type EspnMatchup = {
  homeTeamId?: number;
  awayTeamId?: number;
  homeScore?: number;
  awayScore?: number;
  homeRoster?: unknown[];
  awayRoster?: unknown[];
};

type EspnRosterEntry = {
  id: number;
  fullName?: string | null;
  defaultPosition?: string | null;
  eligiblePositions?: unknown[] | null;
  proTeamAbbreviation?: string | null;
  rosteredPosition?: string | null;
  totalPoints?: number | null;
};

type EspnDraftPick = {
  id: number;
  teamId: number;
  fullName?: string | null;
  defaultPosition?: string | null;
  eligiblePositions?: unknown[] | null;
  proTeamAbbreviation?: string | null;
  roundNumber?: number | null;
  overallPickNumber?: number | null;
  isKeeper?: boolean | null;
};

type EspnLeagueInfo = {
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

type SeasonEntrySyncResult = {
  teamCount: number;
  membersCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  membershipsCreated: number;
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

type DraftSyncResult = {
  pickCount: number;
  picksCreated: number;
  picksUpdated: number;
  playersCreated: number;
};

type SeasonRulesSyncResult = {
  seasonYear?: number;
  effectiveWeek: number;
  regularSeasonWeeks: number;
  playoffTeamCount: number;
  playoffByeCount: number;
  medianWinEnabled: boolean;
};

const weekStateValidator = v.union(
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("final"),
);

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required Convex environment variable: ${name}`);
  }
  return value;
};

const createClient = () => {
  const externalLeagueId = requiredEnv("ESPN_LEAGUE_ID");
  return new Client({
    leagueId: Number.parseInt(externalLeagueId, 10),
    espnS2: requiredEnv("ESPN_S2"),
    SWID: requiredEnv("ESPN_SWID"),
  });
};

const canonicalPosition = ({
  eligiblePositions,
  defaultPosition,
}: {
  eligiblePositions?: unknown[] | null;
  defaultPosition?: string | null;
}) => {
  const eligible = new Set(
    (Array.isArray(eligiblePositions) ? eligiblePositions : []).filter(
      (position): position is string => typeof position === "string",
    ),
  );
  for (const position of ["QB", "RB", "WR", "TE", "K", "D/ST"]) {
    if (eligible.has(position)) return position;
  }
  if (defaultPosition === "TQB") return "QB";
  return defaultPosition?.trim() || undefined;
};

export const probe = internalAction({
  args: {
    seasonYear: v.number(),
    week: v.number(),
  },
  handler: async (_ctx, args) => {
    const client = createClient();

    const [teamsPayload, matchupsPayload] = await Promise.all([
      client.getTeamsAtWeek({
        seasonId: args.seasonYear,
        scoringPeriodId: args.week,
      }),
      client.getBoxscoreForWeek({
        seasonId: args.seasonYear,
        matchupPeriodId: args.week,
        scoringPeriodId: args.week,
      }),
    ]);

    const teams = Array.isArray(teamsPayload)
      ? (teamsPayload as EspnTeam[])
      : [];
    const matchups = Array.isArray(matchupsPayload)
      ? (matchupsPayload as EspnMatchup[])
      : [];

    const rosterEntryCount = matchups.reduce(
      (total, matchup) =>
        total +
        (Array.isArray(matchup.homeRoster) ? matchup.homeRoster.length : 0) +
        (Array.isArray(matchup.awayRoster) ? matchup.awayRoster.length : 0),
      0,
    );

    return {
      provider: "espn" as const,
      seasonYear: args.seasonYear,
      week: args.week,
      teamCount: teams.length,
      matchupCount: matchups.length,
      participantCount: matchups.length * 2,
      rosterEntryCount,
    };
  },
});

export const syncSeasonRules = internalAction({
  args: { seasonYear: v.number() },
  handler: async (ctx, args): Promise<SeasonRulesSyncResult> => {
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "espn",
        scope: "season_rules",
      },
    );
    try {
      const league = (await createClient().getLeagueInfo({
        seasonId: args.seasonYear,
      })) as EspnLeagueInfo;
      const rules = normalizeEspnSeasonRules(league, {
        // Shreve awards an additional League Median result in its dashboard.
        medianWinEnabled: true,
      });
      const contentHash = createHash("sha256")
        .update(JSON.stringify(rules))
        .digest("hex");
      return await ctx.runMutation(internal.ingestion.upsertSeasonRules, {
        syncRunId,
        contentHash,
        rules,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ESPN rules failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

export const syncSeasonEntries = internalAction({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args): Promise<SeasonEntrySyncResult> => {
    await ctx.runAction(internal.providers.espn.syncSeasonRules, {
      seasonYear: args.seasonYear,
    });
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "espn",
        scope: "season_entries",
      },
    );

    try {
      const client = createClient();
      const payload = await client.getTeamsAtWeek({
        seasonId: args.seasonYear,
        scoringPeriodId: 1,
      });
      const teams = (Array.isArray(payload) ? (payload as EspnTeam[]) : []).map(
        (team) => {
          const ownerName = team.ownerName?.trim() || `ESPN Team ${team.id}`;
          const displayName = team.name?.trim() || `Team ${team.id}`;
          return {
            externalTeamId: String(team.id),
            ownerName,
            displayName,
            ...(team.logoURL ? { avatarUrl: team.logoURL } : {}),
          };
        },
      );

      if (teams.length === 0) {
        throw new Error(`ESPN returned no teams for ${args.seasonYear}.`);
      }

      const contentHash = createHash("sha256")
        .update(JSON.stringify(teams))
        .digest("hex");

      return await ctx.runMutation(
        internal.ingestion.upsertSeasonEntries,
        {
          syncRunId,
          contentHash,
          teams,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ESPN sync failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

const normalizeRoster = (payload: unknown[] | undefined) =>
  (Array.isArray(payload) ? (payload as EspnRosterEntry[]) : []).map(
    (player) => {
      const rosterSlot = player.rosteredPosition?.trim() || "BN";
      const position = canonicalPosition(player);
      return {
        externalPlayerId: String(player.id),
        fullName: player.fullName?.trim() || `ESPN Player ${player.id}`,
        ...(position ? { position } : {}),
        ...(player.proTeamAbbreviation
          ? { nflTeam: player.proTeamAbbreviation }
          : {}),
        rosterSlot,
        started: !["BN", "Bench", "IR"].includes(rosterSlot),
        points:
          typeof player.totalPoints === "number" ? player.totalPoints : 0,
      };
    },
  );

const matchupResult = (score: number, opponentScore: number, final: boolean) => {
  if (!final) return "pending" as const;
  if (score > opponentScore) return "win" as const;
  if (score < opponentScore) return "loss" as const;
  return "tie" as const;
};

export const syncWeek = internalAction({
  args: {
    seasonYear: v.number(),
    week: v.number(),
    state: weekStateValidator,
  },
  handler: async (ctx, args): Promise<WeekSyncResult> => {
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "espn",
        scope: `week:${args.week}`,
      },
    );

    try {
      const client = createClient();
      const payload = await client.getBoxscoreForWeek({
        seasonId: args.seasonYear,
        matchupPeriodId: args.week,
        scoringPeriodId: args.week,
      });
      const final = args.state === "final";
      const matchups = (
        Array.isArray(payload) ? (payload as EspnMatchup[]) : []
      ).flatMap((matchup) => {
        if (
          typeof matchup.homeTeamId !== "number" ||
          typeof matchup.awayTeamId !== "number"
        ) {
          return [];
        }
        const homeScore =
          typeof matchup.homeScore === "number" ? matchup.homeScore : 0;
        const awayScore =
          typeof matchup.awayScore === "number" ? matchup.awayScore : 0;
        const externalTeamIds = [matchup.homeTeamId, matchup.awayTeamId].sort(
          (left, right) => left - right,
        );

        return [{
          externalMatchupId: `${args.week}:${externalTeamIds.join(":")}`,
          participants: [
            {
              externalTeamId: String(matchup.homeTeamId),
              slot: 1 as const,
              score: homeScore,
              result: matchupResult(homeScore, awayScore, final),
              roster: normalizeRoster(matchup.homeRoster),
            },
            {
              externalTeamId: String(matchup.awayTeamId),
              slot: 2 as const,
              score: awayScore,
              result: matchupResult(awayScore, homeScore, final),
              roster: normalizeRoster(matchup.awayRoster),
            },
          ],
        }];
      });

      if (matchups.length === 0) {
        await ctx.runMutation(internal.ingestion.skipSyncRun, {
          syncRunId,
          reason: `ESPN returned no matchups for ${args.seasonYear} Week ${args.week}.`,
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

      const contentHash = createHash("sha256")
        .update(JSON.stringify(matchups))
        .digest("hex");

      return await ctx.runMutation(internal.ingestion.upsertWeek, {
        syncRunId,
        contentHash,
        weekNumber: args.week,
        state: args.state,
        matchups,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ESPN sync failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

export const syncDraft = internalAction({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args): Promise<DraftSyncResult> => {
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "espn",
        scope: "draft",
      },
    );

    try {
      const client = createClient();
      const payload = await client.getDraftInfo({ seasonId: args.seasonYear });
      const picks = (
        Array.isArray(payload) ? (payload as EspnDraftPick[]) : []
      ).flatMap((pick) => {
        if (
          typeof pick.id !== "number" ||
          typeof pick.teamId !== "number" ||
          typeof pick.roundNumber !== "number" ||
          typeof pick.overallPickNumber !== "number"
        ) {
          return [];
        }
        const position = canonicalPosition(pick);
        return [
          {
            externalTeamId: String(pick.teamId),
            externalPlayerId: String(pick.id),
            fullName: pick.fullName?.trim() || `ESPN Player ${pick.id}`,
            ...(position ? { position } : {}),
            ...(pick.proTeamAbbreviation
              ? { nflTeam: pick.proTeamAbbreviation }
              : {}),
            round: pick.roundNumber,
            pickNumber: pick.overallPickNumber,
            ...(typeof pick.isKeeper === "boolean"
              ? { keeper: pick.isKeeper }
              : {}),
          },
        ];
      });

      if (picks.length === 0) {
        await ctx.runMutation(internal.ingestion.skipSyncRun, {
          syncRunId,
          reason: `ESPN returned no draft picks for ${args.seasonYear}.`,
        });
        return {
          pickCount: 0,
          picksCreated: 0,
          picksUpdated: 0,
          playersCreated: 0,
        };
      }

      const contentHash = createHash("sha256")
        .update(JSON.stringify(picks))
        .digest("hex");
      return await ctx.runMutation(internal.ingestion.upsertDraft, {
        syncRunId,
        contentHash,
        picks,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ESPN draft sync failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

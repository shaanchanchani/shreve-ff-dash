import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type NflState = {
  week: number;
  season: string;
  season_type: string;
};

type RefreshPlan = {
  leagueSeasonId: Id<"leagueSeasons">;
  weekStates: Array<{ week: number; state: "scheduled" | "live" | "final" }>;
  seasonEntriesSyncedAt?: number;
  draftCheckedAt?: number;
  transactionWeeks: number[];
};

type RefreshResult =
  | { status: "not_configured" }
  | { status: "offseason"; seasonYear: number; seasonType: string }
  | {
      status: "refreshed";
      seasonYear: number;
      currentWeek: number;
      weeksRefreshed: number[];
      identityCrosswalkComplete: boolean;
    };

export const plan = internalQuery({
  args: {},
  handler: async (ctx): Promise<RefreshPlan> => {
    const seasonYear = Number.parseInt(
      process.env.SLEEPER_SEASON_YEAR ?? "2026",
      10,
    );
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) throw new Error("Canonical Shreve league is missing.");
    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", seasonYear),
      )
      .unique();
    if (!season) throw new Error(`League season ${seasonYear} is missing.`);
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_season_number", (q) =>
        q.eq("leagueSeasonId", season._id),
      )
      .collect();
    const sleeperRuns = await ctx.db
      .query("syncRuns")
      .withIndex("by_provider_started", (q) => q.eq("provider", "sleeper"))
      .order("desc")
      .collect();
    const seasonEntryRun = sleeperRuns.find(
      (run) =>
        run.leagueSeasonId === season._id &&
        run.scope === "season_entries" &&
        run.status === "succeeded",
    );
    const draftRun = sleeperRuns.find(
      (run) =>
        run.leagueSeasonId === season._id &&
        run.scope === "draft" &&
        run.completedAt !== undefined,
    );
    return {
      leagueSeasonId: season._id,
      weekStates: weeks.map((week) => ({
        week: week.number,
        state: week.state,
      })),
      ...(seasonEntryRun?.completedAt
        ? { seasonEntriesSyncedAt: seasonEntryRun.completedAt }
        : {}),
      ...(draftRun?.completedAt ? { draftCheckedAt: draftRun.completedAt } : {}),
      transactionWeeks: sleeperRuns.flatMap((run) => {
        if (
          run.leagueSeasonId !== season._id ||
          run.status !== "succeeded" ||
          !run.scope.startsWith("transactions:")
        ) {
          return [];
        }
        const week = Number.parseInt(run.scope.slice("transactions:".length), 10);
        return Number.isFinite(week) ? [week] : [];
      }),
    };
  },
});

export const sleeper = internalAction({
  args: {},
  handler: async (ctx): Promise<RefreshResult> => {
    const externalLeagueId = process.env.SLEEPER_LEAGUE_ID;
    if (!externalLeagueId) return { status: "not_configured" };

    const stateResponse = await fetch("https://api.sleeper.app/v1/state/nfl");
    if (!stateResponse.ok) {
      throw new Error(`Sleeper NFL state returned HTTP ${stateResponse.status}.`);
    }
    const nflState = (await stateResponse.json()) as NflState;
    const seasonYear = Number.parseInt(
      process.env.SLEEPER_SEASON_YEAR ?? nflState.season,
      10,
    );
    if (Number.parseInt(nflState.season, 10) !== seasonYear) {
      return { status: "offseason", seasonYear, seasonType: nflState.season_type };
    }

    const plan: RefreshPlan = await ctx.runQuery(internal.refresh.plan, {});
    const sixHours = 6 * 60 * 60 * 1_000;
    if (
      !plan.seasonEntriesSyncedAt ||
      Date.now() - plan.seasonEntriesSyncedAt > sixHours
    ) {
      await ctx.runAction(internal.providers.sleeper.syncSeasonEntries, {
        seasonYear,
        externalLeagueId,
      });
    }
    if (!plan.draftCheckedAt || Date.now() - plan.draftCheckedAt > sixHours) {
      await ctx.runAction(internal.providers.sleeper.syncDraft, {
        seasonYear,
        externalLeagueId,
      });
    }
    if (nflState.season_type !== "regular" || nflState.week < 1) {
      return { status: "offseason", seasonYear, seasonType: nflState.season_type };
    }

    const stateByWeek = new Map(
      plan.weekStates.map((week) => [week.week, week.state]),
    );
    const weeksRefreshed: number[] = [];
    const transactionWeeks = new Set(plan.transactionWeeks);
    for (let week = 1; week <= nflState.week; week += 1) {
      if (!(week < nflState.week && stateByWeek.get(week) === "final")) {
        await ctx.runAction(internal.providers.sleeper.syncWeek, {
          seasonYear,
          week,
          state: week < nflState.week ? "final" : "live",
          externalLeagueId,
        });
        weeksRefreshed.push(week);
      }
      if (week === nflState.week || !transactionWeeks.has(week)) {
        await ctx.runAction(internal.providers.sleeper.syncTransactions, {
          seasonYear,
          week,
          externalLeagueId,
        });
      }
    }

    await ctx.runMutation(internal.materialization.dashboard, { seasonYear });
    const crosswalk = await ctx.runQuery(
      internal.identityManagement.sleeperCrosswalk,
      {},
    );
    const identityCrosswalkComplete =
      crosswalk.length > 0 && crosswalk.every((row) => row.linked);
    if (identityCrosswalkComplete) {
      await ctx.runMutation(internal.historyMaterialization.season, {
        seasonYear,
      });
    }
    return {
      status: "refreshed",
      seasonYear,
      currentWeek: nflState.week,
      weeksRefreshed,
      identityCrosswalkComplete,
    };
  },
});

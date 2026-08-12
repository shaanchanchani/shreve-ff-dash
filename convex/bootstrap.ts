import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const SHREVE_SLUG = "shreve";
const ESPN_LEAGUE_ID = "1918224288";

export const shreve = internalMutation({
  args: {},
  handler: async (ctx) => {
    let league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", SHREVE_SLUG))
      .unique();

    if (!league) {
      const leagueId = await ctx.db.insert("leagues", {
        slug: SHREVE_SLUG,
        name: "Shreve Fantasy Football League",
        sport: "nfl",
      });
      league = await ctx.db.get(leagueId);
    }

    if (!league) {
      throw new Error("Failed to create the canonical Shreve league.");
    }

    let espnSeason = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", 2025),
      )
      .unique();

    if (!espnSeason) {
      const seasonId = await ctx.db.insert("leagueSeasons", {
        leagueId: league._id,
        year: 2025,
        status: "complete",
        authoritativeProvider: "espn",
        regularSeasonWeeks: 14,
      });
      espnSeason = await ctx.db.get(seasonId);
    }

    if (!espnSeason) {
      throw new Error("Failed to create the 2025 ESPN season.");
    }

    const espnRef = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q.eq("leagueSeasonId", espnSeason._id).eq("provider", "espn"),
      )
      .unique();

    if (!espnRef) {
      await ctx.db.insert("leagueProviderRefs", {
        leagueSeasonId: espnSeason._id,
        provider: "espn",
        externalLeagueId: ESPN_LEAGUE_ID,
      });
    }

    const historicalEspnSeasonIds = [];
    for (const year of [2022, 2023, 2024]) {
      let historicalSeason = await ctx.db
        .query("leagueSeasons")
        .withIndex("by_league_year", (q) =>
          q.eq("leagueId", league._id).eq("year", year),
        )
        .unique();

      if (!historicalSeason) {
        const seasonId = await ctx.db.insert("leagueSeasons", {
          leagueId: league._id,
          year,
          status: "complete",
          authoritativeProvider: "espn",
          regularSeasonWeeks: 14,
        });
        historicalSeason = await ctx.db.get(seasonId);
      }
      if (!historicalSeason) {
        throw new Error(`Failed to create the ${year} ESPN season.`);
      }

      const historicalProviderRef = await ctx.db
        .query("leagueProviderRefs")
        .withIndex("by_season_provider", (q) =>
          q
            .eq("leagueSeasonId", historicalSeason._id)
            .eq("provider", "espn"),
        )
        .unique();
      if (!historicalProviderRef) {
        await ctx.db.insert("leagueProviderRefs", {
          leagueSeasonId: historicalSeason._id,
          provider: "espn",
          externalLeagueId: ESPN_LEAGUE_ID,
        });
      }
      historicalEspnSeasonIds.push(historicalSeason._id);
    }

    let sleeperSeason = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", 2026),
      )
      .unique();

    if (!sleeperSeason) {
      const seasonId = await ctx.db.insert("leagueSeasons", {
        leagueId: league._id,
        year: 2026,
        status: "planned",
        authoritativeProvider: "sleeper",
        regularSeasonWeeks: 14,
      });
      sleeperSeason = await ctx.db.get(seasonId);
    }

    if (!sleeperSeason) {
      throw new Error("Failed to create the planned 2026 Sleeper season.");
    }

    return {
      leagueId: league._id,
      espnSeasonId: espnSeason._id,
      historicalEspnSeasonIds,
      sleeperSeasonId: sleeperSeason._id,
    };
  },
});

export const attachSleeperLeague = internalMutation({
  args: {
    externalLeagueId: v.string(),
    previousExternalLeagueId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", SHREVE_SLUG))
      .unique();
    if (!league) throw new Error("Canonical Shreve league is missing.");
    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", 2026),
      )
      .unique();
    if (!season) throw new Error("Planned 2026 Sleeper season is missing.");
    const existing = await ctx.db
      .query("leagueProviderRefs")
      .withIndex("by_season_provider", (q) =>
        q.eq("leagueSeasonId", season._id).eq("provider", "sleeper"),
      )
      .unique();
    const values = {
      externalLeagueId: args.externalLeagueId,
      ...(args.previousExternalLeagueId
        ? { previousExternalLeagueId: args.previousExternalLeagueId }
        : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("leagueProviderRefs", {
      leagueSeasonId: season._id,
      provider: "sleeper",
      ...values,
    });
  },
});

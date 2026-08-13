import { v } from "convex/values";
import { query } from "./_generated/server";

export const current = query({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) return null;
    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!season) return null;

    const snapshot = await ctx.db
      .query("dashboardSnapshots")
      .withIndex("by_season_kind", (q) =>
        q.eq("leagueSeasonId", season._id).eq("kind", "prizes"),
      )
      .order("desc")
      .first();
    if (!snapshot) return null;

    return {
      generatedAt: snapshot.generatedAt,
      calculationVersion: snapshot.calculationVersion,
      data: snapshot.payload,
    };
  },
});

export const longestTouchdowns = query({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();
    if (!league) return null;
    const season = await ctx.db
      .query("leagueSeasons")
      .withIndex("by_league_year", (q) =>
        q.eq("leagueId", league._id).eq("year", args.seasonYear),
      )
      .unique();
    if (!season) return null;
    const snapshot = await ctx.db
      .query("dashboardSnapshots")
      .withIndex("by_season_kind", (q) =>
        q
          .eq("leagueSeasonId", season._id)
          .eq("kind", "longest_touchdowns"),
      )
      .order("desc")
      .first();
    if (!snapshot) return null;
    return {
      generatedAt: snapshot.generatedAt,
      calculationVersion: snapshot.calculationVersion,
      data: snapshot.payload,
    };
  },
});

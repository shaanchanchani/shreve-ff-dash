import { query } from "./_generated/server";
import { SCHEMA_VERSION } from "./model";

export const foundation = query({
  args: {},
  handler: async (ctx) => {
    const shreveLeague = await ctx.db
      .query("leagues")
      .withIndex("by_slug", (q) => q.eq("slug", "shreve"))
      .unique();

    return {
      connected: true,
      schemaVersion: SCHEMA_VERSION,
      canonicalLeaguePresent: shreveLeague !== null,
    };
  },
});

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type LongestTouchdownSyncResult = {
  generatedAt: number;
  calculationVersion: number;
};

export const sync = internalAction({
  args: {
    seasonYear: v.number(),
  },
  handler: async (ctx, args): Promise<LongestTouchdownSyncResult> => {
    const syncRunId: Id<"syncRuns"> = await ctx.runMutation(
      internal.ingestion.startSyncRun,
      {
        seasonYear: args.seasonYear,
        provider: "espn",
        scope: "longest_touchdowns",
      },
    );

    try {
      const sourceUrl =
        process.env.LONGEST_TDS_SOURCE_URL ??
        "https://shreve-ff-dash.vercel.app/api/longest-tds";
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Longest-TD source returned HTTP ${response.status}.`);
      }
      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" ||
        payload === null ||
        "error" in payload
      ) {
        throw new Error("Longest-TD source returned an invalid payload.");
      }
      return await ctx.runMutation(internal.materialization.longestTouchdowns, {
        syncRunId,
        payload,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown longest-TD synchronization failure";
      await ctx.runMutation(internal.ingestion.failSyncRun, {
        syncRunId,
        error: message,
      });
      throw error;
    }
  },
});

"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { LeagueHistoryResponse } from "@/types/history";

type HistoryState = {
  data: LeagueHistoryResponse | null;
  error: string | null;
  isLoading: boolean;
};

/** Attaches player media to roster entries, which only the full read carries. */
const withHeadshots = (
  history: LeagueHistoryResponse | null | undefined,
): LeagueHistoryResponse | null => {
  if (!history?.playerMedia) return history ?? null;
  const media = history.playerMedia;
  const decorate = (team: LeagueHistoryResponse["matchups"][number]["home"]) => ({
    ...team,
    roster: (team.roster ?? []).map((player) => ({
      ...player,
      ...(media[String(player.id)]
        ? { headshotURL: media[String(player.id)] }
        : {}),
    })),
  });

  return {
    ...history,
    matchups: history.matchups.map((matchup) => ({
      ...matchup,
      home: decorate(matchup.home),
      away: decorate(matchup.away),
    })),
  };
};

/**
 * Scores, weeks, owners and seasons — everything except roster detail.
 *
 * This is ~325KB against the full read's 2.3MB, and it is all that the volumes,
 * all-time record, record book, head-to-head and playoff bracket need. Only
 * waiver analysis has to look inside a lineup.
 */
export const useLeagueHistorySummary = ({
  enabled = true,
}: { enabled?: boolean } = {}): HistoryState => {
  const snapshot = useQuery(api.history.summary, enabled ? {} : "skip");
  return {
    data: (snapshot as LeagueHistoryResponse | null | undefined) ?? null,
    error: snapshot === null ? "No history is available yet." : null,
    isLoading: enabled && snapshot === undefined,
  };
};

/** The full read, rosters included. Only mount this when lineups are needed. */
export const useLeagueHistory = ({
  enabled = true,
}: { enabled?: boolean } = {}): HistoryState => {
  const snapshot = useQuery(api.history.all, enabled ? {} : "skip");
  const data = useMemo(
    () => withHeadshots(snapshot as LeagueHistoryResponse | null | undefined),
    [snapshot],
  );
  return {
    data,
    error: snapshot === null ? "No history is available yet." : null,
    isLoading: enabled && snapshot === undefined,
  };
};

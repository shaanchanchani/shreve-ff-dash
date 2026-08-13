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

export const useLeagueHistory = (): HistoryState => {
  const snapshot = useQuery(api.history.all);
  const data = useMemo(() => {
    const history = snapshot as LeagueHistoryResponse | null | undefined;
    if (!history?.playerMedia) return history ?? null;
    return {
      ...history,
      matchups: history.matchups.map((matchup) => ({
        ...matchup,
        home: {
          ...matchup.home,
          roster: matchup.home.roster.map((player) => ({
            ...player,
            ...(history.playerMedia?.[String(player.id)]
              ? { headshotURL: history.playerMedia[String(player.id)] }
              : {}),
          })),
        },
        away: {
          ...matchup.away,
          roster: matchup.away.roster.map((player) => ({
            ...player,
            ...(history.playerMedia?.[String(player.id)]
              ? { headshotURL: history.playerMedia[String(player.id)] }
              : {}),
          })),
        },
      })),
    };
  }, [snapshot]);
  return {
    data,
    error: snapshot === null ? "No history snapshot is available." : null,
    isLoading: snapshot === undefined,
  };
};

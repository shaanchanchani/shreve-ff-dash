"use client";

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
  return {
    data: (snapshot as LeagueHistoryResponse | null | undefined) ?? null,
    error: snapshot === null ? "No history snapshot is available." : null,
    isLoading: snapshot === undefined,
  };
};

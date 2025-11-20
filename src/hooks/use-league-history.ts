"use client";

import { useEffect, useState } from "react";
import type { LeagueHistoryResponse } from "@/types/history";

type HistoryState = {
  data: LeagueHistoryResponse | null;
  error: string | null;
  isLoading: boolean;
};

export const useLeagueHistory = (): HistoryState => {
  const [data, setData] = useState<LeagueHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/history", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load history (${response.status})`);
        }

        const payload: LeagueHistoryResponse = await response.json();
        setData(payload);
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          return;
        }
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return { data, error, isLoading };
};

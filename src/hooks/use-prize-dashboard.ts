"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { PrizeData, LongestTDs } from "@/types/prizes";
import { getLongestCards } from "@/lib/prize-calculations";
import { CURRENT_SEASON } from "@/lib/season";

export const usePrizeDashboard = ({
  includeLongest = false,
}: { includeLongest?: boolean } = {}) => {
  const snapshot = useQuery(api.dashboard.current, {
    seasonYear: CURRENT_SEASON,
  });
  const longestSnapshot = useQuery(
    api.dashboard.longestTouchdowns,
    includeLongest ? { seasonYear: CURRENT_SEASON } : "skip",
  );
  const prizeData = (snapshot?.data as PrizeData | undefined) ?? null;
  const longestTDs = (longestSnapshot?.data as LongestTDs | undefined) ?? null;
  const error = snapshot === null ? "This season has not been built yet." : null;
  const isLoadingPrize = snapshot === undefined;
  const isLoadingLongest = includeLongest && longestSnapshot === undefined;

  const longestCards = useMemo(() => getLongestCards(longestTDs), [longestTDs]);

  return {
    prizeData,
    longestCards,
    error,
    isLoadingPrize,
    isLoadingLongest,
    generatedAt: snapshot?.generatedAt ?? null,
    seasonYear: CURRENT_SEASON,
  };
};

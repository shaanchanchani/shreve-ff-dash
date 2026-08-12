"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { PrizeData, LongestTDs } from "@/types/prizes";
import { buildLedger, getLongestCards, getTeamSummaries } from "@/lib/prize-calculations";

const CURRENT_SEASON = Number.parseInt(
  process.env.NEXT_PUBLIC_CURRENT_SEASON ?? "2025",
  10,
);

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
  const longestTDs =
    (longestSnapshot?.data as LongestTDs | undefined) ?? null;
  const error = snapshot === null ? "No dashboard snapshot is available." : null;
  const isLoadingPrize = snapshot === undefined;
  const isLoadingLongest = includeLongest && longestSnapshot === undefined;

  const { teamSummaries } = useMemo(() => {
    if (!prizeData) {
      return { teamSummaries: [] };
    }
    const { ledger, weeklyWeeks } = buildLedger(prizeData);
    return {
      teamSummaries: getTeamSummaries(prizeData, ledger, weeklyWeeks),
    };
  }, [prizeData]);

  const longestCards = useMemo(
    () => getLongestCards(longestTDs),
    [longestTDs],
  );

  return {
    prizeData,
    teamSummaries,
    longestCards,
    error,
    isLoadingPrize,
    isLoadingLongest,
  };
};

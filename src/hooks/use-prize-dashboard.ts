import { useEffect, useMemo, useState } from "react";
import type { PrizeData, LongestTDs } from "@/types/prizes";
import { buildLedger, getLongestCards, getTeamSummaries } from "@/lib/prize-calculations";

const LONGEST_TDS_ENDPOINT =
  process.env.NEXT_PUBLIC_LONGEST_TDS_URL?.trim() || "/api/longest-tds";

export const usePrizeDashboard = () => {
  const [prizeData, setPrizeData] = useState<PrizeData | null>(null);
  const [longestTDs, setLongestTDs] = useState<LongestTDs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPrize, setIsLoadingPrize] = useState(true);
  const [isLoadingLongest, setIsLoadingLongest] = useState(true);

  useEffect(() => {
    const fetchPrizeData = async () => {
      try {
        const response = await fetch("/api/espn-test");
        if (!response.ok) throw new Error("Failed to fetch prize data");
        const payload = await response.json();
        setPrizeData(payload);
      } catch (err) {
        setError("Failed to fetch data: " + (err as Error).message);
      } finally {
        setIsLoadingPrize(false);
      }
    };

    fetchPrizeData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(LONGEST_TDS_ENDPOINT);
        if (response.ok) {
          const payload = await response.json();
          setLongestTDs(payload);
        }
      } catch (err) {
        console.warn("Failed to fetch longest TDs:", err);
      } finally {
        setIsLoadingLongest(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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

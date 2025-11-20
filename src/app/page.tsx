"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { PayoutPictureCard } from "@/components/cards/payout-picture-card";
import {
  LongestTDCandidatesCard,
  SeasonHighScoreCard,
  UnluckyCandidatesCard,
} from "@/components/cards/league-stats-card";
import { WeeklyWinnersSummarySection } from "@/components/cards/weekly-winners-card";
import { SurvivorSummarySection } from "@/components/cards/survivor-pool-card";
import {
  LeagueCardSkeleton,
  PayoutCardSkeleton,
  WeeklySurvivorSkeleton,
} from "@/components/cards/skeletons";
import { basePalette, fontVariableClasses } from "@/lib/theme";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  SURVIVOR_CARD_ID,
  WEEKLY_CARD_ID,
} from "@/lib/dashboard-navigation";

const DASHBOARD_TABS = [
  { id: "overview", label: "Payout Picture" },
  { id: "prizes", label: "Prize Detail" },
] as const;

type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

const CARD_TO_TAB: Record<string, DashboardTabId> = {
  payouts: "overview",
  league: "prizes",
};

CARD_TO_TAB[SURVIVOR_CARD_ID] = "prizes";
CARD_TO_TAB[WEEKLY_CARD_ID] = "prizes";

export default function Home() {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const {
    prizeData,
    teamSummaries,
    longestCards,
    error,
    isLoadingPrize,
    isLoadingLongest,
  } = usePrizeDashboard();

  const overviewContent = useMemo(() => {
    if (isLoadingPrize || !prizeData) {
      return (
        <div className="space-y-10">
          <PayoutCardSkeleton />
        </div>
      );
    }

    return (
      <div className="space-y-10">
        <PayoutPictureCard
          prizeData={prizeData}
          teamSummaries={teamSummaries}
        />
      </div>
    );
  }, [isLoadingPrize, prizeData, teamSummaries]);

  const prizeDetailContent = useMemo(() => {
    if (isLoadingPrize || !prizeData) {
      return (
        <div className="space-y-10">
          <LeagueCardSkeleton />
          <WeeklySurvivorSkeleton />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 max-[360px]:grid-cols-1">
          <SeasonHighScoreCard prizeData={prizeData} className="h-full" />
          <SurvivorSummarySection prizeData={prizeData} className="h-full" />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[360px]:grid-cols-1">
          <UnluckyCandidatesCard prizeData={prizeData} className="h-full" />
          <LongestTDCandidatesCard
            prizeData={prizeData}
            longestCards={longestCards}
            isLoadingLongest={isLoadingLongest}
            className="h-full"
          />
        </div>

        <div className="mx-auto w-full max-w-sm">
          <WeeklyWinnersSummarySection prizeData={prizeData} />
        </div>
      </div>
    );
  }, [isLoadingLongest, isLoadingPrize, longestCards, prizeData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const targetCardId = window.sessionStorage.getItem(
      DASHBOARD_RETURN_CARD_STORAGE_KEY,
    );
    if (!targetCardId) return;

    const tab = CARD_TO_TAB[targetCardId];
    if (tab) {
      setActiveTab(tab);
    }

    window.sessionStorage.removeItem(DASHBOARD_RETURN_CARD_STORAGE_KEY);
  }, []);

  const tabContent =
    activeTab === "overview" ? overviewContent : prizeDetailContent;

  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_#1d0d28,_#050308_65%)] text-[var(--mist)]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(248, 170, 75, 0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(108, 92, 231, 0.35), transparent 50%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(255,255,255,0.03) 0%, transparent 55%)",
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pb-20 pt-4">
          {error && (
            <div className="rounded-2xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-50">
              {error}
            </div>
          )}

          <div className="mx-auto w-full max-w-sm">
            <div className="inline-flex w-full gap-1 rounded-full border border-white/15 bg-black/30 p-1 text-xs uppercase tracking-wide">
              {DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-full px-4 py-2 font-heading transition ${
                    activeTab === tab.id
                      ? "bg-[var(--mist)] text-black shadow"
                      : "text-white/70 hover:text-white"
                  }`}
                  aria-pressed={activeTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {tabContent}
        </div>
      </main>
    </div>
  );
}

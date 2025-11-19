"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { PayoutPictureCard } from "@/components/cards/payout-picture-card";
import { LeagueStatsCard } from "@/components/cards/league-stats-card";
import { WeeklySurvivorCard } from "@/components/cards/weekly-survivor-card";
import {
  LeagueCardSkeleton,
  PayoutCardSkeleton,
  WeeklySurvivorSkeleton,
} from "@/components/cards/skeletons";
import { swipeCardClass } from "@/components/cards/swipe-card";
import { basePalette, fontVariableClasses } from "@/lib/theme";
import { DASHBOARD_RETURN_CARD_STORAGE_KEY } from "@/lib/dashboard-navigation";

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const {
    prizeData,
    teamSummaries,
    longestCards,
    error,
    isLoadingPrize,
    isLoadingLongest,
  } = usePrizeDashboard();

  const cards = useMemo(() => {
    if (prizeData) {
      return [
        {
          id: "payouts",
          node: (
            <PayoutPictureCard
              key="payouts"
              prizeData={prizeData}
              teamSummaries={teamSummaries}
            />
          ),
        },
        {
          id: "league",
          node: (
            <LeagueStatsCard
              key="league"
              prizeData={prizeData}
              longestCards={longestCards}
              isLoadingLongest={isLoadingLongest}
            />
          ),
        },
        {
          id: "weekly-survivor",
          node: (
            <WeeklySurvivorCard key="weekly-survivor" prizeData={prizeData} />
          ),
        },
      ];
    }

    return [
      {
        id: "payouts-skeleton",
        node: <PayoutCardSkeleton key="payouts-skeleton" />,
      },
      {
        id: "league-skeleton",
        node: <LeagueCardSkeleton key="league-skeleton" />,
      },
      {
        id: "weekly-survivor-skeleton",
        node: <WeeklySurvivorSkeleton key="weekly-survivor-skeleton" />,
      },
    ];
  }, [isLoadingLongest, longestCards, prizeData, teamSummaries]);

  const cardCount = cards.length || 1;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = event.currentTarget.scrollLeft;
    const cardWidth = event.currentTarget.scrollWidth / cardCount;
    const newPage = Math.round(scrollLeft / cardWidth);
    setCurrentPage(newPage);
  };

  const scrollToPage = (index: number) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.scrollWidth / cardCount;
    scrollRef.current.scrollTo({
      left: index * cardWidth,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!prizeData) return;
    if (typeof window === "undefined" || !scrollRef.current) return;

    const targetCardId = window.sessionStorage.getItem(
      DASHBOARD_RETURN_CARD_STORAGE_KEY,
    );
    if (!targetCardId) return;

    const targetIndex = cards.findIndex((card) => card.id === targetCardId);
    if (targetIndex === -1) return;

    const container = scrollRef.current;
    window.requestAnimationFrame(() => {
      if (!container) return;
      const cardWidth = container.scrollWidth / cardCount;
      container.scrollTo({ left: targetIndex * cardWidth });
      setCurrentPage(targetIndex);
      window.sessionStorage.removeItem(DASHBOARD_RETURN_CARD_STORAGE_KEY);
    });
  }, [cardCount, cards, prizeData]);

  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#1d0d28,_#050308_65%)] text-[var(--mist)]"
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

        <div className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-5 pb-20 pt-10">
          {error && (
            <div
              className={`${swipeCardClass} border border-red-400/40 bg-red-900/40 text-sm text-red-50`}
            >
              {error}
            </div>
          )}

          <div
            ref={scrollRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-16"
            onScroll={handleScroll}
          >
            {cards.map(({ node }) => node)}
          </div>

          {prizeData && !isLoadingPrize && (
            <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-sm">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => scrollToPage(index)}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    currentPage === index
                      ? "scale-125 bg-[var(--tide)]"
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .swipe-card {
          transition: transform 0.3s ease, border-color 0.3s ease;
          scroll-snap-align: center;
        }
        .swipe-card:active {
          transform: scale(0.98);
          border-color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </div>
  );
}

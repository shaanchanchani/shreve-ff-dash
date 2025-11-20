"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type TouchEvent,
} from "react";
import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { WeeklyWinnersBreakdownContent } from "@/components/cards/weekly-winners-card";
import { WeeklyBreakdownSkeleton } from "@/components/cards/skeletons";
import { basePalette, fontVariableClasses } from "@/lib/theme";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  WEEKLY_CARD_ID,
} from "@/lib/dashboard-navigation";

const SWIPE_START_BOUNDARY = 60;
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VERTICAL_TOLERANCE = 80;

export default function WeeklyBreakdownPage() {
  const router = useRouter();
  const { prizeData, error, isLoadingPrize } = usePrizeDashboard();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      DASHBOARD_RETURN_CARD_STORAGE_KEY,
      WEEKLY_CARD_ID,
    );
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const startedNearEdge = touchStartRef.current.x <= SWIPE_START_BOUNDARY;
    touchStartRef.current = null;

    if (
      startedNearEdge &&
      deltaX > SWIPE_DISTANCE_THRESHOLD &&
      Math.abs(deltaY) < SWIPE_VERTICAL_TOLERANCE
    ) {
      handleBack();
    }
  };

  const cardContent = useMemo(() => {
    if (error) {
      return (
        <div className="rounded-2xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-50">
          {error}
        </div>
      );
    }

    if (isLoadingPrize || !prizeData) {
      return <WeeklyBreakdownSkeleton />;
    }

    return (
      <section className="space-y-4">
        <p className="text-sm uppercase text-white/60">Weekly Winners ($10)</p>
        <WeeklyWinnersBreakdownContent prizeData={prizeData} />
      </section>
    );
  }, [error, isLoadingPrize, prizeData]);

  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-hidden bg-black text-[var(--mist)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <button
          type="button"
          onClick={handleBack}
          className="group fixed left-4 top-4 z-20 inline-flex items-center justify-center rounded-full border border-white/20 bg-black/40 p-2 text-white/80 backdrop-blur transition hover:border-white/40 hover:text-white"
          aria-label="Back to dashboard"
        >
          <span aria-hidden="true" className="text-lg">
            ←
          </span>
        </button>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 pb-20 pt-16">
          {cardContent}
        </div>
      </main>
    </div>
  );
}

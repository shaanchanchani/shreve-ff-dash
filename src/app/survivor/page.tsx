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
import { SurvivorBreakdownContent } from "@/components/cards/survivor-pool-card";
import { SurvivorCardSkeleton } from "@/components/cards/skeletons";
import { swipeCardClass } from "@/components/cards/swipe-card";
import { basePalette, fontVariableClasses } from "@/lib/theme";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  SURVIVOR_CARD_ID,
} from "@/lib/dashboard-navigation";

const SWIPE_START_BOUNDARY = 60;
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VERTICAL_TOLERANCE = 80;

export default function SurvivorBreakdownPage() {
  const router = useRouter();
  const { prizeData, error, isLoadingPrize } = usePrizeDashboard();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      DASHBOARD_RETURN_CARD_STORAGE_KEY,
      SURVIVOR_CARD_ID,
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
        <div
          className={`${swipeCardClass} border border-red-400/40 bg-red-900/40 text-sm text-red-50`}
        >
          {error}
        </div>
      );
    }

    if (isLoadingPrize || !prizeData) {
      return <SurvivorCardSkeleton />;
    }

    return (
      <section className={swipeCardClass}>
        <p className="mb-3 text-sm uppercase text-white/60">
          Survivor Pool ($10)
        </p>
        <SurvivorBreakdownContent prizeData={prizeData} />
      </section>
    );
  }, [error, isLoadingPrize, prizeData]);

  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#1d0d28,_#050308_65%)] text-[var(--mist)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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

        <div className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-5 pb-20 pt-16">
          {cardContent}
        </div>
      </main>
    </div>
  );
}

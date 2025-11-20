"use client";

import { usePrizeDashboard } from "@/hooks/use-prize-dashboard";
import { PlayoffBracket } from "@/components/playoffs/bracket";
import { basePalette, fontVariableClasses } from "@/lib/theme";
import { LeagueCardSkeleton } from "@/components/cards/skeletons";

export default function PlayoffsPage() {
  const { prizeData, isLoadingPrize, error } = usePrizeDashboard();

  return (
    <div className={fontVariableClasses}>
      <main
        style={basePalette}
        className="relative min-h-screen overflow-x-hidden bg-black text-[var(--mist)]"
      >
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pb-20 pt-4">
          {error && (
             <div className="rounded-2xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-50">
               {error}
             </div>
           )}
          
          {isLoadingPrize ? (
             <div className="mt-10">
                <LeagueCardSkeleton />
             </div>
          ) : prizeData?.standings ? (
             <div className="mt-6">
                <PlayoffBracket standings={prizeData.standings} />
             </div>
          ) : (
             <div className="mt-10 text-center text-white/50">
                Unable to load standings.
             </div>
          )}
        </div>
      </main>
    </div>
  );
}

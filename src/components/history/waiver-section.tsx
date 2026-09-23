"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLeagueHistory } from "@/hooks/use-league-history";
import { WaiverImpact } from "@/components/history/waiver-impact";
import { ModuleSkeleton } from "@/components/dashboard/skeletons";
import { Notice } from "@/components/ui/notice";
import { filterByScope, type Scope } from "@/lib/history-model";
import type { AggregatedOwner } from "@/lib/owner-utils";

/**
 * Waiver analysis is the only part of the archive that needs lineup detail, so
 * it owns the expensive read instead of the whole page paying for it. The rest
 * of the page renders from the ~325KB summary; this fetches the full snapshot
 * only when its section approaches the viewport, including after a mobile view
 * change. A hidden Waivers panel never pays for the full lineup read.
 */
export function WaiverSection({
  owners,
  season,
  scope,
  postseasonStarts,
  className,
}: {
  owners: Map<string, AggregatedOwner>;
  season: number | "all";
  scope: Scope;
  postseasonStarts: Map<number, number | null>;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const placeholder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    if (placeholder.current) observer.observe(placeholder.current);
    return () => observer.disconnect();
  }, []);

  const { data, isLoading, error } = useLeagueHistory({ enabled: ready });

  const matchups = useMemo(() => {
    if (!data) return [];
    const bySeason =
      season === "all"
        ? data.matchups
        : data.matchups.filter((matchup) => matchup.seasonId === season);
    return filterByScope(bySeason, scope, postseasonStarts);
  }, [data, season, scope, postseasonStarts]);

  if (error) return <Notice kind="alert" title="Waiver data unavailable">{error}</Notice>;

  if (!ready || isLoading || !data) {
    return (
      <div ref={placeholder}><ModuleSkeleton title="Waiver difference-makers" rows={6} className={className} /></div>
    );
  }

  return <WaiverImpact key={`${season}:${scope}`} matchups={matchups} owners={owners} season={season} className={className} />;
}

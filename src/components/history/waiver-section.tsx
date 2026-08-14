"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeagueHistory } from "@/hooks/use-league-history";
import { WaiverImpact } from "@/components/history/waiver-impact";
import { ModuleSkeleton } from "@/components/dashboard/skeletons";
import { buildWaiverRows, filterByScope, type Scope } from "@/lib/history-model";
import type { AggregatedOwner } from "@/lib/owner-utils";

/**
 * Waiver analysis is the only part of the archive that needs lineup detail, so
 * it owns the expensive read instead of the whole page paying for it. The rest
 * of the page renders from the ~325KB summary; this fetches the full snapshot
 * once the page is interactive.
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
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  const { data, isLoading } = useLeagueHistory({ enabled: ready });

  const rows = useMemo(() => {
    if (!data) return [];
    const bySeason =
      season === "all"
        ? data.matchups
        : data.matchups.filter((matchup) => matchup.seasonId === season);
    return buildWaiverRows(
      owners,
      filterByScope(bySeason, scope, postseasonStarts),
      season,
    );
  }, [data, owners, season, scope, postseasonStarts]);

  if (!ready || isLoading || !data) {
    return (
      <ModuleSkeleton title="Waiver snipes" rows={6} className={className} />
    );
  }

  return <WaiverImpact rows={rows} className={className} />;
}

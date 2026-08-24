"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { LeagueHistoryResponse } from "@/types/history";
import type { PrizeData } from "@/types/prizes";
import { derivePostseasonStart } from "@/lib/history-model";
import { resolvePlayoffBracket } from "@/lib/playoff-bracket";
import { CURRENT_SEASON } from "@/lib/season";
import { qualifiedFromStandings } from "@/lib/standings";

export type ChampionResult = {
  champion: { teamName: string; logoURL?: string };
  runnerUp: { teamName: string; logoURL?: string };
  week: number;
  score: string;
};

const formatFinal = (championScore: number, runnerUpScore: number) =>
  `${championScore.toFixed(2)} — ${runnerUpScore.toFixed(2)}`;

/**
 * Who won the championship.
 *
 * The prizes snapshot now materializes the played bracket, so this is normally a
 * plain field read on data the page already has — no extra request, and no value
 * that changes after first paint.
 *
 * Snapshots built before that field existed fall back to reconstructing the
 * bracket from the history snapshot, which is 2.3MB of rosters this page does not
 * otherwise need. That path is deferred until after paint and reports `pending`
 * so callers can avoid publishing a prize total that is about to change. It
 * disappears once each season has been re-materialized.
 */
export const useChampion = (
  prizeData: PrizeData | null,
): { result: ChampionResult | null; pending: boolean } => {
  const materialized = prizeData?.playoffResult;
  const needsFallback = Boolean(prizeData) && materialized === undefined;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!needsFallback) return;
    const timer = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(timer);
  }, [needsFallback]);

  const snapshot = useQuery(
    api.history.all,
    needsFallback && ready ? {} : "skip",
  );

  return useMemo(() => {
    if (!prizeData) return { result: null, pending: false };

    // Materialized path: the field is present, holding either a result or an
    // explicit null meaning "no bracket has been decided".
    if (materialized !== undefined) {
      if (!materialized?.champion || !materialized.runnerUp) {
        return { result: null, pending: false };
      }
      return {
        result: {
          champion: materialized.champion,
          runnerUp: materialized.runnerUp,
          week: materialized.finalWeek,
          score: formatFinal(
            materialized.championScore,
            materialized.runnerUpScore,
          ),
        },
        pending: false,
      };
    }

    const history = snapshot as LeagueHistoryResponse | null | undefined;
    if (history === undefined) return { result: null, pending: true };
    if (history === null) return { result: null, pending: false };

    const seasonMatchups = history.matchups.filter(
      (matchup) => matchup.seasonId === CURRENT_SEASON,
    );
    if (seasonMatchups.length === 0) return { result: null, pending: false };

    const bracket = resolvePlayoffBracket({
      matchups: seasonMatchups,
      qualified: qualifiedFromStandings(prizeData),
      firstPlayoffWeek:
        derivePostseasonStart(seasonMatchups).get(CURRENT_SEASON) ?? null,
    });
    if (!bracket) return { result: null, pending: false };

    const homeWon = bracket.final.home.score > bracket.final.away.score;
    return {
      result: {
        champion: bracket.champion,
        runnerUp: bracket.runnerUp,
        week: bracket.final.week,
        score: formatFinal(
          homeWon ? bracket.final.home.score : bracket.final.away.score,
          homeWon ? bracket.final.away.score : bracket.final.home.score,
        ),
      },
      pending: false,
    };
  }, [materialized, snapshot, prizeData]);
};

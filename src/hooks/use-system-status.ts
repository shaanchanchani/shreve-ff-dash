"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { PrizeData } from "@/types/prizes";
import { CURRENT_SEASON } from "@/lib/season";

/**
 * The system state line. It subscribes to the same warm dashboard snapshot the
 * pages read, so it costs no extra round trip — the Convex client shares one
 * subscription per query + args.
 */
export type SystemStatus = {
  phase: "connecting" | "online" | "no-snapshot";
  seasonYear: number;
  generatedAt: number | null;
  calculationVersion: string | null;
  entryCount: number;
  weeksLogged: number;
  regularSeasonWeeks: number;
  /** Whether the season after this one already has a materialized snapshot. */
  nextSeasonOnFile: boolean | null;
};

export const useSystemStatus = (): SystemStatus => {
  const snapshot = useQuery(api.dashboard.current, {
    seasonYear: CURRENT_SEASON,
  });
  const nextSeason = useQuery(api.dashboard.current, {
    seasonYear: CURRENT_SEASON + 1,
  });
  const nextSeasonOnFile = nextSeason === undefined ? null : nextSeason !== null;

  return useMemo(() => {
    if (snapshot === undefined) {
      return {
        phase: "connecting" as const,
        seasonYear: CURRENT_SEASON,
        generatedAt: null,
        calculationVersion: null,
        entryCount: 0,
        weeksLogged: 0,
        regularSeasonWeeks: 0,
        nextSeasonOnFile,
      };
    }
    if (snapshot === null) {
      return {
        phase: "no-snapshot" as const,
        seasonYear: CURRENT_SEASON,
        generatedAt: null,
        calculationVersion: null,
        entryCount: 0,
        weeksLogged: 0,
        regularSeasonWeeks: 0,
        nextSeasonOnFile,
      };
    }

    const data = snapshot.data as PrizeData;
    return {
      phase: "online" as const,
      seasonYear: CURRENT_SEASON,
      generatedAt: snapshot.generatedAt ?? null,
      calculationVersion: snapshot.calculationVersion
        ? String(snapshot.calculationVersion)
        : null,
      entryCount: data.standings?.length ?? 0,
      weeksLogged: data.weeklyHighScores?.length ?? 0,
      regularSeasonWeeks: data.rules?.regularSeasonWeeks ?? 0,
      nextSeasonOnFile,
    };
  }, [snapshot, nextSeasonOnFile]);
};

/**
 * Relative sync age, resolved after mount so the server and client agree on
 * first paint. Returns null until the clock is available.
 */
export const useRelativeAge = (timestamp: number | null) => {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialTimer = window.setTimeout(updateNow, 0);
    const refreshTimer = window.setInterval(updateNow, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  if (!timestamp || now === null) return null;

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${String(seconds).padStart(2, "0")}S`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}H`;
  return `${Math.round(hours / 24)}D`;
};

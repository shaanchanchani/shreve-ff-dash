"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeagueHistory } from "@/hooks/use-league-history";
import { HeadToHeadWidget } from "@/components/history/head-to-head-widget";
import {
  WinLossLeaderboard,
  type LedgerOwnerRow,
} from "@/components/history/win-loss-leaderboard";
import type { HistoricalMatchup, OwnerSummary } from "@/types/history";
import { cn } from "@/lib/utils";

const HISTORY_TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "rivalries", label: "H2H" },
] as const;

type HistoryTabId = (typeof HISTORY_TABS)[number]["id"];
type SeasonFilter = "all" | number;

const MANUAL_OWNER_GROUPS = [
  {
    aliasKey: "joon-kim",
    displayName: "Joon Kim",
    ownerNames: ["녑비 주", "Joon Kim"],
    teamNames: ["Team R Kelly", "Team kenneth carson"],
  },
] as const;

export function HistoryWidgets() {
  const { data, error, isLoading } = useLeagueHistory();
  const [activeTab, setActiveTab] = useState<HistoryTabId>("ledger");
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");

  useEffect(() => {
    if (!data) return;
    const seasonIds = data.seasons.map((season) => season.seasonId);
    if (
      seasonFilter !== "all" &&
      seasonIds.length > 0 &&
      !seasonIds.includes(seasonFilter)
    ) {
      setSeasonFilter("all");
    }
  }, [data, seasonFilter]);

  const owners = data?.owners;
  const matchups = data?.matchups;
  const seasons = data?.seasons;

  const filteredMatchups = useMemo(() => {
    const baseMatchups = matchups ?? [];
    if (seasonFilter === "all") return baseMatchups;
    return baseMatchups.filter(
      (matchup) => matchup.seasonId === seasonFilter,
    );
  }, [matchups, seasonFilter]);

  const ledgerRows = useMemo(
    () => buildLedgerRows(owners ?? [], filteredMatchups, seasonFilter),
    [owners, filteredMatchups, seasonFilter],
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-900/20 px-4 py-3 text-[0.6rem] uppercase tracking-[0.2em] text-red-100 text-center">
        History offline · {error}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const ledgerContent = (
    <div className="flex flex-col gap-6">
      <HistoryPulse
        seasons={seasons ?? []}
        selectedSeason={seasonFilter}
        onSelectSeason={setSeasonFilter}
      />
      <WinLossLeaderboard owners={ledgerRows} />
    </div>
  );

  const rivalryContent = (
    <div className="flex flex-col gap-6">
      <HistoryPulse
        seasons={seasons ?? []}
        selectedSeason={seasonFilter}
        onSelectSeason={setSeasonFilter}
      />
      <HeadToHeadWidget owners={owners ?? []} matchups={filteredMatchups} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="inline-flex w-full gap-1 rounded-full border border-white/15 bg-black/30 p-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/70">
          {HISTORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 font-heading transition",
                activeTab === tab.id
                  ? "bg-[var(--mist)] text-black shadow-sm"
                  : "text-white/60 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "ledger" ? ledgerContent : rivalryContent}
    </div>
  );
}

const SkeletonCard = () => (
  <div className="card-surface animate-pulse rounded-xl border border-white/5 p-4">
    <div className="h-3 w-20 rounded-full bg-white/10" />
    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className="h-12 rounded-lg bg-white/5" />
      <div className="h-12 rounded-lg bg-white/5" />
      <div className="h-12 rounded-lg bg-white/5" />
    </div>
  </div>
);

type HistoryPulseProps = {
  seasons: Array<{ seasonId: number; hasRosterData: boolean }>;
  selectedSeason: SeasonFilter;
  onSelectSeason: (season: SeasonFilter) => void;
};

const HistoryPulse = ({
  seasons,
  selectedSeason,
  onSelectSeason,
}: HistoryPulseProps) => {
  const scoreboardOnly = seasons.filter((season) => !season.hasRosterData);

  const seasonChips = useMemo(() => {
    const ids = seasons
      .map((season) => season.seasonId)
      .sort((a, b) => b - a);
    return ["all", ...ids] as SeasonFilter[];
  }, [seasons]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {seasonChips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 font-heading text-[0.55rem] uppercase tracking-[0.15em] transition",
              chip === selectedSeason
                ? "border-[var(--mist)] bg-[var(--mist)] text-black"
                : "border-white/10 text-white/60 hover:border-white/20 hover:text-white",
            )}
            onClick={() => onSelectSeason(chip)}
          >
            {chip === "all" ? "All Time" : chip}
          </button>
        ))}
      </div>

      {scoreboardOnly.length > 0 && (
        <p className="text-[0.45rem] uppercase tracking-[0.2em] text-white/30">
          Scores only: {scoreboardOnly.map((season) => season.seasonId).join(", ")} ·
          lineups start 2018
        </p>
      )}
    </section>
  );
};

const buildLedgerRows = (
  owners: OwnerSummary[],
  matchups: HistoricalMatchup[],
  seasonFilter: SeasonFilter,
): LedgerOwnerRow[] => {
  const aggregatedOwners = aggregateOwners(owners);
  const statsMap = new Map<
    string,
    {
      ownerKey: string;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();

  const ensureStats = (ownerKey: string) => {
    if (!statsMap.has(ownerKey)) {
      statsMap.set(ownerKey, {
        ownerKey,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    return statsMap.get(ownerKey)!;
  };

  matchups.forEach((matchup) => {
    const homeKey = canonicalOwnerKey(
      matchup.home.ownerKey,
      matchup.home.ownerName,
      matchup.home.teamName,
    );
    const awayKey = canonicalOwnerKey(
      matchup.away.ownerKey,
      matchup.away.ownerName,
      matchup.away.teamName,
    );

    const home = ensureStats(homeKey);
    const away = ensureStats(awayKey);

    home.pointsFor += matchup.home.score;
    home.pointsAgainst += matchup.away.score;
    away.pointsFor += matchup.away.score;
    away.pointsAgainst += matchup.home.score;

    if (matchup.home.score > matchup.away.score) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.home.score < matchup.away.score) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  });

  aggregatedOwners.forEach((_, ownerKey) => ensureStats(ownerKey));

  const rows: LedgerOwnerRow[] = Array.from(statsMap.values())
    .map((stat) => {
      const meta = aggregatedOwners.get(stat.ownerKey);
      const games = stat.wins + stat.losses + stat.ties;
      const winPct =
        games > 0 ? (stat.wins + 0.5 * stat.ties) / games : 0;

      return {
        ownerKey: stat.ownerKey,
        ownerName: meta?.ownerName ?? "Unknown",
        latestTeamName: meta?.latestTeamName ?? "Team",
        logoURL: selectOwnerLogo(meta, seasonFilter),
        wins: stat.wins,
        losses: stat.losses,
        ties: stat.ties,
        recordLabel: `${stat.wins}-${stat.losses}`,
        winPct,
        games,
        pointsFor: stat.pointsFor,
        pointsPerGame: games ? stat.pointsFor / games : 0,
        seasonsParticipated: meta?.seasonsParticipated ?? 0,
      };
    })
    .filter((row) => seasonFilter === "all" || row.games > 0)
    .sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsPerGame - a.pointsPerGame;
    });

  return rows;
};

const selectOwnerLogo = (
  owner: AggregatedOwner | undefined,
  seasonFilter: SeasonFilter,
) => {
  if (!owner?.logos?.length) return undefined;
  if (seasonFilter !== "all") {
    const match = owner.logos.find(
      (logo) => logo.seasonId === seasonFilter && logo.logoURL,
    );
    if (match?.logoURL) return match.logoURL;
  }
  const sorted = [...owner.logos]
    .filter((logo) => logo.logoURL)
    .sort((a, b) => b.seasonId - a.seasonId);
  return sorted[0]?.logoURL;
};

type AggregatedOwner = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logos: OwnerSummary["logos"];
  seasonsParticipated: number;
};

const aggregateOwners = (owners: OwnerSummary[]) => {
  type InternalMeta = AggregatedOwner & { seasonSet: Set<number> };
  const metaMap = new Map<string, InternalMeta>();

  owners.forEach((owner) => {
    const alias = matchAlias(owner.ownerName, owner.latestTeamName);
    const key = alias?.aliasKey ?? owner.ownerKey;
    const displayName = alias?.displayName ?? owner.ownerName;

    const existing = metaMap.get(key);
    if (!existing) {
      const seasonSet = new Set<number>();
      owner.logos.forEach((logo) => seasonSet.add(logo.seasonId));
      metaMap.set(key, {
        ownerKey: key,
        ownerName: displayName,
        latestTeamName: owner.latestTeamName,
        logos: [...owner.logos],
        seasonsParticipated: seasonSet.size || owner.seasonsParticipated,
        seasonSet,
      });
    } else {
      existing.latestTeamName = owner.latestTeamName;
      owner.logos.forEach((logo) => {
        existing.logos.push(logo);
        existing.seasonSet.add(logo.seasonId);
      });
      existing.ownerName = displayName;
      existing.seasonsParticipated = existing.seasonSet.size;
    }
  });

  const output = new Map<string, AggregatedOwner>();
  metaMap.forEach((meta, key) => {
    output.set(key, {
      ownerKey: key,
      ownerName: meta.ownerName,
      latestTeamName: meta.latestTeamName,
      logos: meta.logos,
      seasonsParticipated: meta.seasonSet.size || meta.seasonsParticipated,
    });
  });

  return output;
};

const matchAlias = (ownerName?: string, teamName?: string) => {
  if (!ownerName && !teamName) return null;
  const normalizedOwner = ownerName?.toLowerCase().trim();
  const normalizedTeam = teamName?.toLowerCase().trim();

  return (
    MANUAL_OWNER_GROUPS.find((group) => {
      const ownerMatch = normalizedOwner
        ? group.ownerNames.some(
            (name) => name.toLowerCase().trim() === normalizedOwner,
          )
        : false;
      const teamMatch = normalizedTeam
        ? group.teamNames.some(
            (name) => name.toLowerCase().trim() === normalizedTeam,
          )
        : false;
      return ownerMatch || teamMatch;
    }) ?? null
  );
};

const canonicalOwnerKey = (
  rawKey: string,
  ownerName?: string,
  teamName?: string,
) => {
  const alias = matchAlias(ownerName, teamName);
  return alias?.aliasKey ?? rawKey;
};

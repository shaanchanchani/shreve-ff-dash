"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLeagueHistorySummary } from "@/hooks/use-league-history";
import { Masthead } from "@/components/shell/masthead";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { Notice } from "@/components/ui/notice";
import { EntryMark } from "@/components/common/entry-mark";
import { FilterChips } from "@/components/history/filter-bar";
import {
  MastheadSkeleton,
  ModuleSkeleton,
} from "@/components/dashboard/skeletons";
import { aggregateOwners } from "@/lib/owner-utils";
import {
  SCOPE_LABEL,
  buildLedger,
  hasPlayed,
  buildRecordBook,
  buildVolumes,
  derivePostseasonStart,
  filterByScope,
  type Scope,
  type Volume,
} from "@/lib/history-model";
import { cn } from "@/lib/utils";

/** The heavy roster-driven modules load on demand, not on first paint. */
const RivalryDossier = dynamic(
  () =>
    import("@/components/history/rivalry-dossier").then(
      (module) => module.RivalryDossier,
    ),
  {
    loading: () => (
      <ModuleSkeleton
        title="Head to head"
        rows={5}
        className="lg:col-span-12"
      />
    ),
  },
);

const WaiverSection = dynamic(
  () =>
    import("@/components/history/waiver-section").then(
      (module) => module.WaiverSection,
    ),
  {
    loading: () => (
      <ModuleSkeleton
        title="Waiver snipes"
        rows={6}
        className="lg:col-span-12"
      />
    ),
  },
);

type SeasonFilter = "all" | number;

export function Archive() {
  const { data, error, isLoading } = useLeagueHistorySummary();
  const [season, setSeason] = useState<SeasonFilter>("all");
  const [scope, setScope] = useState<Scope>("all");

  const postseasonStarts = useMemo(
    () => derivePostseasonStart(data?.matchups ?? []),
    [data?.matchups],
  );

  const owners = useMemo(
    () => aggregateOwners(data?.owners ?? []),
    [data?.owners],
  );

  const scopedMatchups = useMemo(() => {
    const base = data?.matchups ?? [];
    const bySeason =
      season === "all"
        ? base
        : base.filter((matchup) => matchup.seasonId === season);
    return filterByScope(bySeason, scope, postseasonStarts);
  }, [data?.matchups, season, scope, postseasonStarts]);

  const volumes = useMemo(
    () =>
      buildVolumes(data?.seasons ?? [], data?.matchups ?? [], postseasonStarts),
    [data?.seasons, data?.matchups, postseasonStarts],
  );

  const ledger = useMemo(
    () => buildLedger(owners, scopedMatchups, season),
    [owners, scopedMatchups, season],
  );

  const records = useMemo(
    () => buildRecordBook(owners, scopedMatchups, postseasonStarts),
    [owners, scopedMatchups, postseasonStarts],
  );

  if (error) {
    return (
      <>
        <Masthead
          eyebrow="All seasons"
          title="History"
          standfirst="History could not be loaded."
        />
        <Notice kind="alert" title="History unavailable">
          {error}
        </Notice>
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <MastheadSkeleton />
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <ModuleSkeleton
            title="Seasons"
            rows={4}
            className="lg:col-span-12"
          />
          <ModuleSkeleton
            title="All-time record"
            rows={8}
            className="lg:col-span-8"
          />
          <ModuleSkeleton
            title="Record book"
            rows={5}
            className="lg:col-span-4"
          />
        </div>
      </>
    );
  }

  const seasonIds = volumes.map((volume) => volume.seasonId);
  const span = seasonIds.length
    ? `${Math.min(...seasonIds)}–${Math.max(...seasonIds)}`
    : "No seasons yet";
  const totalMatchups = data.matchups.filter(hasPlayed).length;

  return (
    <>
      <Masthead
        eyebrow={span}
        status={<Tag variant="neutral">{volumes.length} seasons</Tag>}
        title="History"
        standfirst="Every season the league has played. Owners carry across seasons even when team names don’t."
        facts={[
          { label: "Seasons", value: volumes.length },
          { label: "Owners", value: owners.size },
          { label: "Games", value: totalMatchups },
        ]}
      />

      <div className="module mb-4 flex flex-col gap-3 px-3 py-3 lg:mb-5 lg:flex-row lg:items-center lg:gap-8">
        <FilterChips
          legend="Season"
          options={[
            { value: "all" as SeasonFilter, label: "All time" },
            ...seasonIds.map((id) => ({
              value: id as SeasonFilter,
              label: String(id),
            })),
          ]}
          selected={season}
          onSelect={setSeason}
        />
        <FilterChips
          legend="Scope"
          options={(["all", "regular", "postseason"] as Scope[]).map(
            (value) => ({ value, label: SCOPE_LABEL[value] }),
          )}
          selected={scope}
          onSelect={setScope}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <Module
          title="Seasons"
          qualifier="Tap to filter"
          className="lg:col-span-12"
          note="Playoff weeks are detected where the schedule stops running a full slate of games."
        >
          <ul className="grid divide-y divide-rule border-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {volumes.map((volume, index) => (
              <li
                key={volume.seasonId}
                className={cn(
                  "sm:border-l sm:border-rule",
                  index % 2 === 0 && "sm:border-l-0",
                  "lg:border-l lg:first:border-l-0",
                )}
              >
                <VolumeCard
                  volume={volume}
                  active={season === volume.seasonId}
                  onSelect={() =>
                    setSeason((current) =>
                      current === volume.seasonId ? "all" : volume.seasonId,
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </Module>

        <Module
          title="All-time record"
          qualifier={SCOPE_LABEL[scope]}
          featured
          className="lg:col-span-8"
          status={
            <Tag variant="neutral">
              {season === "all" ? "All time" : season}
            </Tag>
          }
          note="Ordered by win percentage, then wins, then scoring rate. The second line is the owner’s most recent team name."
        >
          {ledger.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-2">
              No games for these filters.
            </p>
          ) : (
            <div className="overflow-x-auto scroll-rail">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Owners ranked by win percentage.
                </caption>
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className="meta w-8 px-2 py-2 text-ink-3">
                      #
                    </th>
                    <th scope="col" className="meta px-2 py-2 text-ink-3">
                      Owner
                    </th>
                    <th
                      scope="col"
                      className="meta px-2 py-2 text-right text-ink-3"
                    >
                      Record
                    </th>
                    <th
                      scope="col"
                      className="meta px-2 py-2 text-right text-ink-3"
                    >
                      Win %
                    </th>
                    <th
                      scope="col"
                      className="meta hidden px-2 py-2 text-right text-ink-3 sm:table-cell"
                    >
                      Pts / game
                    </th>
                    <th
                      scope="col"
                      className="meta hidden px-2 py-2 text-right text-ink-3 lg:table-cell"
                    >
                      Seasons
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row, index) => (
                    <tr
                      key={row.ownerKey}
                      className="border-b border-rule-2 last:border-b-0 hover:bg-paper-2"
                    >
                      <td className="num px-2 py-2 text-xs text-ink-3">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="cell-tight px-2 py-2">
                        <div className="flex items-center gap-2">
                          <EntryMark
                            logoURL={row.logoURL}
                            label={row.ownerName}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8125rem] font-medium leading-tight">
                              {row.ownerName}
                            </span>
                            <span className="meta text-ink-3">
                              {row.latestTeamName}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="num px-2 py-2 text-right text-[0.9375rem]">
                        {row.wins}-{row.losses}
                        {row.ties ? `-${row.ties}` : ""}
                      </td>
                      <td className="num px-2 py-2 text-right text-[0.9375rem] font-medium">
                        {row.winPct.toFixed(3).replace(/^0/, "")}
                      </td>
                      <td className="num hidden px-2 py-2 text-right text-[0.8125rem] text-ink-2 sm:table-cell">
                        {row.pointsPerGame.toFixed(1)}
                      </td>
                      <td className="num hidden px-2 py-2 text-right text-[0.8125rem] text-ink-2 lg:table-cell">
                        {row.seasonsParticipated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Module>

        <Module
          title="Record book"
          qualifier={SCOPE_LABEL[scope]}
          className="lg:col-span-4"
          note="Pulled from every game in the current filters."
        >
          {records.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-2">
              No records for these filters.
            </p>
          ) : (
            <ul className="divide-y divide-rule-2">
              {records.map((record) => (
                <li key={record.id} className="px-3 py-3">
                  <p className="meta text-ink-3">{record.label}</p>
                  <p className="num mt-1 flex items-baseline gap-1.5 text-[1.75rem] font-medium leading-none">
                    {record.value}
                    {record.unit ? (
                      <span className="meta text-ink-3">{record.unit}</span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 truncate text-[0.8125rem] font-medium">
                    {record.holder}
                  </p>
                  <p className="meta mt-0.5 text-ink-3">{record.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Module>

        <RivalryDossier
          owners={owners}
          matchups={scopedMatchups}
          postseasonStarts={postseasonStarts}
          logoSeason={season}
          className="lg:col-span-12"
        />

        <WaiverSection
          owners={owners}
          season={season}
          scope={scope}
          postseasonStarts={postseasonStarts}
          className="lg:col-span-12"
        />
      </div>
    </>
  );
}

function VolumeCard({
  volume,
  active,
  onSelect,
}: {
  volume: Volume;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-4 text-left transition-colors",
        active ? "bg-ink text-paper" : "hover:bg-paper-2",
      )}
    >
      <span
        className={cn(
          "display shrink-0 text-[2.75rem] leading-[0.8]",
          active ? "text-paper" : "text-ink",
        )}
      >
        {String(volume.index).padStart(2, "0")}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "meta block",
            active ? "text-paper/70" : "text-ink-3",
          )}
        >
          Season
        </span>
        <span className="num block text-[1.125rem] font-medium leading-tight">
          {volume.seasonId}
        </span>
        <span
          className={cn(
            "meta mt-1 block",
            active ? "text-paper/70" : "text-ink-3",
          )}
        >
          {volume.entries} teams · {volume.matchups} games
        </span>
        <span
          className={cn(
            "meta mt-0.5 block",
            active ? "text-paper/70" : "text-ink-3",
          )}
        >
          {volume.hasRosterData ? "Lineups" : "Scores only"}
          {volume.postseasonStart
            ? ` · playoffs from W${volume.postseasonStart}`
            : ""}
        </span>
      </span>
    </button>
  );
}

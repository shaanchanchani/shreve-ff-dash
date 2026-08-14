"use client";

import { useMemo, useState } from "react";
import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import type { HistoricalMatchup } from "@/types/history";
import type { AggregatedOwner } from "@/lib/owner-utils";
import { buildSeries, selectLogo } from "@/lib/history-model";
import { cn } from "@/lib/utils";

const ALL_OPPONENTS = "__all__";

/**
 * Two owners set against each other, with every meeting listed and labelled
 * regular season or playoffs. Owners are the identity — team names change.
 */
export function RivalryDossier({
  owners,
  matchups,
  postseasonStarts,
  logoSeason,
  className,
}: {
  owners: Map<string, AggregatedOwner>;
  matchups: HistoricalMatchup[];
  postseasonStarts: Map<number, number | null>;
  logoSeason: number | "all";
  className?: string;
}) {
  const roster = useMemo(
    () =>
      Array.from(owners.values()).sort((left, right) =>
        left.ownerName.localeCompare(right.ownerName),
      ),
    [owners],
  );

  const [primary, setPrimary] = useState<string>(
    () => roster[0]?.ownerKey ?? "",
  );
  const [opponent, setOpponent] = useState<string>(ALL_OPPONENTS);

  const series = useMemo(
    () =>
      primary
        ? buildSeries(
            owners,
            matchups,
            primary,
            opponent === ALL_OPPONENTS ? "all" : opponent,
            postseasonStarts,
          )
        : null,
    [owners, matchups, primary, opponent, postseasonStarts],
  );

  const primaryOwner = owners.get(primary);
  const opponentOwner =
    opponent === ALL_OPPONENTS ? undefined : owners.get(opponent);

  return (
    <Module
      title="Head to head"
      qualifier="Owner vs owner"
      className={className}
      status={
        series ? (
          <Tag variant="neutral">
            {series.games} {series.games === 1 ? "meeting" : "meetings"}
          </Tag>
        ) : undefined
      }
      note="Every meeting inside the current filters."
    >
      <div className="grid gap-3 border-b border-rule px-3 py-3 sm:grid-cols-2">
        <Selector
          id="rivalry-primary"
          label="Owner"
          value={primary}
          onChange={setPrimary}
          options={roster.map((owner) => ({
            value: owner.ownerKey,
            label: owner.ownerName,
            disabled: owner.ownerKey === opponent,
          }))}
        />
        <Selector
          id="rivalry-opponent"
          label="Opponent"
          value={opponent}
          onChange={setOpponent}
          options={[
            { value: ALL_OPPONENTS, label: "All opponents" },
            ...roster.map((owner) => ({
              value: owner.ownerKey,
              label: owner.ownerName,
              disabled: owner.ownerKey === primary,
            })),
          ]}
        />
      </div>

      {series && series.games > 0 && primaryOwner ? (
        <>
          <div className="grid divide-y divide-rule border-b border-rule sm:grid-cols-[1fr_auto_1fr] sm:divide-x sm:divide-y-0">
            <Dossier
              owner={primaryOwner}
              logoSeason={logoSeason}
              record={`${series.wins}-${series.losses}${series.ties ? `-${series.ties}` : ""}`}
              average={series.pointsFor / series.games}
              align="left"
            />
            <div className="flex items-center justify-center px-3 py-2">
              <span className="meta text-ink-3">versus</span>
            </div>
            {opponentOwner ? (
              <Dossier
                owner={opponentOwner}
                logoSeason={logoSeason}
                record={`${series.losses}-${series.wins}${series.ties ? `-${series.ties}` : ""}`}
                average={series.pointsAgainst / series.games}
                align="right"
              />
            ) : (
              <div className="flex flex-col items-end justify-center gap-1 px-3 py-3 text-right">
                <p className="text-[0.9375rem] font-medium">The field</p>
                <p className="num text-[1.75rem] font-medium leading-none">
                  {(series.pointsAgainst / series.games).toFixed(1)}
                </p>
                <p className="meta text-ink-3">Points allowed per game</p>
              </div>
            )}
          </div>

          <div className="max-h-[22rem] overflow-auto scroll-rail">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Every meeting between these two.
              </caption>
              <thead className="sticky top-0 bg-paper">
                <tr className="border-b border-rule">
                  <th scope="col" className="meta px-3 py-2 text-ink-3">
                    Season
                  </th>
                  <th scope="col" className="meta px-2 py-2 text-ink-3">
                    Opponent
                  </th>
                  <th
                    scope="col"
                    className="meta px-2 py-2 text-right text-ink-3"
                  >
                    Score
                  </th>
                  <th
                    scope="col"
                    className="meta px-3 py-2 text-right text-ink-3"
                  >
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.meetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className="border-b border-rule-2 last:border-b-0 hover:bg-paper-2"
                  >
                    <td className="num px-3 py-2 text-xs text-ink-3">
                      {meeting.seasonId} · W
                      {String(meeting.week).padStart(2, "0")}
                      {meeting.postseason ? (
                        <span className="meta ml-1.5 text-signal-ink">
                          Playoff
                        </span>
                      ) : null}
                    </td>
                    <td className="cell-tight truncate px-2 py-2 text-[0.8125rem]">
                      {meeting.opponentName}
                    </td>
                    <td className="num px-2 py-2 text-right text-[0.8125rem]">
                      <span className="font-medium">
                        {meeting.forScore.toFixed(1)}
                      </span>
                      <span className="text-ink-3"> — </span>
                      <span className="text-ink-2">
                        {meeting.againstScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Tag
                        variant={
                          meeting.tied
                            ? "neutral"
                            : meeting.won
                              ? "settled"
                              : "alert"
                        }
                      >
                        {meeting.tied ? "Tie" : meeting.won ? "Win" : "Loss"}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="px-3 py-8 text-center text-sm text-ink-2">
          These two have not played inside the current filters.
        </p>
      )}
    </Module>
  );
}

function Dossier({
  owner,
  logoSeason,
  record,
  average,
  align,
}: {
  owner: AggregatedOwner;
  logoSeason: number | "all";
  record: string;
  average: number;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-3 py-3",
        align === "right" && "items-end text-right",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          align === "right" && "flex-row-reverse",
        )}
      >
        <EntryMark
          logoURL={selectLogo(owner, logoSeason)}
          label={owner.ownerName}
          size="sm"
        />
        <div className={cn(align === "right" && "text-right")}>
          <p className="text-[0.9375rem] font-medium leading-tight">
            {owner.ownerName}
          </p>
          <p className="meta text-ink-3">{owner.latestTeamName}</p>
        </div>
      </div>
      <p className="num text-[2rem] font-medium leading-none">{record}</p>
      <p className="meta text-ink-3">{average.toFixed(1)} points per game</p>
    </div>
  );
}

function Selector({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="meta block text-ink-3">
        {label}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none border border-ink bg-paper px-2.5 py-2 pr-8 text-[0.8125rem] text-ink"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        >
          ▾
        </span>
      </div>
    </div>
  );
}

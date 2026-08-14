"use client";

import { Module } from "@/components/ui/module";
import { Tag } from "@/components/ui/tag";
import { EntryMark, PlayerMark } from "@/components/common/entry-mark";
import {
  SEASON_PAYOUT,
  UNLUCKY_PAYOUT,
  getTeamLogo,
} from "@/lib/prize-calculations";
import type { LongestCard } from "@/lib/prize-calculations";
import { regularSeasonComplete } from "@/lib/payout-model";
import type { PrizeData } from "@/types/prizes";
import { cn } from "@/lib/utils";

/** The single best week of the season, with the players that produced it. */
export function SeasonHighModule({
  prizeData,
  className,
}: {
  prizeData: PrizeData;
  className?: string;
}) {
  const record = prizeData.seasonHighScore;
  const settled = regularSeasonComplete(prizeData);

  return (
    <Module
      title="Season high"
      qualifier={`$${SEASON_PAYOUT}`}
      className={className}
      status={
        record ? (
          <Tag variant={settled ? "settled" : "open"}>
            {settled ? "Won" : "Leading"}
          </Tag>
        ) : (
          <Tag variant="open">Open</Tag>
        )
      }
      note={
        record
          ? "Best single week by any team in the regular season."
          : undefined
      }
    >
      {record ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-rule px-3 py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="num text-[2.25rem] font-medium leading-none">
                  {record.score.toFixed(2)}
                </p>
                <p className="meta mt-2 text-ink-3">
                  Week {record.week ?? "—"} · Points
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <EntryMark
                  logoURL={record.logoURL}
                  label={record.teamName}
                  size="md"
                />
                <span className="min-w-0 truncate text-right text-[0.8125rem] font-medium">
                  {record.teamName}
                </span>
              </div>
            </div>
          </div>

          {record.topPlayers?.length ? (
            <>
              <p className="meta px-3 pt-2.5 text-ink-3">Top starters</p>
              <ul className="mt-1 divide-y divide-rule-2">
                {record.topPlayers.map((player, index) => (
                  <li
                    key={`${player.name}-${player.position}-${index}`}
                    className="flex items-center gap-2.5 px-3 py-1.5"
                  >
                    <PlayerMark headshotURL={player.headshot} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] leading-tight">
                        {player.name}
                      </span>
                      <span className="meta text-ink-3">
                        {player.position}
                        {player.team ? ` · ${player.team}` : ""}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[0.9375rem] font-medium">
                      {player.points.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="px-3 py-4 text-sm text-ink-2">
              No lineup detail for this week yet.
            </p>
          )}
        </div>
      ) : (
        <p className="px-3 py-6 text-sm text-ink-2">
          No week has been scored yet, so no season high exists.
        </p>
      )}
    </Module>
  );
}

/** Most points conceded. A short, ranked ledger — the leader takes the award. */
export function UnluckyModule({
  prizeData,
  className,
}: {
  prizeData: PrizeData;
  className?: string;
}) {
  const settled = regularSeasonComplete(prizeData);
  const rows = prizeData.unluckyTeams;

  return (
    <Module
      title="Unlucky"
      qualifier={`$${UNLUCKY_PAYOUT}`}
      className={className}
      status={
        rows.length ? (
          <Tag variant={settled ? "settled" : "open"}>
            {settled ? "Won" : "Leading"}
          </Tag>
        ) : (
          <Tag variant="open">Open</Tag>
        )
      }
      note="Most points scored against you in the regular season."
    >
      {rows.length ? (
        <ol className="divide-y divide-rule-2">
          {rows.map((team, index) => (
            <li
              key={team.rank}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5",
                index === 0 && "border-l-2 border-gold",
              )}
            >
              <span className="num w-5 shrink-0 text-xs text-ink-3">
                {team.rank}
              </span>
              <EntryMark
                logoURL={team.logoURL}
                label={team.teamName}
                size="xs"
              />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                {team.teamName}
              </span>
              <span className="num shrink-0 text-[0.9375rem] font-medium">
                {team.pointsAgainst.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-3 py-6 text-sm text-ink-2">
          No points-against data yet.
        </p>
      )}
    </Module>
  );
}

const LONGEST_COPY: Record<string, { title: string; unit: string }> = {
  longest_started_rushing_td: {
    title: "Longest rushing TD",
    unit: "Rush",
  },
  longest_started_receiving_td: {
    title: "Longest receiving TD",
    unit: "Reception",
  },
  longest_started_passing_td: {
    title: "Longest passing TD",
    unit: "Pass",
  },
};

/** One module per record, so the three $15 awards never blur into one. */
export function LongestRecordModule({
  card,
  prizeData,
  amount,
  settled,
  className,
}: {
  card: LongestCard;
  prizeData: PrizeData;
  amount: number;
  settled: boolean;
  className?: string;
}) {
  const copy = LONGEST_COPY[card.key] ?? {
    title: `Longest ${card.label.toLowerCase()} TD`,
    unit: card.label,
  };
  const owner = card.data.fantasy_owner;

  return (
    <Module
      title={copy.title}
      qualifier={`$${amount}`}
      className={className}
      status={
        <Tag variant={settled ? "settled" : "open"}>
          {settled ? "Won" : "Leading"}
        </Tag>
      }
    >
      <div className="flex h-full items-center gap-3 px-3 py-2.5">
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="num text-[2rem] font-medium leading-none">
            {card.data.yards}
          </span>
          <span className="meta text-ink-3">yd</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.875rem] font-medium leading-tight">
            {card.data.player}
          </span>
          <span className="meta text-ink-3">
            {copy.unit} · Week {card.data.week}
          </span>
        </span>

        {owner ? (
          <span className="flex min-w-0 shrink items-center gap-1.5">
            <EntryMark
              logoURL={getTeamLogo(prizeData, owner)}
              label={owner}
              size="xs"
            />
            <span className="min-w-0 truncate text-[0.75rem] text-ink-2">
              {owner}
            </span>
          </span>
        ) : (
          <span className="meta text-ink-3">No team</span>
        )}
      </div>
    </Module>
  );
}

/**
 * The longest-touchdown snapshot is refreshed on its own schedule, so its two
 * non-record states are real and both get a designed treatment.
 */
export function LongestRecordPlaceholder({
  title,
  amount,
  state,
  className,
}: {
  title: string;
  amount: number;
  state: "loading" | "unavailable";
  className?: string;
}) {
  return (
    <Module
      title={title}
      qualifier={`$${amount}`}
      className={className}
      status={
        <Tag variant={state === "loading" ? "open" : "out"}>
          {state === "loading" ? "Loading" : "No record"}
        </Tag>
      }
      note={
        state === "unavailable"
          ? "This one refreshes on its own schedule and isn’t in yet."
          : undefined
      }
    >
      {state === "loading" ? (
        <div className="animate-pulse space-y-3 px-3 py-4" aria-hidden="true">
          <div className="h-9 w-24 bg-paper-3" />
          <div className="h-4 w-32 bg-paper-2" />
          <div className="h-4 w-20 bg-paper-2" />
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center px-3 py-6">
          <p className="text-sm text-ink-2">
            No qualifying touchdown yet.
          </p>
        </div>
      )}
    </Module>
  );
}

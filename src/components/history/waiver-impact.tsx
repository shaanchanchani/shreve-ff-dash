"use client";

import { useState } from "react";
import { Module } from "@/components/ui/module";
import { EntryMark, PlayerMark } from "@/components/common/entry-mark";
import type { WaiverRow } from "@/lib/history-model";
import { cn } from "@/lib/utils";

/** Points squeezed out of the waiver wire by players nobody drafted. */
export function WaiverImpact({
  rows,
  className,
}: {
  rows: WaiverRow[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const leader = Math.max(1, rows[0]?.totalWaiverPoints ?? 0);

  return (
    <Module
      title="Waiver snipes"
      qualifier="Points from undrafted starters"
      className={className}
      note="Undrafted players only, counted in weeks they were started and actually produced."
    >
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-ink-2">
          No lineup data for these filters.
        </p>
      ) : (
        <ul className="divide-y divide-rule-2">
          {rows.map((row, index) => {
            const open = expanded === row.ownerKey;
            return (
              <li key={row.ownerKey}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`waiver-detail-${row.ownerKey}`}
                  onClick={() =>
                    setExpanded((current) =>
                      current === row.ownerKey ? null : row.ownerKey,
                    )
                  }
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper-2"
                >
                  <span className="num w-5 shrink-0 text-xs text-ink-3">
                    {index + 1}
                  </span>
                  <EntryMark
                    logoURL={row.logoURL}
                    label={row.ownerName}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium leading-tight">
                      {row.ownerName}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-1 block h-1.5 bg-paper-3"
                    >
                      <span
                        className="block h-full bg-ink"
                        style={{
                          width: `${Math.max(
                            2,
                            (row.totalWaiverPoints / leader) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[0.9375rem] font-medium leading-none">
                      {row.totalWaiverPoints.toFixed(0)}
                    </span>
                    <span className="meta text-ink-3">
                      {(row.waiverShare * 100).toFixed(1)}% of output
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 text-ink-3 transition-transform",
                      open && "rotate-90",
                    )}
                  >
                    ▸
                  </span>
                </button>

                {open ? (
                  <ul
                    id={`waiver-detail-${row.ownerKey}`}
                    className="border-t border-rule-2 bg-paper-2/60 px-3 py-2"
                  >
                    {row.topPlayers.map((player) => (
                      <li
                        key={player.key}
                        className="flex items-center gap-2.5 py-1.5"
                      >
                        <PlayerMark
                          headshotURL={player.headshotURL}
                          size={24}
                        />
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                          {player.playerName}
                        </span>
                        <span className="meta shrink-0 text-ink-2">
                          {player.seasonId} · {player.weeksStarted} starts
                        </span>
                        <span className="num w-14 shrink-0 text-right text-[0.8125rem] font-medium">
                          {player.points.toFixed(1)}
                        </span>
                      </li>
                    ))}
                    {row.topPlayers.length === 0 ? (
                      <li className="py-2 text-sm text-ink-2">
                        No qualifying pickups here.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Module>
  );
}

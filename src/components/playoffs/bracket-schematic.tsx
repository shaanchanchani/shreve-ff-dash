"use client";

import { EntryMark } from "@/components/common/entry-mark";
import { Tag } from "@/components/ui/tag";
import type { TeamStanding } from "@/types/prizes";
import {
  BRACKET_COLUMN,
  BRACKET_GRID,
  BRACKET_STACK,
  Connector,
  RoundLabel,
  Slot,
  Terminal,
} from "@/components/playoffs/bracket-frame";
import { cn } from "@/lib/utils";

/**
 * Flat bracket: seed blocks, hairline connectors, dashed slots for rounds that
 * have not happened. On narrow screens it collapses into stacked rounds, because
 * comprehension beats geometry on a phone.
 */
export function BracketSchematic({
  seeds,
  byeCount,
  championPrize,
  postseasonWeeks,
}: {
  seeds: TeamStanding[];
  byeCount: number;
  championPrize: number;
  postseasonWeeks: { round1: number; semifinal: number; final: number };
}) {
  const seed = (position: number) => seeds[position - 1];

  // The drawn topology is specifically six teams with two byes. Rather than
  // silently dropping nodes for another shape, say so.
  if (seeds.length !== 6 || byeCount !== 2) {
    return (
      <p className="px-3 py-8 text-center text-sm text-ink-2">
        This bracket has {seeds.length} teams and {byeCount} byes. The diagram
        only draws the six-team, two-bye shape, so the standings below are the
        authority until a bracket is played.
      </p>
    );
  }

  return (
    <div className="px-3 py-4">
      {/* Round labels */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_3rem_1fr_3rem_1fr]">
        <RoundLabel>Round one · Week {postseasonWeeks.round1}</RoundLabel>
        <span />
        <RoundLabel>Semifinals · Week {postseasonWeeks.semifinal}</RoundLabel>
        <span />
        <RoundLabel>Final · Week {postseasonWeeks.final}</RoundLabel>
      </div>

      <div className={cn("mt-2", BRACKET_GRID)}>
        {/* Column 1 — entrants */}
        <div className={BRACKET_COLUMN}>
          <RoundLabel className="lg:hidden">
            Round one · Week {postseasonWeeks.round1}
          </RoundLabel>
          <div className={BRACKET_STACK}>
            <Slot>
              <SeedNode seed={1} entry={seed(1)} bye={byeCount >= 1} />
            </Slot>
            <Slot>
              <MatchNode
                top={{ seed: 4, entry: seed(4) }}
                bottom={{ seed: 5, entry: seed(5) }}
              />
            </Slot>
            <Slot>
              <MatchNode
                top={{ seed: 3, entry: seed(3) }}
                bottom={{ seed: 6, entry: seed(6) }}
              />
            </Slot>
            <Slot>
              <SeedNode seed={2} entry={seed(2)} bye={byeCount >= 2} />
            </Slot>
          </div>
        </div>

        <Connector variant="quarter" />

        {/* Column 2 — semifinals */}
        <div className={BRACKET_COLUMN}>
          <RoundLabel className="lg:hidden">
            Semifinals · Week {postseasonWeeks.semifinal}
          </RoundLabel>
          <div className={BRACKET_STACK}>
            <Slot>
              <PendingNode label="Semifinal" detail="1 vs winner of 4/5" />
            </Slot>
            <Slot>
              <PendingNode label="Semifinal" detail="2 vs winner of 3/6" />
            </Slot>
          </div>
        </div>

        <Connector variant="semi" />

        {/* Column 3 — final */}
        <div className={BRACKET_COLUMN}>
          <RoundLabel className="lg:hidden">
            Final · Week {postseasonWeeks.final}
          </RoundLabel>
          <div className="mt-2 flex h-full flex-col justify-center gap-3 lg:mt-0">
            <PendingNode
              label="Championship"
              detail={`Winner takes $${championPrize}`}
              emphasis
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SeedNode({
  seed,
  entry,
  bye,
}: {
  seed: number;
  entry?: TeamStanding;
  bye: boolean;
}) {
  if (!entry) return null;

  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5 border bg-paper px-2.5 py-2",
        bye ? "border-2 border-ink" : "border-ink",
      )}
    >
      <Terminal />
      <span className="num w-5 shrink-0 text-center text-xs text-ink-3">
        {seed}
      </span>
      <EntryMark logoURL={entry.logoURL} label={entry.teamName} size="xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium leading-tight">
          {entry.teamName}
        </span>
        <span className="num text-[0.6875rem] text-ink-3">
          {entry.wins}-{entry.losses}
          {entry.ties ? `-${entry.ties}` : ""} · {entry.pointsFor.toFixed(1)} PF
        </span>
      </span>
      {bye ? <Tag variant="neutral">Bye</Tag> : null}
    </div>
  );
}

function MatchNode({
  top,
  bottom,
}: {
  top: { seed: number; entry?: TeamStanding };
  bottom: { seed: number; entry?: TeamStanding };
}) {
  if (!top.entry || !bottom.entry) return null;

  return (
    <div className="relative border border-ink bg-paper">
      <Terminal />
      <MatchRow seed={top.seed} entry={top.entry} />
      <div className="border-t border-rule" />
      <MatchRow seed={bottom.seed} entry={bottom.entry} />
    </div>
  );
}

function MatchRow({ seed, entry }: { seed: number; entry: TeamStanding }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      <span className="num w-5 shrink-0 text-center text-xs text-ink-3">
        {seed}
      </span>
      <EntryMark logoURL={entry.logoURL} label={entry.teamName} size="xs" />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-tight">
        {entry.teamName}
      </span>
      <span className="num shrink-0 text-[0.6875rem] text-ink-3">
        {entry.wins}-{entry.losses}
      </span>
    </div>
  );
}

function PendingNode({
  label,
  detail,
  emphasis = false,
}: {
  label: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative border border-dashed px-2.5 py-3",
        emphasis ? "border-2 border-ink bg-paper-2" : "border-ink-3 bg-paper",
      )}
    >
      <p className={cn("meta", emphasis ? "text-ink" : "text-ink-3")}>{label}</p>
      <p className="mt-1 text-[0.8125rem] text-ink-2">{detail}</p>
      <p className="meta mt-2 text-ink-3">Not played yet</p>
    </div>
  );
}

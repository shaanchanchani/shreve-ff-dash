"use client";

import { Module } from "@/components/ui/module";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { EntryMark } from "@/components/common/entry-mark";
import type { TeamStanding } from "@/types/prizes";
import { cn } from "@/lib/utils";

type QualificationState = "bye" | "clinched" | "bubble" | "eliminated";

/** What the bracket actually did, once it has been played. */
export type PlayedState = {
  byes: Set<string>;
  qualified: Set<string>;
};

const STATE_COPY: Record<QualificationState, { label: string; tag: TagVariant }> =
  {
    bye: { label: "Bye", tag: "settled" },
    clinched: { label: "In", tag: "settled" },
    bubble: { label: "Bubble", tag: "open" },
    eliminated: { label: "Out", tag: "out" },
  };

const qualificationState = (
  entry: TeamStanding,
  played: PlayedState | null,
): QualificationState => {
  if (played) {
    if (played.byes.has(entry.teamName)) return "bye";
    return played.qualified.has(entry.teamName) ? "clinched" : "eliminated";
  }
  const odds = entry.playoffOdds ?? 0;
  const byeOdds = entry.byeOdds ?? 0;
  if (byeOdds >= 0.999) return "bye";
  if (odds >= 0.999) return "clinched";
  if (odds <= 0.001) return "eliminated";
  return "bubble";
};

const formatOdds = (value: number | undefined) => {
  const odds = value ?? 0;
  if (odds >= 0.999) return "100%";
  if (odds <= 0.001) return "—";
  return `${Math.round(odds * 100)}%`;
};

export function StandingsTable({
  standings,
  playedState,
  playoffTeams,
  byeCount,
  complete,
  className,
}: {
  standings: TeamStanding[];
  playedState: PlayedState | null;
  playoffTeams: number;
  byeCount: number;
  complete: boolean;
  className?: string;
}) {
  return (
    <Module
      title="Standings"
      qualifier="Regular season"
      className={className}
      status={
        <Tag variant={complete ? "settled" : "open"}>
          {complete ? "Final" : "Live"}
        </Tag>
      }
      note={
        playedState
          ? "Made it and Bye come from the bracket that was actually played. The league does not seed strictly by record then points for, so they will not always match this ordering."
          : "In or out under the current standings — these are not simulated odds."
      }
    >
      <div className="overflow-x-auto scroll-rail">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Regular-season standings with playoff and bye status.
          </caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="meta w-8 px-2 py-1.5 text-ink-3">
                #
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-ink-3">
                Team
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
                Record
              </th>
              <th
                scope="col"
                className="meta hidden px-2 py-1.5 text-right text-ink-3 sm:table-cell"
              >
                Points for
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
                Made it
              </th>
              <th
                scope="col"
                className="meta hidden px-2 py-1.5 text-right text-ink-3 sm:table-cell"
              >
                Bye
              </th>
              <th scope="col" className="meta px-2 py-1.5 text-right text-ink-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, index) => {
              const state = qualificationState(entry, playedState);
              const copy = STATE_COPY[state];
              return (
                <tr
                  key={entry.teamName}
                  className={cn(
                    "border-b border-rule-2 last:border-b-0 hover:bg-paper-2",
                    state === "eliminated" && "text-ink-2",
                  )}
                >
                  <td
                    className={cn(
                      "num px-2 py-1.5 text-xs text-ink-3",
                      index < byeCount && "border-l-2 border-ink",
                      index >= byeCount &&
                        index < playoffTeams &&
                        "border-l-2 border-mist",
                    )}
                  >
                    {index + 1}
                  </td>
                  <td className="cell-tight px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <EntryMark
                        logoURL={entry.logoURL}
                        label={entry.teamName}
                        size="xs"
                        className={cn(state === "eliminated" && "opacity-60")}
                      />
                      <span className="truncate text-[0.8125rem]">
                        {entry.teamName}
                      </span>
                    </div>
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[0.8125rem]">
                    {entry.wins}-{entry.losses}
                    {entry.ties ? `-${entry.ties}` : ""}
                  </td>
                  <td className="num hidden px-2 py-1.5 text-right text-[0.8125rem] text-ink-2 sm:table-cell">
                    {entry.pointsFor.toFixed(1)}
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[1.0625rem] font-medium">
                    {playedState
                      ? playedState.qualified.has(entry.teamName)
                        ? "Yes"
                        : "—"
                      : formatOdds(entry.playoffOdds)}
                  </td>
                  <td className="num hidden px-2 py-1.5 text-right text-[1.0625rem] text-ink-2 sm:table-cell">
                    {playedState
                      ? playedState.byes.has(entry.teamName)
                        ? "Yes"
                        : "—"
                      : formatOdds(entry.byeOdds)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Tag variant={copy.tag}>{copy.label}</Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Module>
  );
}

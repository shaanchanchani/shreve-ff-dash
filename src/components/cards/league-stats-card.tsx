/* eslint-disable @next/next/no-img-element */
import { TeamLogo } from "../common/team-logo";
import { HybridPlayerLogo } from "../common/hybrid-player-logo";
import type { PrizeData } from "@/types/prizes";
import type { LongestCard } from "@/lib/prize-calculations";
import { getTeamLogo } from "@/lib/prize-calculations";
import type { SyntheticEvent } from "react";
import { cn } from "@/lib/utils";

interface LeagueStatsCardProps {
  prizeData: PrizeData;
  longestCards: LongestCard[];
  isLoadingLongest: boolean;
}

interface BaseStatsCardProps {
  prizeData: PrizeData;
  className?: string;
}

interface LongestTDCandidatesCardProps extends BaseStatsCardProps {
  longestCards: LongestCard[];
  isLoadingLongest: boolean;
}

const sectionHeadingClass =
  "font-heading text-[0.6rem] uppercase tracking-[0.2em] text-white leading-tight";

const formatPlayerName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;

  const lastName = parts.pop();
  const firstInitial = parts[0]?.charAt(0) ?? "";
  return `${firstInitial}.${lastName ?? ""}`;
};

export function LeagueStatsCard({
  prizeData,
  longestCards,
  isLoadingLongest,
}: LeagueStatsCardProps) {
  return (
    <section aria-label="League Stats Snapshot" className="grid gap-5">
      <SeasonHighScoreCard prizeData={prizeData} />
      <UnluckyCandidatesCard prizeData={prizeData} />
      <LongestTDCandidatesCard
        prizeData={prizeData}
        longestCards={longestCards}
        isLoadingLongest={isLoadingLongest}
      />
    </section>
  );
}

export function SeasonHighScoreCard({
  prizeData,
  className,
}: BaseStatsCardProps) {
  return (
    <section
      aria-label="Season High Score"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Season high ($25)</p>
      {prizeData.seasonHighScore ? (
        <div className="card-surface overflow-hidden rounded-2xl border border-white/10">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <TeamLogo
                  logoURL={prizeData.seasonHighScore.logoURL}
                  label={prizeData.seasonHighScore.teamName}
                />
                <span className="font-heading text-[0.72rem] uppercase tracking-tight">
                  {prizeData.seasonHighScore.teamName}
                </span>
              </div>
              <div className="flex flex-col items-end text-right">
                <div className="font-heading text-[0.55rem] uppercase text-white/60">
                  Week {prizeData.seasonHighScore.week}
                </div>
                <span className="mt-1 font-field text-[0.85rem] text-[var(--ember)]">
                  {prizeData.seasonHighScore.score.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          {prizeData.seasonHighScore.topPlayers &&
          prizeData.seasonHighScore.topPlayers.length > 0 ? (
            <div className="p-2">
              <div className="space-y-0.5">
                  {prizeData.seasonHighScore.topPlayers.map(
                    (player) => (
                    <div
                      key={`${player.name}-${player.points}`}
                      className="flex items-center justify-between rounded px-2 py-1 text-[0.65rem] hover:bg-white/5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {player.headshot ? (
                          <img
                            src={player.headshot}
                            alt={player.name}
                            className="h-6 w-6 rounded-full bg-transparent object-cover"
                            onError={(event: SyntheticEvent<HTMLImageElement>) => {
                              event.currentTarget.style.display = "none";
                              const fallbackElement =
                                event.currentTarget.nextElementSibling;
                              if (fallbackElement instanceof HTMLElement) {
                                fallbackElement.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="font-heading truncate text-[0.5rem] uppercase tracking-wide text-white">
                            {formatPlayerName(player.name)}
                          </div>
                        </div>
                      </div>
                      <span className="ml-2 font-field text-[0.7rem] text-[var(--ember)]">
                        {player.points.toFixed(1)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-white/50">
              Player details loading...
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/60">No season high score yet.</p>
      )}
    </section>
  );
}

export function UnluckyCandidatesCard({
  prizeData,
  className,
}: BaseStatsCardProps) {
  return (
    <section
      aria-label="Unlucky Candidates"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Unlucky ($10)</p>
        <div className="card-surface overflow-hidden rounded-2xl border border-white/10 text-[0.65rem]">
        <table className="w-full">
          <tbody>
            {prizeData.unluckyTeams.slice(0, 3).map((team, index, array) => (
              <tr
                key={team.rank}
                className={`hover:bg-white/5 ${index < array.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <td className="p-2">
                  <TeamLogo logoURL={team.logoURL} label={team.teamName} />
                </td>
                <td className="p-2">
                  <span className="font-heading block text-[0.5rem] uppercase tracking-wide text-white">
                    {team.teamName}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <span className="font-field text-[0.7rem] text-[var(--violet)]">
                    {team.pointsAgainst.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LongestTDCandidatesCard({
  prizeData,
  longestCards,
  isLoadingLongest,
  className,
}: LongestTDCandidatesCardProps) {
  return (
    <section
      aria-label="Longest Touchdown Candidates"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Longest TDs ($15)</p>
      <div className="card-surface overflow-hidden rounded-2xl border border-white/10 text-[0.6rem]">
        <table className="w-full">
          <tbody>
            {isLoadingLongest ? (
              Array.from({ length: 3 }, (_, index) => (
                <tr
                  key={`skeleton-${index}`}
                  className={`animate-pulse ${index < 2 ? "border-b border-white/5" : ""}`}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3.5 w-20 rounded bg-white/10" />
                        <div className="h-3 w-14 rounded bg-white/10" />
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-5 w-7 rounded bg-white/10" />
                      <div className="h-3.5 w-10 rounded bg-white/10" />
                    </div>
                  </td>
                </tr>
              ))
            ) : longestCards.length > 0 ? (
              longestCards.map((card, index) => (
                <tr
                  key={card.key}
                  className={`hover:bg-white/5 ${index < longestCards.length - 1 ? "border-b border-white/5" : ""}`}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {card.data.fantasy_owner ? (
                        <HybridPlayerLogo
                          teamLogoURL={getTeamLogo(
                            prizeData,
                            card.data.fantasy_owner,
                          )}
                          playerName={card.data.player}
                          teamLabel={card.data.fantasy_owner}
                        />
                      ) : (
                        <TeamLogo label={card.data.player} />
                      )}
                      <div>
                        <span className="font-heading text-[0.5rem] uppercase tracking-wide text-white">
                          {card.data.player}
                        </span>
                        <div className="font-heading text-[0.55rem] uppercase text-white/60">
                          Week {card.data.week}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-field text-[0.7rem] text-[var(--ember)]">
                      {card.data.yards}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-3 text-center text-xs text-white/60" colSpan={2}>
                  No touchdown data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LeagueMedianCard({
  prizeData,
  className,
}: BaseStatsCardProps) {
  if (!prizeData.leagueMedianStats) return null;
  const stats = prizeData.leagueMedianStats;

  return (
    <section
      aria-label="League Median"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Median Correlation</p>
      <div className="card-surface overflow-hidden rounded-2xl border border-white/10 p-4">
        <div className="flex flex-col items-center gap-1">
           <div className="text-[10px] text-white/50 text-center leading-snug uppercase tracking-wide">
              Win Matchup &gt; Score Median
           </div>
           <div className="mt-2 font-field text-3xl text-[var(--neon-green)]">
              {(stats.percentage * 100).toFixed(1)}%
           </div>
           <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">
              {stats.winsAboveMedian} of {stats.totalWins} Wins
           </div>
        </div>
      </div>
    </section>
  );
}

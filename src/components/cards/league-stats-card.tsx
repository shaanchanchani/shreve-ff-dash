/* eslint-disable @next/next/no-img-element */
import { SwipeCard } from "./swipe-card";
import { TeamLogo } from "../common/team-logo";
import { HybridPlayerLogo } from "../common/hybrid-player-logo";
import type { PrizeData } from "@/types/prizes";
import type { LongestCard } from "@/lib/prize-calculations";
import { getTeamLogo } from "@/lib/prize-calculations";
import type { SyntheticEvent } from "react";

interface LeagueStatsCardProps {
  prizeData: PrizeData;
  longestCards: LongestCard[];
  isLoadingLongest: boolean;
}

export function LeagueStatsCard({
  prizeData,
  longestCards,
  isLoadingLongest,
}: LeagueStatsCardProps) {
  return (
    <SwipeCard aria-label="League Stats Snapshot">
      <div>
        <p className="mb-3 text-sm uppercase text-white/60">
          Season High Score ($25)
        </p>
        {prizeData.seasonHighScore ? (
          <div className="overflow-hidden rounded-xl border border-[var(--tide)] bg-[var(--tide)]/10">
            <div className="border-b border-white/10 p-3">
              <div className="flex items-center gap-3">
                <TeamLogo
                  logoURL={prizeData.seasonHighScore.logoURL}
                  label={prizeData.seasonHighScore.teamName}
                />
                <div>
                  <span className="font-heading text-lg uppercase">
                    {prizeData.seasonHighScore.teamName}
                  </span>
                  <div className="text-xs uppercase text-white/50">
                    Week {prizeData.seasonHighScore.week} ·{" "}
                    {Math.round(prizeData.seasonHighScore.score)} pts · $25
                  </div>
                </div>
              </div>
            </div>
            {prizeData.seasonHighScore.topPlayers &&
            prizeData.seasonHighScore.topPlayers.length > 0 ? (
              <div className="p-2">
                <div className="space-y-1">
                  {prizeData.seasonHighScore.topPlayers.map(
                    (player, index) => (
                      <div
                        key={`${player.name}-${player.points}`}
                        className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {player.headshot ? (
                            <img
                              src={player.headshot}
                              alt={player.name}
                              className="h-8 w-8 rounded-full bg-transparent object-cover"
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
                          <span className="font-heading hidden w-4 text-xs text-white/50">
                            #{index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-heading truncate text-sm">
                              {player.name}
                            </div>
                          </div>
                        </div>
                        <span className="ml-2 font-sports text-lg text-[var(--ember)]">
                          {player.points.toFixed(1)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-white/50">
                Player details loading...
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/60">No season high score yet.</p>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm uppercase text-white/60">
          Unlucky Candidates ($10)
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <table className="w-full">
            <tbody>
              {prizeData.unluckyTeams.slice(0, 3).map((team, index, array) => (
                <tr
                  key={team.rank}
                  className={`hover:bg-white/5 ${index < array.length - 1 ? "border-b border-white/5" : ""}`}
                >
                  <td className="p-2">
                    <span className="font-heading text-xs text-white/50">
                      #{team.rank}
                    </span>
                  </td>
                  <td className="p-2">
                    <TeamLogo logoURL={team.logoURL} label={team.teamName} />
                  </td>
                  <td className="p-2">
                    <span className="font-heading text-sm uppercase">
                      {team.teamName}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-sports text-xl text-[var(--violet)]">
                      {team.pointsAgainst.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm uppercase text-white/60">
          Longest TD Candidates ($15)
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
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
                        <div className="h-9 w-9 rounded-full bg-white/10" />
                        <div className="flex-1 space-y-1">
                          <div className="h-4 w-24 rounded bg-white/10" />
                          <div className="h-3 w-16 rounded bg-white/10" />
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="h-6 w-8 rounded bg-white/10" />
                        <div className="h-4 w-12 rounded bg-white/10" />
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
                          <span className="font-heading text-sm uppercase">
                            {card.data.player}
                          </span>
                          <div className="text-xs uppercase text-white/50">
                            Week {card.data.week}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-field text-xl text-[var(--ember)]">
                          {card.data.yards}
                        </span>
                        <span className="font-heading w-16 whitespace-nowrap text-sm text-white/60">
                          {card.label === "Rushing"
                            ? "rush"
                            : card.label === "Receiving"
                              ? "rec"
                              : "pass"}{" "}
                          yds
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-center text-sm text-white/60" colSpan={2}>
                    No touchdown data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SwipeCard>
  );
}

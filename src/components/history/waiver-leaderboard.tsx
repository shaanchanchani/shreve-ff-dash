"use client";

import { TeamLogo } from "@/components/common/team-logo";

export type WaiverPlayerSeason = {
  playerId: number;
  playerName: string;
  seasonId: number;
  points: number;
  weeksStarted: number;
};

export type WaiverOwnerRow = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logoURL?: string;
  totalWaiverPoints: number;
  waiverPointsPerGame: number;
  waiverPctOfTotal: number; // 0-1
  gamesWithRosterData: number;
  topWaiverPlayers: WaiverPlayerSeason[];
};

type Props = {
  owners: WaiverOwnerRow[];
};

const formatPlayerName = (name: string) => {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return `${first[0]}. ${last}`;
};

const getHeadshotURL = (playerId: number) => 
  `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;

export function WaiverLeaderboard({ owners }: Props) {
  const sorted = [...owners]
    .filter((o) => o.gamesWithRosterData > 0)
    .sort((a, b) => b.totalWaiverPoints - a.totalWaiverPoints);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[0.45rem] uppercase tracking-[0.2em] text-white/30">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">Owner</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-2 text-right">Per Game</div>
        <div className="col-span-2 text-right">% of Score</div>
      </div>

      {sorted.map((row, index) => (
        <div
          key={row.ownerKey}
          className="flex flex-col rounded-lg border border-white/5 bg-white/[0.02] transition hover:bg-white/[0.04]"
        >
          <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
            <div className="col-span-1 text-center font-heading text-xs text-white/40">
              {index + 1}
            </div>
            
            <div className="col-span-5 flex items-center gap-2 overflow-hidden">
               <TeamLogo 
                  logoURL={row.logoURL} 
                  label={row.latestTeamName} 
                  className="size-6 shrink-0" 
               />
               <div className="flex flex-col min-w-0">
                 <span className="truncate font-heading text-[0.55rem] uppercase tracking-wide text-white/90">
                   {row.ownerName}
                 </span>
                 <span className="truncate text-[0.45rem] uppercase tracking-wider text-white/40">
                   {row.latestTeamName}
                 </span>
               </div>
            </div>

            <div className="col-span-2 text-right font-sports text-sm text-[var(--ember)]">
              {Math.round(row.totalWaiverPoints).toLocaleString()}
            </div>

            <div className="col-span-2 text-right">
               <div className="font-sports text-xs text-white/80">
                 {row.waiverPointsPerGame.toFixed(1)}
               </div>
            </div>

            <div className="col-span-2 text-right">
               <div className="font-sports text-xs text-white/80">
                 {(row.waiverPctOfTotal * 100).toFixed(1)}%
               </div>
            </div>
          </div>

          {/* Top Waiver Players Scroll */}
          {row.topWaiverPlayers.length > 0 && (
            <div className="w-full overflow-x-auto pb-3 pt-1 scrollbar-none">
              <div className="flex gap-2 px-10">
                {row.topWaiverPlayers.map((player) => {
                  const ppg = player.weeksStarted > 0 ? player.points / player.weeksStarted : 0;
                  return (
                    <div 
                      key={`${player.playerId}-${player.seasonId}`}
                      className="group flex shrink-0 flex-col gap-1.5 rounded border border-white/5 bg-white/5 p-2 transition hover:border-white/10 hover:bg-white/10 w-[120px]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-white/10">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img 
                              src={getHeadshotURL(player.playerId)} 
                              alt={player.playerName}
                              className="size-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }} 
                           />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[0.55rem] font-bold leading-tight text-white/90" title={player.playerName}>
                            {formatPlayerName(player.playerName)}
                          </div>
                          <div className="text-[0.45rem] font-medium text-white/40">
                            {player.seasonId}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                         <div className="flex flex-col">
                            <span className="text-[0.35rem] uppercase tracking-wider text-white/40">Total</span>
                            <span className="font-sports text-[0.55rem] text-[var(--ember)]">{Math.round(player.points)}</span>
                         </div>
                         <div className="flex flex-col text-center">
                            <span className="text-[0.35rem] uppercase tracking-wider text-white/40">Starts</span>
                            <span className="font-sports text-[0.55rem] text-white/60">{player.weeksStarted}</span>
                         </div>
                         <div className="flex flex-col text-right">
                            <span className="text-[0.35rem] uppercase tracking-wider text-white/40">FP/G</span>
                            <span className="font-sports text-[0.55rem] text-white/80">{ppg.toFixed(1)}</span>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
      
      {sorted.length === 0 && (
         <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-[0.6rem] uppercase tracking-[0.2em] text-white/40">
           No waiver data available for this selection
         </div>
      )}
    </div>
  );
}

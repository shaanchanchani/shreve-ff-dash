import { TeamStanding } from "@/types/prizes";
import { TeamLogo } from "@/components/common/team-logo";
import { cn } from "@/lib/utils";

interface PlayoffBracketProps {
  standings: TeamStanding[];
}

export function PlayoffBracket({ standings }: PlayoffBracketProps) {
  // Ensure sorted by Record (Win Pct effectively) then PF
  const sortedStandings = [...standings].sort((a, b) => {
    const aScore = a.wins + 0.5 * a.ties;
    const bScore = b.wins + 0.5 * b.ties;
    if (bScore !== aScore) return bScore - aScore;
    return b.pointsFor - a.pointsFor;
  });

  const seeds = sortedStandings.slice(0, 6);
  const getSeed = (seed: number) => seeds[seed - 1];

  if (seeds.length < 6) {
    return (
      <div className="text-center text-white/50 py-10">
        Not enough data for playoff picture.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-xl mx-auto">
       {/* Visual Bracket */}
       <div className="relative flex flex-col gap-6 px-2 overflow-x-auto py-6">
          
          <div className="min-w-[500px] grid grid-cols-[180px_40px_180px_40px_180px]">
              {/* Round 1: Week 15 */}
              <div className="flex flex-col justify-around gap-6">
                  <BracketNode seed={1} team={getSeed(1)} isBye />
                  <BracketMatchup topSeed={{ seed: 4, team: getSeed(4) }} bottomSeed={{ seed: 5, team: getSeed(5) }} />
                  <BracketMatchup topSeed={{ seed: 3, team: getSeed(3) }} bottomSeed={{ seed: 6, team: getSeed(6) }} />
                  <BracketNode seed={2} team={getSeed(2)} isBye />
              </div>

              {/* Connectors 1 */}
              <div className="relative w-full h-full">
                 {/* Top Half Connector */}
                 <div className="absolute top-[12%] bottom-[38%] left-0 w-1/2 border-r border-white/10" />
                 <div className="absolute top-[38%] left-1/2 w-1/2 border-b border-white/10" />
                 
                 {/* Bottom Half Connector */}
                 <div className="absolute bottom-[12%] top-[38%] left-0 w-1/2 border-r border-white/10" />
                 <div className="absolute bottom-[38%] left-1/2 w-1/2 border-b border-white/10" />
              </div>

              {/* Round 2: Week 16 */}
              <div className="flex flex-col justify-around py-8">
                  <EmptySlot label="Semis" subLabel="Week 16" />
                  <EmptySlot label="Semis" subLabel="Week 16" />
              </div>
              
              {/* Connectors 2 */}
              <div className="relative w-full h-full">
                 <div className="absolute top-[25%] bottom-[25%] left-0 w-1/2 border-r border-white/10" />
                 <div className="absolute top-1/2 left-1/2 w-1/2 border-b border-white/10" />
              </div>

              {/* Round 3: Week 17 (Championship) */}
              <div className="flex flex-col justify-center items-center">
                 <EmptySlot label="Finals" subLabel="Week 17" isFinal />
                 <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="text-[10px] text-[var(--gold)] font-bold uppercase tracking-widest opacity-60">Champion</div>
                 </div>
              </div>
          </div>
       </div>
      
      {/* Playoff Odds Table */}
      <div className="mt-2 border-t border-white/10 pt-6">
        <div className="grid grid-cols-[24px_1fr_60px_60px] gap-2 px-2 py-2 text-[9px] uppercase tracking-widest text-white/30">
          <div>#</div>
          <div>Team</div>
          <div className="text-right">Make</div>
          <div className="text-right">Bye</div>
        </div>
        <div className="space-y-px">
          {sortedStandings.map((team, index) => (
            <OddsRow key={team.teamName} rank={index + 1} team={team} />
          ))}
        </div>
        <p className="mt-6 px-2 text-center text-[10px] text-white/30">
           Probabilities based on 2,000 simulations accounting for remaining schedule and league median scoring correlation.
        </p>
      </div>
    </div>
  );
}

function BracketNode({ seed, team, isBye }: { seed: number; team: TeamStanding; isBye?: boolean }) {
  return (
    <div className={cn(
       "relative flex items-center gap-3 rounded-xl border bg-white/5 p-2 pr-3",
       isBye ? "border-[var(--gold)]/30 shadow-[0_0_15px_-5px_var(--gold)]" : "border-white/10"
    )}>
      {isBye && (
        <div className="absolute -right-2 -top-2 flex h-4 w-8 items-center justify-center rounded bg-[var(--gold)] text-[8px] font-bold text-black shadow-sm z-10">
           BYE
        </div>
      )}
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-black/30 font-mono text-[10px] text-white/40">
         {seed}
      </div>
      <TeamLogo logoURL={team.logoURL} label={team.teamName} className="h-6 w-6" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-heading font-bold text-white tracking-wide">{team.teamName}</div>
        <div className="font-mono text-[8px] text-white/40">
           {team.wins}-{team.losses}-{team.ties}
        </div>
      </div>
    </div>
  );
}

function BracketMatchup({ 
  topSeed, 
  bottomSeed 
}: { 
  topSeed: { seed: number; team: TeamStanding };
  bottomSeed: { seed: number; team: TeamStanding };
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5">
       <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] p-2">
         <span className="w-4 text-center font-mono text-[9px] text-white/30">{topSeed.seed}</span>
         <TeamLogo logoURL={topSeed.team.logoURL} label={topSeed.team.teamName} className="h-5 w-5" />
         <span className="truncate text-[10px] font-heading font-bold text-white/80 tracking-wide">{topSeed.team.teamName}</span>
       </div>
       <div className="flex items-center gap-2 p-2">
         <span className="w-4 text-center font-mono text-[9px] text-white/30">{bottomSeed.seed}</span>
         <TeamLogo logoURL={bottomSeed.team.logoURL} label={bottomSeed.team.teamName} className="h-5 w-5" />
         <span className="truncate text-[10px] font-heading font-bold text-white/80 tracking-wide">{bottomSeed.team.teamName}</span>
       </div>
    </div>
  );
}

function EmptySlot({ label, subLabel, isFinal }: { label: string; subLabel: string; isFinal?: boolean }) {
   return (
      <div className={cn(
         "rounded-xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center gap-1",
         isFinal ? "h-24 w-32 border-[var(--gold)]/20 bg-[var(--gold)]/5" : "h-20 w-full"
      )}>
         <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            isFinal ? "text-[var(--gold)]/70" : "text-white/20"
         )}>{label}</span>
         <span className="text-[8px] font-mono text-white/10 uppercase tracking-wide">{subLabel}</span>
      </div>
   )
}

function OddsRow({ rank, team }: { rank: number; team: TeamStanding }) {
  const odds = team.playoffOdds ?? 0;
  const byeOdds = team.byeOdds ?? 0;
  
  const isEliminated = odds <= 0.001;
  const isClinched = odds >= 0.999;
  const isByeClinched = byeOdds >= 0.999;

  const formatPct = (val: number) => {
      if (val >= 0.999) return "100%";
      if (val <= 0.001) return "-";
      return `${(val * 100).toFixed(0)}%`;
  };

  const getScaleColor = (val: number) => {
      const hue = Math.max(0, Math.min(110, val * 110));
      return `hsl(${hue}, 85%, 60%)`;
  };
  
  return (
    <div className={cn(
      "grid grid-cols-[24px_1fr_60px_60px] items-center gap-2 px-2 py-2 rounded transition-colors text-xs",
      rank <= 6 ? "bg-white/[0.03]" : "hover:bg-white/[0.02]",
      isEliminated && "opacity-30 grayscale"
    )}>
      <div className="font-mono text-[10px] text-white/30 text-center">{rank}</div>
      <div className="flex items-center gap-2 min-w-0">
         <TeamLogo logoURL={team.logoURL} label={team.teamName} className="w-5 h-5" />
         <div className="truncate text-white/90 text-[11px] font-heading font-bold tracking-wide">{team.teamName}</div>
      </div>
      
      {/* Make Playoffs Column */}
      <div className="text-right font-sports text-[18px] tracking-wide">
         {isClinched ? (
            <span className="text-[var(--neon-green)]">✓</span>
         ) : (
            <span 
              style={{ color: odds <= 0.001 ? undefined : getScaleColor(odds) }} 
              className={odds <= 0.001 ? "text-white/20" : ""}
            >
               {formatPct(odds)}
            </span>
         )}
      </div>

      {/* Bye Column */}
      <div className="text-right font-sports text-[18px] tracking-wide">
        {isByeClinched ? (
            <span className="text-[var(--gold)]">✓</span>
        ) : (
            <span 
              style={{ color: byeOdds <= 0.001 ? undefined : getScaleColor(byeOdds) }} 
              className={byeOdds <= 0.001 ? "text-white/20" : ""}
            >
                {formatPct(byeOdds)}
            </span>
        )}
      </div>
    </div>
  );
}

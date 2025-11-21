"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  HistoricalMatchup,
  HistoricalMatchupTeam,
} from "@/types/history";
import { TeamLogo } from "@/components/common/team-logo";
import { cn } from "@/lib/utils";
import { canonicalOwnerKey, type AggregatedOwner } from "@/lib/owner-utils";

type Props = {
  owners: AggregatedOwner[];
  matchups: HistoricalMatchup[];
};

type Selection = {
  primary: string;
  secondary: string;
};

type RecordSummary = {
  wins: number;
  losses: number;
  ties: number;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
};

const INITIAL_SELECTION: Selection = { primary: "", secondary: "" };
const ALL_OPPONENTS_KEY = "all_opponents";

export function HeadToHeadWidget({ owners, matchups }: Props) {
  const orderedOwners = useMemo(
    () => [...owners].sort((a, b) => a.ownerName.localeCompare(b.ownerName)),
    [owners],
  );

  const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-select "All Opponents" when a primary team is chosen if secondary is empty
  const handlePrimaryChange = (newPrimary: string) => {
    setSelection((prev) => ({
      primary: newPrimary,
      secondary: prev.secondary || ALL_OPPONENTS_KEY,
    }));
  };

  const selectedMatchups = useMemo(() => {
    if (!selection.primary || !selection.secondary) {
      return [];
    }

    return matchups.filter((matchup) => {
      const homeKey = canonicalOwnerKey(
        matchup.home.ownerKey,
        matchup.home.ownerName,
        matchup.home.teamName,
      );
      const awayKey = canonicalOwnerKey(
        matchup.away.ownerKey,
        matchup.away.ownerName,
        matchup.away.teamName,
      );

      const participants = [homeKey, awayKey];
      
      // Must include primary
      if (!participants.includes(selection.primary)) {
        return false;
      }

      // If secondary is ALL, we accept it (as long as primary is in it)
      if (selection.secondary === ALL_OPPONENTS_KEY) {
        return true;
      }

      // Otherwise must include secondary
      return participants.includes(selection.secondary);
    });
  }, [matchups, selection.primary, selection.secondary]);

  // Reset expanded when selection changes
  useEffect(() => {
    setExpandedId(null);
  }, [selection]);

  const primaryRecord = useMemo(
    () => summarizeRecord(selection.primary, selectedMatchups),
    [selection.primary, selectedMatchups],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Selector
          value={selection.primary}
          options={orderedOwners}
          onChange={handlePrimaryChange}
          disabledValue={selection.secondary === ALL_OPPONENTS_KEY ? undefined : selection.secondary}
        />
        <Selector
          value={selection.secondary}
          options={orderedOwners}
          onChange={(value) =>
            setSelection((prev) => ({
              ...prev,
              secondary: value,
            }))
          }
          disabledValue={selection.primary}
          includeAllOption
        />
      </div>

      {selection.primary === selection.secondary && selection.primary !== "" && selection.secondary !== ALL_OPPONENTS_KEY && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[0.55rem] uppercase tracking-[0.2em] text-amber-100 text-center">
          Select different teams
        </p>
      )}

      {selectedMatchups.length > 0 ? (
        <>
          <SeriesSummary record={primaryRecord} />
          <div className="grid grid-cols-2 gap-2">
            {selectedMatchups.map((matchup) => (
              <MatchupCard
                key={matchup.id}
                matchup={matchup}
                isOpen={expandedId === matchup.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === matchup.id ? null : matchup.id))
                }
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-[0.6rem] uppercase tracking-[0.2em] text-white/40">
          {(!selection.primary || !selection.secondary) ? "Select two teams" : "No matchups found"}
        </div>
      )}
    </section>
  );
}

const summarizeRecord = (
  ownerKey: string,
  matchups: HistoricalMatchup[],
): RecordSummary => {
  return matchups.reduce<RecordSummary>(
    (acc, matchup) => {
      const homeKey = canonicalOwnerKey(
        matchup.home.ownerKey,
        matchup.home.ownerName,
        matchup.home.teamName,
      );
      const awayKey = canonicalOwnerKey(
        matchup.away.ownerKey,
        matchup.away.ownerName,
        matchup.away.teamName,
      );

      const isHome = homeKey === ownerKey;
      const isAway = awayKey === ownerKey;

      if (!isHome && !isAway) {
        return acc;
      }

      const team = isHome ? matchup.home : matchup.away;
      const opponent = isHome ? matchup.away : matchup.home;

      if (!team || !opponent) {
        return acc;
      }

      acc.games += 1;
      acc.pointsFor += team.score;
      acc.pointsAgainst += opponent.score;

      if (team.score > opponent.score) {
        acc.wins += 1;
      } else if (team.score < opponent.score) {
        acc.losses += 1;
      } else {
        acc.ties += 1;
      }

      return acc;
    },
    { wins: 0, losses: 0, ties: 0, games: 0, pointsFor: 0, pointsAgainst: 0 },
  );
};

const formatRecord = (record: RecordSummary) => {
  if (!record.games) return "0-0";
  return `${record.wins}-${record.losses}`;
};

const Selector = ({
  value,
  options,
  onChange,
  disabledValue,
  includeAllOption = false,
}: {
  value: string;
  options: AggregatedOwner[];
  onChange: (value: string) => void;
  disabledValue?: string;
  includeAllOption?: boolean;
}) => (
  <label className="block min-w-0">
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-7 font-heading text-[0.6rem] uppercase tracking-wide text-white transition focus:border-white/20 focus:bg-white/10 focus:outline-none truncate"
      >
        <option value="" disabled>
          Select Team
        </option>
        {includeAllOption && (
          <option value={ALL_OPPONENTS_KEY} className="bg-black text-white font-bold">
            All Opponents
          </option>
        )}
        {options.map((owner) => (
          <option
            key={owner.ownerKey}
            value={owner.ownerKey}
            disabled={disabledValue === owner.ownerKey}
            className="bg-black text-white"
          >
            {owner.ownerName}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-3 w-3"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
    </div>
  </label>
);

const SeriesSummary = ({
  record,
}: {
  record: RecordSummary;
}) => {
  const recordLabel = formatRecord(record);
  const avgFor = record.games
    ? (record.pointsFor / record.games).toFixed(1)
    : "0.0";
  const avgAgainst = record.games
    ? (record.pointsAgainst / record.games).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-sports text-2xl text-[var(--ember)] leading-none">
            {recordLabel}
          </span>
          <span className="text-[0.5rem] uppercase tracking-wider text-white/40">
            {record.games} {record.games === 1 ? 'game' : 'games'}
          </span>
        </div>
        <div className="text-right">
          <div className="font-sports text-sm text-white/80 leading-none">
            {avgFor} — {avgAgainst}
          </div>
          <div className="mt-0.5 text-[0.4rem] uppercase tracking-wider text-white/30">
            Avg Score
          </div>
        </div>
      </div>
    </div>
  );
};

const MatchupCard = ({
  matchup,
  isOpen,
  onToggle,
}: {
  matchup: HistoricalMatchup;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  return (
    <article 
      className={cn(
        "overflow-hidden rounded-lg border transition-all duration-200",
        isOpen 
          ? "col-span-2 border-white/10 bg-white/[0.02]" 
          : "col-span-1 border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex w-full items-center justify-between text-[0.45rem] uppercase tracking-[0.15em] text-white/30">
          <span>{matchup.seasonId} · W{matchup.week}</span>
          {isOpen && <span className="text-white/50">Close</span>}
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <MiniScoreRow team={matchup.home} winner={matchup.home.score > matchup.away.score} />
          <MiniScoreRow team={matchup.away} winner={matchup.away.score > matchup.home.score} />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/5 bg-black/20 px-3 py-3">
           <div className="flex gap-2 overflow-x-auto">
            <div className="flex-1 min-w-0">
              <RosterColumn team={matchup.home} />
            </div>
            <div className="flex-1 min-w-0">
              <RosterColumn team={matchup.away} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

const MiniScoreRow = ({ team, winner }: { team: HistoricalMatchupTeam, winner: boolean }) => (
  <div className="flex items-center justify-between gap-2">
     <div className="flex items-center gap-1.5 min-w-0">
        <TeamLogo logoURL={team.logoURL} label={team.teamName} className="size-4" />
        <span className={cn(
          "font-heading text-[0.55rem] uppercase tracking-wide truncate",
          winner ? "text-white/90" : "text-white/50"
        )}>
          {team.teamName}
        </span>
     </div>
     <span className={cn(
        "font-sports text-sm leading-none", 
        winner ? "text-[var(--ember)]" : "text-white/40"
     )}>
        {team.score.toFixed(1)}
     </span>
  </div>
);

const RosterColumn = ({ team }: { team: HistoricalMatchupTeam }) => {
  if (team.rosterUnavailable) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-[0.45rem] uppercase tracking-wider text-white/30">
        No data
      </div>
    );
  }

  // Filter and sort
  const starters = team.roster
    .filter(p => p.position !== "BN")
    .sort((a, b) => b.points - a.points);
    
  const bench = team.roster
    .filter(p => p.position === "BN")
    .sort((a, b) => b.points - a.points);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 space-y-4">
      {/* Team Header */}
      <div className="mb-2 flex items-center gap-2 border-b border-white/5 pb-2">
        <TeamLogo logoURL={team.logoURL} label={team.teamName} className="size-5" />
        <div className="min-w-0 flex-1">
           <div className="truncate font-heading text-[0.55rem] uppercase tracking-wide text-white/80">
             {team.teamName}
           </div>
           <div className="truncate text-[0.45rem] uppercase tracking-wider text-white/40">
             {team.score.toFixed(1)} pts
           </div>
        </div>
      </div>
      
      {/* Starters */}
      <div>
        <h4 className="mb-2 text-[0.4rem] uppercase tracking-[0.2em] text-white/30">Starters</h4>
        <ul className="space-y-1.5">
          {starters.map((player) => (
            <li
              key={`${team.teamId}-${player.id}-${player.position}`}
              className="flex items-center gap-2"
            >
              <div className="relative">
                 <PlayerHeadshot playerId={player.id} className="size-6 shrink-0 rounded-full bg-black/40" />
                 {player.wasDraftedByTeam === false && (
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--mist)] px-1 py-px text-[0.3rem] font-bold text-black uppercase tracking-wider">
                       WV
                    </div>
                 )}
              </div>
              
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                   <div className="flex items-center gap-1.5 min-w-0">
                     <span className="w-5 shrink-0 text-[0.4rem] uppercase tracking-wider text-white/30 text-center bg-white/5 rounded px-0.5 py-0.5">
                        {player.position}
                     </span>
                     <span className="truncate font-heading text-[0.55rem] uppercase tracking-wide text-white/70 leading-none">
                        {player.name}
                     </span>
                   </div>
                   <span className="font-sports text-[0.75rem] text-[var(--ember)] leading-none">
                      {player.points.toFixed(1)}
                   </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <h4 className="mb-2 text-[0.4rem] uppercase tracking-[0.2em] text-white/30">Bench</h4>
          <ul className="space-y-1.5 opacity-60">
            {bench.map((player) => (
              <li
                key={`${team.teamId}-${player.id}-${player.position}`}
                className="flex items-center gap-2"
              >
                <PlayerHeadshot playerId={player.id} className="size-5 shrink-0 rounded-full bg-black/40 grayscale" />
                
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-1.5 min-w-0">
                       <span className="truncate font-heading text-[0.5rem] uppercase tracking-wide text-white/70 leading-none">
                          {player.name}
                       </span>
                     </div>
                     <span className="font-sports text-[0.65rem] text-white/50 leading-none">
                        {player.points.toFixed(1)}
                     </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const PlayerHeadshot = ({ playerId, className }: { playerId: number, className?: string }) => {
  const [error, setError] = useState(false);
  const url = `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;

  if (error || !playerId) {
    return (
      <div className={cn("flex items-center justify-center border border-white/5 bg-white/5", className)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-3 text-white/20">
          <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src={url} 
      alt="" 
      className={cn("object-cover object-top bg-white/5", className)}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

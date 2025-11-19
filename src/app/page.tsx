"use client";
import { useState, useEffect, useRef, type CSSProperties, type SyntheticEvent } from "react";
import { JetBrains_Mono, VT323, Black_Ops_One } from "next/font/google";
/* eslint-disable @next/next/no-img-element */

interface Player {
  name: string;
  position: string;
  points: number;
  team: string;
  headshot?: string;
}

interface HighScore {
  teamName: string;
  score: number;
  week?: number;
  logoURL?: string;
  topPlayers?: Player[];
}

interface WeeklyWinner {
  week: number;
  teamName: string;
  score: number;
  logoURL?: string;
}

interface EliminatedTeam {
  week: number;
  teamName: string;
  score: number;
  logoURL?: string;
}

interface UnluckyTeam {
  teamName: string;
  pointsAgainst: number;
  rank: number;
  logoURL?: string;
}

interface TouchdownData {
  player: string;
  yards: number;
  week: number;
  fantasy_owner?: string;
  player_id?: number;
}

interface LongestTDs {
  rushing_tds?: TouchdownData[];
  receiving_tds?: TouchdownData[];
  passing_tds?: TouchdownData[];
  longest_started_rushing_td?: TouchdownData;
  longest_started_receiving_td?: TouchdownData;
  longest_started_passing_td?: TouchdownData;
}

interface PrizeData {
  seasonHighScore: HighScore | null;
  weeklyHighScores: WeeklyWinner[];
  survivorEliminations: EliminatedTeam[];
  unluckyTeams: UnluckyTeam[];
}

const headingFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
});

const dataFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

const sportsFont = VT323({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sports",
});

const fieldFont = Black_Ops_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-field",
});

const WEEKLY_PAYOUT = 10;
const SEASON_PAYOUT = 25;
const UNLUCKY_PAYOUT = 10;
const SURVIVOR_PAYOUT = 10;
const LONGEST_QB_TD_PAYOUT = 15;
const LONGEST_REC_TD_PAYOUT = 15;
const LONGEST_RUSH_TD_PAYOUT = 15;
const FIRST_PLACE_PAYOUT = 210;
const TOTAL_REGULAR_SEASON_WEEKS = 14;

const formatCurrency = (value: number) => `$${Math.round(value)}`;

type LongestKey =
  | "longest_started_rushing_td"
  | "longest_started_receiving_td"
  | "longest_started_passing_td";

type LedgerEntry = {
  amount: number;
  hits: number;
  notes: string[];
};

const LONGEST_TDS_ENDPOINT =
  process.env.NEXT_PUBLIC_LONGEST_TDS_URL?.trim() || "/api/longest-tds";

export default function Home() {
  const [prizeData, setPrizeData] = useState<PrizeData | null>(null);
  const [longestTDs, setLongestTDs] = useState<LongestTDs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPrizeData = async () => {
      try {
        const prizeResponse = await fetch("/api/espn-test");
        if (!prizeResponse.ok) throw new Error("Failed to fetch prize data");
        
        const prizeResult = await prizeResponse.json();
        setPrizeData(prizeResult);
      } catch (err) {
        setError("Failed to fetch data: " + (err as Error).message);
      }
    };

    const fetchLongestTDs = async () => {
      try {
        const tdsResponse = await fetch(LONGEST_TDS_ENDPOINT);
        if (tdsResponse.ok) {
          const tdsResult = await tdsResponse.json();
          setLongestTDs(tdsResult);
        }
      } catch (err) {
        // Silently fail for longest TDs - not critical for main functionality
        console.warn("Failed to fetch longest TDs:", err);
      }
    };

    // Fetch prize data immediately
    fetchPrizeData();
    
    // Fetch longest TDs in background after a short delay
    setTimeout(fetchLongestTDs, 500);
  }, []);

  const palette = {
    "--night": "#0a0615",
    "--mist": "#f4ede3",
    "--ember": "#ff7b39",
    "--tide": "#2ce0cf",
    "--violet": "#6c5ce7",
    "--charcoal": "rgba(17, 17, 27, 0.95)",
  } as CSSProperties;

  const cardBase =
    "swipe-card snap-center shrink-0 w-[calc(100vw-3rem)] h-[calc(100vh-12rem)] rounded-[30px] border border-white/15 bg-[var(--charcoal)] px-5 py-6 shadow-[0_25px_50px_rgba(0,0,0,0.65)] overflow-y-auto";

  const longestConfigs: Array<{ key: LongestKey; label: string }> = [
    { key: "longest_started_rushing_td", label: "Rushing" },
    { key: "longest_started_receiving_td", label: "Receiving" },
    { key: "longest_started_passing_td", label: "Passing" },
  ];

  const addCash = (
    ledger: Map<string, LedgerEntry>,
    team: string,
    amount: number,
    note: string,
  ) => {
    if (!team) return;
    const existing = ledger.get(team) ?? { amount: 0, hits: 0, notes: [] };
    existing.amount += amount;
    existing.hits += 1;
    existing.notes = [...existing.notes, note];
    ledger.set(team, existing);
  };

  const ledger = new Map<string, LedgerEntry>();
  const weeklyWeeks = new Set<number>();

  if (prizeData) {
    prizeData.weeklyHighScores.forEach((winner) => {
      weeklyWeeks.add(winner.week);
      addCash(ledger, winner.teamName, WEEKLY_PAYOUT, `Week ${winner.week}`);
    });

    if (prizeData.seasonHighScore) {
      addCash(ledger, prizeData.seasonHighScore.teamName, SEASON_PAYOUT, "Season Apex");
    }
  }

  const claimedRows = Array.from(ledger.entries()).sort((a, b) => {
    if (b[1].amount === a[1].amount) return a[0].localeCompare(b[0]);
    return b[1].amount - a[1].amount;
  });

  const longestCards = longestTDs
    ? longestConfigs
        .map((config) => {
          const payload = longestTDs[config.key];
          if (!payload) return null;
          return { ...config, data: payload };
        })
        .filter(
          (
            card,
          ): card is (typeof longestConfigs)[number] & { data: TouchdownData } =>
            Boolean(card),
        )
    : [];


  const renderLogo = (logoURL?: string, label?: string) => {
    if (logoURL) {
      return (
        <img
          src={logoURL}
          alt={label ?? "team logo"}
          className="h-9 w-9 rounded-full border border-white/20 object-cover"
        />
      );
    }

    if (!label) return null;

    return (
      <span className="font-heading grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/5 text-xs uppercase text-white/70">
        {label.slice(0, 2)}
      </span>
    );
  };

  const renderHybridLogo = (teamLogoURL?: string, playerName?: string, playerId?: number, teamLabel?: string) => {
    // Hard-coded player headshots since ESPN IDs aren't available
    const getPlayerHeadshotURL = (name: string) => {
      const playerHeadshots: { [key: string]: string } = {
        'T.Atwell': 'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/hpvbp9pn7ifbh62nde0n',
        'M.Stafford': 'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/xdlnnbapdbk8trxqlasu',
        'J.Taylor': 'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/ye4runp84oku1vnodsa7'
      };
      return playerHeadshots[name] || null;
    };
    
    const playerHeadshotURL = getPlayerHeadshotURL(playerName || '');
    
    return (
      <div className="relative w-10 h-10">
        {/* Team logo - smaller, positioned top-left */}
        <div className="absolute top-0 left-0 w-6 h-6 z-10">
          {teamLogoURL ? (
            <img
              src={teamLogoURL}
              alt={teamLabel ?? "team logo"}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="font-heading grid w-full h-full place-items-center rounded-full bg-white/5 text-xs uppercase text-white/70">
              {teamLabel?.slice(0, 2)}
            </span>
          )}
        </div>
        
        {/* Player headshot - bigger, positioned bottom-right, no border */}
        <div className="absolute bottom-0 right-0 w-8 h-8 z-20">
          {playerHeadshotURL ? (
            <img
              src={playerHeadshotURL}
              alt={playerName ?? "player"}
              className="w-full h-full rounded-full object-cover bg-transparent"
              onError={(e) => {
                // Fallback to just showing team logo if player headshot fails
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full rounded-full bg-white/5"></div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${headingFont.variable} ${dataFont.variable} ${sportsFont.variable} ${fieldFont.variable}`}>
      <main
        style={palette}
        className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#1d0d28,_#050308_65%)] text-[var(--mist)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 15% 20%, rgba(248, 170, 75, 0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(108, 92, 231, 0.35), transparent 50%)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.03) 0%, transparent 55%)" }} />

        <div className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-5 pb-20 pt-10">

          {error && (
            <div className={`${cardBase} border-red-400/40 bg-red-900/40 text-sm text-red-50`}>
              {error}
            </div>
          )}

          {prizeData ? (
            <>
            <div 
              ref={scrollRef}
              className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-16 no-scrollbar"
              onScroll={(e) => {
                const scrollLeft = e.currentTarget.scrollLeft;
                const cardWidth = e.currentTarget.scrollWidth / 4; // 4 total cards
                const newPage = Math.round(scrollLeft / cardWidth);
                setCurrentPage(newPage);
              }}
            >
              <section className={cardBase} aria-label="Projected Payouts">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl uppercase">Payout Picture</h2>
                  </div>
                </div>
                
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <table className="w-full">
                    <thead className="border-b border-white/10">
                      <tr className="text-xs uppercase text-white/60">
                        <th className="text-left p-3">Team</th>
                        <th className="text-right p-3">Min</th>
                        <th className="text-right p-3">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Get all unique team names from various sources
                        const allTeams = new Set<string>();
                        
                        // Add teams from claimed payouts
                        claimedRows.forEach(([teamName]) => allTeams.add(teamName));
                        
                        // Add teams from weekly winners
                        prizeData.weeklyHighScores.forEach(winner => allTeams.add(winner.teamName));
                        
                        // Add teams from unlucky teams
                        prizeData.unluckyTeams.forEach(team => allTeams.add(team.teamName));
                        
                        // Add teams from survivor eliminations
                        prizeData.survivorEliminations.forEach(team => allTeams.add(team.teamName));
                        
                        // Add season high score team if exists
                        if (prizeData.seasonHighScore) {
                          allTeams.add(prizeData.seasonHighScore.teamName);
                        }
                        
                        // Convert to array and calculate min/max for each team
                        const teamPayouts = Array.from(allTeams).map(teamName => {
                          // Current earnings
                          const currentEarnings = ledger.get(teamName)?.amount || 0;
                          
                          // Calculate minimum (current earnings)
                          const minPayout = currentEarnings;
                          
                          // Calculate maximum potential
                          let maxPayout = currentEarnings;
                          
                          // Add potential weekly wins for remaining weeks
                          const remainingWeeks = TOTAL_REGULAR_SEASON_WEEKS - weeklyWeeks.size;
                          maxPayout += remainingWeeks * WEEKLY_PAYOUT;
                          
                          // Add season apex if not already won
                          if (!prizeData.seasonHighScore) {
                            maxPayout += SEASON_PAYOUT;
                          }
                          
                          // Add unlucky bounty if currently leading in points against
                          const isUnluckyLeader = prizeData.unluckyTeams.length > 0 && prizeData.unluckyTeams[0].teamName === teamName;
                          if (isUnluckyLeader || prizeData.unluckyTeams.length === 0) {
                            maxPayout += UNLUCKY_PAYOUT;
                          }
                          
                          // Add potential longest TD prizes (each team could potentially win all 3)
                          maxPayout += LONGEST_QB_TD_PAYOUT + LONGEST_REC_TD_PAYOUT + LONGEST_RUSH_TD_PAYOUT;
                          
                          // Add potential survivor prize if not eliminated yet
                          const isEliminated = prizeData.survivorEliminations.some(e => e.teamName === teamName);
                          if (!isEliminated) {
                            maxPayout += SURVIVOR_PAYOUT;
                          }
                          
                          // Add potential playoff prizes (assuming any team could make 1st, 2nd, or 3rd)
                          // For simplicity, we'll add the highest possible (1st place)
                          maxPayout += FIRST_PLACE_PAYOUT;
                          
                          return { teamName, minPayout, maxPayout };
                        });
                        
                        // Sort by min payout (descending), then by max payout (descending)
                        return teamPayouts.sort((a, b) => {
                          if (b.minPayout !== a.minPayout) {
                            return b.minPayout - a.minPayout;
                          }
                          return b.maxPayout - a.maxPayout;
                        });
                      })().map(({ teamName, minPayout, maxPayout }, index, array) => (
                        <tr
                          key={teamName}
                          className={`border-white/5 hover:bg-white/5 ${index < array.length - 1 ? 'border-b' : ''}`}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {(() => {
                                // Find logo from any source
                                const weeklyWinner = prizeData.weeklyHighScores.find(w => w.teamName === teamName);
                                const unluckyTeam = prizeData.unluckyTeams.find(t => t.teamName === teamName);
                                const seasonWinner = prizeData.seasonHighScore?.teamName === teamName ? prizeData.seasonHighScore : null;
                                const logoURL = weeklyWinner?.logoURL || unluckyTeam?.logoURL || seasonWinner?.logoURL;
                                return renderLogo(logoURL, teamName);
                              })()}
                              <span className="font-heading text-sm uppercase">{teamName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-sports text-xl text-[var(--tide)]">{formatCurrency(minPayout)}</span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-sports text-xl text-[var(--ember)]">{formatCurrency(maxPayout)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={cardBase} aria-label="League Stats Snapshot">
                {/* Season High Score */}
                <div>
                  <p className="text-sm uppercase text-white/60 mb-3">Season High Score ($25)</p>
                  {prizeData.seasonHighScore ? (
                    <div className="rounded-xl border border-[var(--tide)] bg-[var(--tide)]/10 overflow-hidden">
                      {/* Team Header */}
                      <div className="p-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          {renderLogo(prizeData.seasonHighScore.logoURL, prizeData.seasonHighScore.teamName)}
                          <div>
                            <span className="font-heading text-lg uppercase">{prizeData.seasonHighScore.teamName}</span>
                            <div className="text-xs uppercase text-white/50">
                              Week {prizeData.seasonHighScore.week} · {Math.round(prizeData.seasonHighScore.score)} pts · $25
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Top Players */}
                      {prizeData.seasonHighScore.topPlayers && prizeData.seasonHighScore.topPlayers.length > 0 ? (
                        <div className="p-2">
                          <div className="space-y-1">
                            {prizeData.seasonHighScore.topPlayers.map((player, index) => (
                              <div key={`${player.name}-${player.points}`} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {player.headshot ? (
                                    <img 
                                      src={player.headshot} 
                                      alt={player.name}
                                      className="w-8 h-8 rounded-full bg-transparent object-cover"
                                      onError={(e: SyntheticEvent<HTMLImageElement>) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallbackElement = e.currentTarget.nextElementSibling;
                                        if (fallbackElement instanceof HTMLElement) {
                                          fallbackElement.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <span className="font-heading text-xs text-white/50 w-4 hidden">#{index + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-heading text-sm truncate">{player.name}</div>
                                  </div>
                                </div>
                                <span className="font-sports text-lg text-[var(--ember)] ml-2">
                                  {player.points.toFixed(1)}
                                </span>
                              </div>
                            ))}
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

                {/* Points Against Top 3 */}
                <div className="mt-6">
                  <p className="text-sm uppercase  text-white/60 mb-3">Unlucky Candidates ($10)</p>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {prizeData.unluckyTeams.slice(0, 3).map((team, index, array) => (
                          <tr key={team.rank} className={`hover:bg-white/5 ${index < array.length - 1 ? 'border-b border-white/5' : ''}`}>
                            <td className="p-2">
                              <span className="font-heading text-xs text-white/50">#{team.rank}</span>
                            </td>
                            <td className="p-2">
                              {renderLogo(team.logoURL, team.teamName)}
                            </td>
                            <td className="p-2">
                              <span className="font-heading text-sm uppercase">{team.teamName}</span>
                            </td>
                            <td className="p-2 text-right">
                              <span className="font-sports text-xl text-[var(--violet)]">{team.pointsAgainst.toFixed(1)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>


                {/* Longest TDs Compact */}
                <div className="mt-6">
                  <p className="text-sm uppercase  text-white/60 mb-3">Longest TD Candidates ($15)</p>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {!longestTDs ? (
                          // Loading skeleton for longest TDs
                          Array.from({ length: 3 }, (_, i) => (
                            <tr key={`skeleton-${i}`} className={`animate-pulse ${i < 2 ? 'border-b border-white/5' : ''}`}>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-9 w-9 bg-white/10 rounded-full"></div>
                                  <div className="flex-1 space-y-1">
                                    <div className="h-4 bg-white/10 rounded w-24"></div>
                                    <div className="h-3 bg-white/10 rounded w-16"></div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <div className="h-6 bg-white/10 rounded w-8"></div>
                                  <div className="h-4 bg-white/10 rounded w-12"></div>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : longestCards.length > 0 ? (
                          longestCards.map((card, index, array) => (
                            <tr key={card.key} className={`hover:bg-white/5 ${index < array.length - 1 ? 'border-b border-white/5' : ''}`}>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  {card.data.fantasy_owner && (() => {
                                    // Find logo for the fantasy owner team
                                    const ownerTeam = prizeData.weeklyHighScores.find(w => w.teamName === card.data.fantasy_owner) ||
                                                     prizeData.unluckyTeams.find(t => t.teamName === card.data.fantasy_owner) ||
                                                     (prizeData.seasonHighScore?.teamName === card.data.fantasy_owner ? prizeData.seasonHighScore : null);
                                    return renderHybridLogo(ownerTeam?.logoURL, card.data.player, card.data.player_id, card.data.fantasy_owner);
                                  })()}
                                  <div>
                                    <span className="font-heading text-sm uppercase">{card.data.player}</span>
                                    <div className="text-xs uppercase text-white/50">
                                      Week {card.data.week}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <span className="font-field text-xl text-[var(--ember)] text-right min-w-[3ch]">
                                    {card.data.yards}
                                  </span>
                                  <span className="font-heading text-sm text-white/60 leading-none whitespace-nowrap w-16 text-left">
                                    {card.label === 'Rushing' ? 'rush' : card.label === 'Receiving' ? 'rec' : 'pass'} yds
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="p-2 text-center text-sm text-white/60">No TD data yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className={cardBase} aria-label="Weekly Winners">
                <p className="text-sm uppercase text-white/60 mb-3">Weekly Winners ($10)</p>
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {(() => {
                        const filteredAndSorted = prizeData.weeklyHighScores
                          .filter(winner => winner.score > 0)
                          .sort((a, b) => b.week - a.week);
                        
                        return filteredAndSorted.length > 0 ? (
                          filteredAndSorted.map((winner, index, array) => (
                            <tr key={winner.week} className={`hover:bg-white/5 ${index < array.length - 1 ? 'border-b border-white/5' : ''}`}>
                              <td className="p-3">
                                <span className="font-heading text-xs uppercase  text-white/50">
                                  W{winner.week}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {renderLogo(winner.logoURL, winner.teamName)}
                                  <span className="text-white/80 text-sm">{winner.teamName}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-sports text-xl text-[var(--ember)]">
                                  {Math.round(winner.score)}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-sm text-white/60">No weeks recorded yet.</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={cardBase} aria-label="Survivor Pool">
                <p className="text-sm uppercase text-white/60 mb-3">Survivor Pool ($10)</p>
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        {(() => {
                          const filteredEliminations = prizeData.survivorEliminations
                            .sort((a, b) => b.week - a.week);
                          
                          return filteredEliminations.length > 0 ? (
                            filteredEliminations.map((elimination, index, array) => (
                              <tr key={elimination.week} className={`hover:bg-white/5 ${index < array.length - 1 ? 'border-b border-white/5' : ''}`}>
                                <td className="p-3">
                                  <span className="font-heading text-xs uppercase text-white/50">
                                    W{elimination.week}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {renderLogo(elimination.logoURL, elimination.teamName)}
                                    <span className="text-white/80 text-sm">{elimination.teamName}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <span className="font-sports text-xl text-[var(--ember)]">
                                    {Math.round(elimination.score)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="p-3 text-center text-sm text-white/60">No eliminations yet.</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                {/* Surviving Teams */}
                <div className="mt-6">
                  <h3 className="font-heading text-lg uppercase mb-3">
                    Surviving Teams ({(() => {
                      const eliminatedTeamNames = new Set(prizeData.survivorEliminations.map(e => e.teamName));
                      const allTeamNames = new Set([
                        ...prizeData.weeklyHighScores.map(w => w.teamName),
                        ...prizeData.unluckyTeams.map(t => t.teamName),
                        ...(prizeData.seasonHighScore ? [prizeData.seasonHighScore.teamName] : []),
                        ...prizeData.survivorEliminations.map(e => e.teamName)
                      ]);
                      return allTeamNames.size - eliminatedTeamNames.size;
                    })()})
                  </h3>
                  
                  {(() => {
                    const eliminatedTeamNames = new Set(prizeData.survivorEliminations.map(e => e.teamName));
                    const allTeams = [
                      ...prizeData.weeklyHighScores.map(w => ({ teamName: w.teamName, logoURL: w.logoURL })),
                      ...prizeData.unluckyTeams.map(t => ({ teamName: t.teamName, logoURL: t.logoURL })),
                      ...(prizeData.seasonHighScore ? [{ teamName: prizeData.seasonHighScore.teamName, logoURL: prizeData.seasonHighScore.logoURL }] : []),
                      ...prizeData.survivorEliminations.map(e => ({ teamName: e.teamName, logoURL: e.logoURL }))
                    ].filter((team, index, self) => 
                      self.findIndex(t => t.teamName === team.teamName) === index
                    );
                    
                    const survivingTeams = allTeams.filter(team => !eliminatedTeamNames.has(team.teamName));
                    
                    if (survivingTeams.length > 1) {
                      return (
                        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden max-h-40 overflow-y-auto">
                          <table className="w-full">
                            <tbody>
                              {survivingTeams.map((team, index, array) => (
                                <tr key={team.teamName} className={`hover:bg-white/5 ${index < array.length - 1 ? 'border-b border-white/5' : ''}`}>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      {renderLogo(team.logoURL, team.teamName)}
                                      <span className="text-white/80 text-sm">{team.teamName}</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    } else if (survivingTeams.length === 1) {
                      return (
                        <div className="text-center py-6 rounded-xl border border-green-400/30 bg-green-900/20">
                          <div className="flex items-center justify-center gap-3 mb-3">
                            {renderLogo(survivingTeams[0].logoURL, survivingTeams[0].teamName)}
                            <div>
                              <div className="font-field text-xl uppercase text-[var(--ember)]">
                                {survivingTeams[0].teamName}
                              </div>
                              <div className="font-heading text-sm uppercase text-green-400">
                                Survivor Winner!
                              </div>
                            </div>
                          </div>
                          <div className="font-sports text-2xl text-[var(--tide)]">
                            Wins $10!
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center py-6 text-white/60">
                          All teams eliminated (this shouldn&apos;t happen)
                        </div>
                      );
                    }
                  })()}
                </div>
              </section>
            </div>
            
            {/* Page indicator dots */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 px-4 py-2">
              {Array.from({ length: 4 }, (_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (scrollRef.current) {
                      const cardWidth = scrollRef.current.scrollWidth / 4;
                      scrollRef.current.scrollTo({
                        left: index * cardWidth,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    currentPage === index 
                      ? 'bg-[var(--tide)] scale-125' 
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
            </>
          ) : (
            // Skeleton loaders
            <div 
              className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-16 no-scrollbar"
            >
              {/* Payout Picture Skeleton */}
              <div className={`${cardBase} animate-pulse`}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="h-6 bg-white/10 rounded w-40"></h2>
                </div>
                
                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <table className="w-full">
                    <thead className="border-b border-white/10">
                      <tr className="text-xs">
                        <th className="text-left p-3"><div className="h-4 bg-white/10 rounded w-12"></div></th>
                        <th className="text-right p-3"><div className="h-4 bg-white/10 rounded w-8 ml-auto"></div></th>
                        <th className="text-right p-3"><div className="h-4 bg-white/10 rounded w-8 ml-auto"></div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 8 }, (_, i) => (
                        <tr key={i} className={`border-white/5 ${i < 7 ? 'border-b' : ''}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 bg-white/10 rounded-full"></div>
                              <div className="h-4 bg-white/10 rounded w-20"></div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="h-6 bg-white/10 rounded w-12 ml-auto"></div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="h-6 bg-white/10 rounded w-12 ml-auto"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* League Stats Skeleton */}
              <div className={`${cardBase} animate-pulse`}>
                <div className="space-y-6">
                  {/* Season High Score */}
                  <div>
                    <div className="h-4 bg-white/10 rounded w-32 mb-3"></div>
                    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      {/* Team Header Skeleton */}
                      <div className="p-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-white/10 rounded-full"></div>
                          <div>
                            <div className="h-5 bg-white/10 rounded w-24 mb-1"></div>
                            <div className="h-3 bg-white/10 rounded w-32"></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Players Skeleton */}
                      <div className="p-2">
                        <div className="space-y-1">
                          {Array.from({ length: 4 }, (_, i) => (
                            <div key={i} className="flex items-center justify-between py-1 px-2 rounded">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="h-6 w-6 bg-white/10 rounded-full"></div>
                                <div className="h-4 bg-white/10 rounded w-24"></div>
                                <div className="h-3 bg-white/10 rounded w-8"></div>
                              </div>
                              <div className="h-5 bg-white/10 rounded w-10"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Unlucky Candidates */}
                  <div>
                    <div className="h-4 bg-white/10 rounded w-32 mb-3"></div>
                    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          {Array.from({ length: 3 }, (_, i) => (
                            <tr key={i} className={`${i < 2 ? 'border-b border-white/5' : ''}`}>
                              <td className="p-2"><div className="h-3 bg-white/10 rounded w-6"></div></td>
                              <td className="p-2"><div className="h-6 w-6 bg-white/10 rounded-full"></div></td>
                              <td className="p-2"><div className="h-4 bg-white/10 rounded w-20"></div></td>
                              <td className="p-2 text-right"><div className="h-6 bg-white/10 rounded w-12 ml-auto"></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>


                  {/* Longest TDs */}
                  <div>
                    <div className="h-4 bg-white/10 rounded w-32 mb-3"></div>
                    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          {Array.from({ length: 3 }, (_, i) => (
                            <tr key={i} className={`${i < 2 ? 'border-b border-white/5' : ''}`}>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 bg-white/10 rounded-full"></div>
                                  <div className="flex-1">
                                    <div className="h-4 bg-white/10 rounded w-24 mb-1"></div>
                                    <div className="h-3 bg-white/10 rounded w-16"></div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <div className="h-6 bg-white/10 rounded w-8"></div>
                                  <div className="h-4 bg-white/10 rounded w-12"></div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Winners Skeleton */}
              <div className={`${cardBase} animate-pulse`}>
                <div className="h-4 bg-white/10 rounded w-32 mb-3"></div>
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {Array.from({ length: 6 }, (_, i) => (
                        <tr key={i} className={`${i < 5 ? 'border-b border-white/5' : ''}`}>
                          <td className="p-3"><div className="h-4 bg-white/10 rounded w-8"></div></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 bg-white/10 rounded-full"></div>
                              <div className="h-4 bg-white/10 rounded w-24"></div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="h-6 bg-white/10 rounded w-12 ml-auto"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Survivor Pool Skeleton */}
              <div className={`${cardBase} animate-pulse`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 bg-white/10 rounded w-32"></div>
                  <div className="h-6 bg-white/10 rounded w-8"></div>
                </div>
                
                <div className="h-4 bg-white/10 rounded w-3/4 mb-6"></div>

                {/* Weekly Eliminations */}
                <div className="mb-6">
                  <div className="h-5 bg-white/10 rounded w-40 mb-3"></div>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden max-h-64">
                    <table className="w-full">
                      <tbody>
                        {Array.from({ length: 8 }, (_, i) => (
                          <tr key={i} className={`${i < 7 ? 'border-b border-white/5' : ''}`}>
                            <td className="p-2"><div className="h-4 bg-white/10 rounded w-12"></div></td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="h-9 w-9 bg-white/10 rounded-full"></div>
                                <div className="flex-1">
                                  <div className="h-4 bg-white/10 rounded w-20 mb-1"></div>
                                  <div className="h-3 bg-white/10 rounded w-16"></div>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-right"><div className="h-5 bg-white/10 rounded w-6"></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Surviving Teams */}
                <div>
                  <div className="h-5 bg-white/10 rounded w-36 mb-3"></div>
                  <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden max-h-40">
                    <table className="w-full">
                      <tbody>
                        {Array.from({ length: 4 }, (_, i) => (
                          <tr key={i} className={`${i < 3 ? 'border-b border-white/5' : ''}`}>
                            <td className="p-2"><div className="h-9 w-9 bg-white/10 rounded-full"></div></td>
                            <td className="p-2">
                              <div>
                                <div className="h-4 bg-white/10 rounded w-20 mb-1"></div>
                                <div className="h-3 bg-white/10 rounded w-16"></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx global>{`
        .font-heading {
          font-family: var(--font-heading), "JetBrains Mono", monospace;
        }
        .font-data {
          font-family: var(--font-jetbrains-mono), "JetBrains Mono", monospace;
        }
        .font-sports {
          font-family: var(--font-sports), "VT323", monospace;
          font-weight: 400;
        }
        .font-field {
          font-family: var(--font-field), "Black Ops One", sans-serif;
          font-weight: 400;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .swipe-card {
          transition: transform 0.3s ease, border-color 0.3s ease;
          scroll-snap-align: center;
        }
        .swipe-card:active {
          transform: scale(0.98);
          border-color: rgba(255, 255, 255, 0.35);
        }
        .no-scrollbar {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </div>
  );
}

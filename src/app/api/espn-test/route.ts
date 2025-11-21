import { NextResponse } from 'next/server';
import { Client } from 'espn-fantasy-football-api/node';
import type {
  PrizeData,
  Player,
  HighScore,
  WeeklyWinner,
  EliminatedTeam,
  UnluckyTeam,
  TeamStanding,
} from '@/types/prizes';

// Simple in-memory cache
let cachedData: PrizeData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 0; // Disabled for dev to ensure new fields populate


interface BoxscoreRosterEntry {
  id: number;
  fullName: string;
  rosteredPosition: string;
  totalPoints: number;
  proTeamAbbreviation?: string;
}

interface BoxscoreMatchup {
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number;
  awayScore?: number;
  homeRoster?: unknown[];
  awayRoster?: unknown[];
}

const isBoxscoreMatchup = (value: unknown): value is BoxscoreMatchup => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<BoxscoreMatchup>;
  return typeof candidate.homeTeamId === 'number' && typeof candidate.awayTeamId === 'number';
};

const isBoxscoreRosterEntry = (value: unknown): value is BoxscoreRosterEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<BoxscoreRosterEntry>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.rosteredPosition === 'string' &&
    typeof candidate.totalPoints === 'number'
  );
};

export async function GET() {
  try {
    console.time('Total Request');
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Serving from cache');
      console.timeEnd('Total Request');
      return NextResponse.json(cachedData);
    }
    console.log('Cache miss or expired, fetching fresh data');

    const client = new Client({
      leagueId: parseInt(process.env.LEAGUE_ID || '1918224288'),
      espnS2: process.env.espn_s2,
      SWID: process.env.SWID
    });

    const seasonId = 2025; // Updated to 2025 season
    const totalRegularSeasonWeeks = 14; // Should match TOTAL_REGULAR_SEASON_WEEKS in prize-calculations.ts
    
    console.time('Fetch Teams');
    // Get team names and logos first
    const teamIdToName: { [id: number]: string } = {};
    const teamIdToLogo: { [id: number]: string } = {};
    try {
      const teams = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: 1 });
      if (Array.isArray(teams)) {
        teams.forEach((team: { id: number; name?: string; location?: string; logoURL?: string }) => {
          teamIdToName[team.id] = team.name || team.location || `Team ${team.id}`;
          teamIdToLogo[team.id] = team.logoURL || '';
        });
      }
    } catch (teamError) {
      console.warn('Failed to fetch team names:', teamError);
    }
    console.timeEnd('Fetch Teams');
    
    console.time('Fetch Boxscores');
    // Get all boxscores for the season in parallel (much faster)
    const boxscorePromises = [];
    for (let week = 1; week <= totalRegularSeasonWeeks; week++) {
      boxscorePromises.push(
        client.getBoxscoreForWeek({
          seasonId,
          matchupPeriodId: week,
          scoringPeriodId: week
        }).then((boxscore: unknown) => ({ week, boxscore }))
        .catch((weekError: unknown) => {
          console.warn(`Failed to fetch week ${week}:`, weekError);
          return { week, boxscore: null };
        })
      );
    }
    
    const allBoxscores = await Promise.all(boxscorePromises);
    console.timeEnd('Fetch Boxscores');

    console.time('Processing Data');
    // Calculate Season High Score
    let seasonHighScore: HighScore | null = null;
    const weeklyHighScores: WeeklyWinner[] = [];
    const teamTotalPointsAgainst: { [teamName: string]: number } = {};
    const teamStats: { [teamName: string]: TeamStanding } = {};
    const survivorEliminations: EliminatedTeam[] = [];
    const eliminatedTeams = new Set<string>();
    const remainingMatchups: Array<{ homeTeamName: string; awayTeamName: string }> = [];

    allBoxscores.forEach(({ week, boxscore }) => {
      if (!boxscore || !Array.isArray(boxscore)) return;

      // Calculate Week Median
      const scores: number[] = [];
      boxscore.forEach((m: { homeScore?: number; awayScore?: number }) => {
        const h = m.homeScore || 0;
        const a = m.awayScore || 0;
        if (h > 0 || a > 0) {
            scores.push(h);
            scores.push(a);
        }
      });
      
      let median = 0;
      if (scores.length > 0) {
          scores.sort((a, b) => a - b);
          const mid = Math.floor(scores.length / 2);
          median = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
      }
      
      let weekHighScore: WeeklyWinner | null = null;
      let weekLowScore: EliminatedTeam | null = null;

      boxscore.forEach((matchup: { homeScore?: number; awayScore?: number; homeTeamId: number; awayTeamId: number }) => {
        const homeScore = matchup.homeScore || 0;
        const awayScore = matchup.awayScore || 0;
        const homeTeamId = matchup.homeTeamId;
        const awayTeamId = matchup.awayTeamId;
        
        // Use actual team names and logos if available, fall back to Team IDs
        const homeTeamName = teamIdToName[homeTeamId] || `Team ${homeTeamId}`;
        const awayTeamName = teamIdToName[awayTeamId] || `Team ${awayTeamId}`;
        const homeTeamLogo = teamIdToLogo[homeTeamId] || '';
        const awayTeamLogo = teamIdToLogo[awayTeamId] || '';

        // Track points against for unlucky calculation
        teamTotalPointsAgainst[homeTeamName] = (teamTotalPointsAgainst[homeTeamName] || 0) + awayScore;
        teamTotalPointsAgainst[awayTeamName] = (teamTotalPointsAgainst[awayTeamName] || 0) + homeScore;

        // Initialize standings if not exists
        if (!teamStats[homeTeamName]) {
          teamStats[homeTeamName] = { teamName: homeTeamName, wins: 0, losses: 0, ties: 0, pointsFor: 0, logoURL: homeTeamLogo };
        }
        if (!teamStats[awayTeamName]) {
          teamStats[awayTeamName] = { teamName: awayTeamName, wins: 0, losses: 0, ties: 0, pointsFor: 0, logoURL: awayTeamLogo };
        }

        // Only count stats for played games (non-zero scores)
        // Note: This assumes games with 0-0 score haven't been played yet.
        // In ESPN API, unplayed games often have 0 scores.
        if (homeScore > 0 || awayScore > 0) {
            teamStats[homeTeamName].pointsFor += homeScore;
            teamStats[awayTeamName].pointsFor += awayScore;

            if (homeScore > awayScore) {
              teamStats[homeTeamName].wins += 1;
              teamStats[awayTeamName].losses += 1;
            } else if (awayScore > homeScore) {
              teamStats[awayTeamName].wins += 1;
              teamStats[homeTeamName].losses += 1;
            } else {
              teamStats[homeTeamName].ties += 1;
              teamStats[awayTeamName].ties += 1;
            }

            // Median Result
            if (homeScore > median) teamStats[homeTeamName].wins += 1;
            else teamStats[homeTeamName].losses += 1;

            if (awayScore > median) teamStats[awayTeamName].wins += 1;
            else teamStats[awayTeamName].losses += 1;

            // Check for season high score
            if (!seasonHighScore || homeScore > seasonHighScore.score) {
              seasonHighScore = { teamName: homeTeamName, score: homeScore, week, logoURL: homeTeamLogo };
            }
            if (!seasonHighScore || awayScore > seasonHighScore.score) {
              seasonHighScore = { teamName: awayTeamName, score: awayScore, week, logoURL: awayTeamLogo };
            }

            // Check for weekly high score
            if (!weekHighScore || homeScore > weekHighScore.score) {
              weekHighScore = { week, teamName: homeTeamName, score: homeScore, logoURL: homeTeamLogo };
            }
            if (!weekHighScore || awayScore > weekHighScore.score) {
              weekHighScore = { week, teamName: awayTeamName, score: awayScore, logoURL: awayTeamLogo };
            }

            // Check for weekly low score (for survivor) - only among teams not already eliminated
            if (!eliminatedTeams.has(homeTeamName) && homeScore > 0 && (!weekLowScore || homeScore < weekLowScore.score)) {
              weekLowScore = { week, teamName: homeTeamName, score: homeScore, logoURL: homeTeamLogo };
            }
            if (!eliminatedTeams.has(awayTeamName) && awayScore > 0 && (!weekLowScore || awayScore < weekLowScore.score)) {
              weekLowScore = { week, teamName: awayTeamName, score: awayScore, logoURL: awayTeamLogo };
            }
        } else {
          // Future game
          remainingMatchups.push({ homeTeamName, awayTeamName });
        }
      });

      if (weekHighScore) weeklyHighScores.push(weekHighScore);
      if (weekLowScore) {
        survivorEliminations.push(weekLowScore);
        eliminatedTeams.add((weekLowScore as EliminatedTeam).teamName);
      }
    });

    // Calculate Unlucky Teams (top 3 by points against)
    const unluckyTeams: UnluckyTeam[] = Object.entries(teamTotalPointsAgainst)
      .map(([teamName, pointsAgainst]) => {
        // Find team logo by name
        const teamId = Object.keys(teamIdToName).find(id => teamIdToName[parseInt(id)] === teamName);
        const logoURL = teamId ? teamIdToLogo[parseInt(teamId)] : '';
        return { teamName, pointsAgainst, rank: 0, logoURL };
      })
      .sort((a, b) => b.pointsAgainst - a.pointsAgainst)
      .slice(0, 3)
      .map((team, index) => ({ ...team, rank: index + 1 }));

    const addSeasonHighScorePlayers = async (highScore: HighScore) => {
      try {
        console.time('Fetch High Score Players');
        const teamId = Object.keys(teamIdToName).find(id => 
          teamIdToName[parseInt(id, 10)] === highScore.teamName
        );
        
        if (teamId && highScore.week) {
          const roster = await client.getBoxscoreForWeek({
            seasonId,
            matchupPeriodId: highScore.week,
            scoringPeriodId: highScore.week
          });
          console.timeEnd('Fetch High Score Players');
          
          // Find the specific team's matchup data
          if (Array.isArray(roster)) {
            const typedMatchups = roster.filter(isBoxscoreMatchup);
            const numericTeamId = parseInt(teamId, 10);
            const teamMatchup = typedMatchups.find(matchup => 
              matchup.homeTeamId === numericTeamId || matchup.awayTeamId === numericTeamId
            );
            
            if (teamMatchup) {
              const isHomeTeam = teamMatchup.homeTeamId === numericTeamId;
              const teamRoster = isHomeTeam ? teamMatchup.homeRoster : teamMatchup.awayRoster;
              
              if (teamRoster && Array.isArray(teamRoster)) {
                const rosterEntries = teamRoster.filter(isBoxscoreRosterEntry);
                const topPlayers = rosterEntries
                  .filter(player => player.totalPoints > 0)
                  .map<Player>((player) => ({
                    name: player.fullName,
                    position: player.rosteredPosition,
                    points: player.totalPoints,
                    team: player.proTeamAbbreviation || '',
                    headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png`
                  }))
                  .sort((a, b) => b.points - a.points)
                  .slice(0, 4);
                
                highScore.topPlayers = topPlayers;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch player details for season high score:', error);
      }
    };

    if (seasonHighScore) {
      await addSeasonHighScorePlayers(seasonHighScore);
    }

    // Calculate League Median Stats
    let winsAboveMedian = 0;
    let totalWins = 0;

    allBoxscores.forEach(({ boxscore }) => {
      if (!boxscore || !Array.isArray(boxscore)) return;
      
      // Collect all scores for this week
      const weekScores: number[] = [];
      const weekMatchups: { winnerScore: number }[] = [];

      boxscore.forEach((matchup: { homeScore?: number; awayScore?: number }) => {
        const home = matchup.homeScore || 0;
        const away = matchup.awayScore || 0;
        
        // Only consider played games
        if (home === 0 && away === 0) return;

        weekScores.push(home);
        weekScores.push(away);

        // Identify winner score
        if (home > away) weekMatchups.push({ winnerScore: home });
        else if (away > home) weekMatchups.push({ winnerScore: away });
      });

      if (weekScores.length === 0) return;

      // Calculate Median
      // Sort scores ascending
      weekScores.sort((a, b) => a - b);
      const mid = Math.floor(weekScores.length / 2);
      const median = weekScores.length % 2 !== 0
        ? weekScores[mid]
        : (weekScores[mid - 1] + weekScores[mid]) / 2;

      // Check winners against median
      weekMatchups.forEach(({ winnerScore }) => {
        totalWins++;
        if (winnerScore > median) {
          winsAboveMedian++;
        }
      });
    });

    const leagueMedianStats = {
      winsAboveMedian,
      totalWins,
      percentage: totalWins > 0 ? winsAboveMedian / totalWins : 0
    };

    console.time('Playoff Simulation');
    // Playoff Probabilities Simulation
    const SIMULATIONS = 2000;

    const teamsList = Object.values(teamStats);
    const playoffCounts: { [teamName: string]: number } = {};
    const byeCounts: { [teamName: string]: number } = {};
    
    // Use median stats to adjust win probabilities
    const medianWinProbability = leagueMedianStats.percentage; // e.g., ~0.8 means 80% of matchup winners also win median

    teamsList.forEach(t => {
        playoffCounts[t.teamName] = 0;
        byeCounts[t.teamName] = 0;
    });

    if (remainingMatchups.length > 0) {
      for (let i = 0; i < SIMULATIONS; i++) {
        // Clone standings for this simulation
        const simStandings: { [name: string]: TeamStanding } = {};
        teamsList.forEach(t => {
          simStandings[t.teamName] = { ...t };
        });

        // Simulate remaining games with Median Scoring Logic
        remainingMatchups.forEach(m => {
            const home = simStandings[m.homeTeamName];
            const away = simStandings[m.awayTeamName];
            
            // Calculate Points For projection
            // Correct for Game+Median record (wins+losses is approx 2x weeks played)
            const homeGames = home.wins + home.losses + home.ties;
            const awayGames = away.wins + away.losses + away.ties;

            const homeAvg = homeGames > 0 ? (home.pointsFor / homeGames) * 2 : 100;
            const awayAvg = awayGames > 0 ? (away.pointsFor / awayGames) * 2 : 100;
            
            home.pointsFor += homeAvg;
            away.pointsFor += awayAvg;

            // Determine Winner
            const homeWinsMatchup = Math.random() > 0.5;
            
            // Update Matchup W/L
            if (homeWinsMatchup) {
                home.wins++;
                away.losses++;
            } else {
                away.wins++;
                home.losses++;
            }

            // League Median Logic
            // If you win your matchup, you have a `medianWinProbability` chance of also beating the median
            // If you lose your matchup, you have a (1 - medianWinProbability) chance of beating the median (inverse correlation approximately)
            
            // Home Team Median Check
            if (homeWinsMatchup) {
                if (Math.random() < medianWinProbability) home.wins++; // Win vs Median
                else home.losses++; // Lose vs Median
            } else {
                // Home lost matchup
                if (Math.random() < (1 - medianWinProbability)) home.wins++; // Win vs Median
                else home.losses++; // Lose vs Median
            }

             // Away Team Median Check
            if (!homeWinsMatchup) { // Away Won Matchup
                if (Math.random() < medianWinProbability) away.wins++;
                else away.losses++;
            } else {
                // Away lost matchup
                 if (Math.random() < (1 - medianWinProbability)) away.wins++;
                 else away.losses++;
            }
        });

        // Sort standings
        const sortedSim = Object.values(simStandings).sort((a, b) => {
          const aScore = a.wins + 0.5 * a.ties;
          const bScore = b.wins + 0.5 * b.ties;
          if (bScore !== aScore) return bScore - aScore;
          return b.pointsFor - a.pointsFor;
        });

        // Top 6 make playoffs
        sortedSim.slice(0, 6).forEach((t, index) => {
            playoffCounts[t.teamName]++;
            // Top 2 get bye
            if (index < 2) {
                byeCounts[t.teamName]++;
            }
        });
      }

      // Assign probabilities
      teamsList.forEach(t => {
         t.playoffOdds = playoffCounts[t.teamName] / SIMULATIONS;
         t.byeOdds = byeCounts[t.teamName] / SIMULATIONS;
         t.clinchedPlayoffs = t.playoffOdds === 1;
         t.clinchedBye = t.byeOdds === 1;
      });
    } else {
        // No games remaining, odds are 0 or 1 based on current standings
        const sortedFinal = [...teamsList].sort((a, b) => {
          const aScore = a.wins + 0.5 * a.ties;
          const bScore = b.wins + 0.5 * b.ties;
          if (bScore !== aScore) return bScore - aScore;
          return b.pointsFor - a.pointsFor;
        });
        
        sortedFinal.forEach((t, idx) => {
            t.playoffOdds = idx < 6 ? 1 : 0;
            t.byeOdds = idx < 2 ? 1 : 0;
            t.clinchedPlayoffs = idx < 6;
            t.clinchedBye = idx < 2;
        });
    }
    console.timeEnd('Playoff Simulation');

    const standings: TeamStanding[] = teamsList.sort((a, b) => {
      const aScore = a.wins + 0.5 * a.ties;
      const bScore = b.wins + 0.5 * b.ties;
      if (bScore !== aScore) return bScore - aScore;
      return b.pointsFor - a.pointsFor;
    });

    const prizeData: PrizeData = {
      seasonHighScore,
      weeklyHighScores,
      survivorEliminations,
      unluckyTeams,
      standings,
      leagueMedianStats
    };

    // Cache the result
    cachedData = prizeData;
    cacheTimestamp = now;

    console.timeEnd('Total Request');
    return NextResponse.json(prizeData);
  } catch (error) {
    console.error('ESPN API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ESPN data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

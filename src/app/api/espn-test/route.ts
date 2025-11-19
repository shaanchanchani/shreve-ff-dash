import { NextResponse } from 'next/server';
import { Client } from 'espn-fantasy-football-api/node';
import type {
  PrizeData,
  Player,
  HighScore,
  WeeklyWinner,
  EliminatedTeam,
  UnluckyTeam,
} from '@/types/prizes';

// Simple in-memory cache
let cachedData: PrizeData | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours


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
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData);
    }
    const client = new Client({
      leagueId: parseInt(process.env.LEAGUE_ID || '1918224288'),
      espnS2: process.env.espn_s2,
      SWID: process.env.SWID
    });

    const seasonId = 2025; // Updated to 2025 season
    const currentWeek = 14; // Fetch all regular season weeks
    
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
    
    // Get all boxscores for the season in parallel (much faster)
    const boxscorePromises = [];
    for (let week = 1; week <= currentWeek; week++) {
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

    // Calculate Season High Score
    let seasonHighScore: HighScore | null = null;
    const weeklyHighScores: WeeklyWinner[] = [];
    const teamTotalPointsAgainst: { [teamName: string]: number } = {};
    const survivorEliminations: EliminatedTeam[] = [];
    const eliminatedTeams = new Set<string>();

    allBoxscores.forEach(({ week, boxscore }) => {
      if (!boxscore || !Array.isArray(boxscore)) return;
      
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
        // Only consider scores > 0 to handle future weeks that haven't been played yet
        if (!eliminatedTeams.has(homeTeamName) && homeScore > 0 && (!weekLowScore || homeScore < weekLowScore.score)) {
          weekLowScore = { week, teamName: homeTeamName, score: homeScore, logoURL: homeTeamLogo };
        }
        if (!eliminatedTeams.has(awayTeamName) && awayScore > 0 && (!weekLowScore || awayScore < weekLowScore.score)) {
          weekLowScore = { week, teamName: awayTeamName, score: awayScore, logoURL: awayTeamLogo };
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
        const teamId = Object.keys(teamIdToName).find(id => 
          teamIdToName[parseInt(id, 10)] === highScore.teamName
        );
        
        if (teamId && highScore.week) {
          const roster = await client.getBoxscoreForWeek({
            seasonId,
            matchupPeriodId: highScore.week,
            scoringPeriodId: highScore.week
          });
          
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

    const prizeData: PrizeData = {
      seasonHighScore,
      weeklyHighScores,
      survivorEliminations,
      unluckyTeams
    };

    // Cache the result
    cachedData = prizeData;
    cacheTimestamp = now;

    return NextResponse.json(prizeData);
  } catch (error) {
    console.error('ESPN API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ESPN data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

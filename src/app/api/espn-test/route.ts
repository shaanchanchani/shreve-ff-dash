import { NextResponse } from 'next/server';
import { Client } from 'espn-fantasy-football-api/node';

// Simple in-memory cache
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface HighScore {
  teamName: string;
  score: number;
  week?: number;
  logoURL?: string;
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

interface PrizeData {
  seasonHighScore: HighScore | null;
  weeklyHighScores: WeeklyWinner[];
  survivorEliminations: EliminatedTeam[];
  unluckyTeams: UnluckyTeam[];
}

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
    const currentWeek = 5; // Only fetch played weeks for faster loading
    
    // Get team names and logos first
    let teamIdToName: { [id: number]: string } = {};
    let teamIdToLogo: { [id: number]: string } = {};
    try {
      const teams = await client.getTeamsAtWeek({ seasonId, scoringPeriodId: 1 });
      if (Array.isArray(teams)) {
        teams.forEach((team: any) => {
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
        }).then(boxscore => ({ week, boxscore }))
        .catch(weekError => {
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

      boxscore.forEach((matchup: any) => {
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
        if (!eliminatedTeams.has(homeTeamName) && (!weekLowScore || homeScore < weekLowScore.score)) {
          weekLowScore = { week, teamName: homeTeamName, score: homeScore, logoURL: homeTeamLogo };
        }
        if (!eliminatedTeams.has(awayTeamName) && (!weekLowScore || awayScore < weekLowScore.score)) {
          weekLowScore = { week, teamName: awayTeamName, score: awayScore, logoURL: awayTeamLogo };
        }
      });

      if (weekHighScore) weeklyHighScores.push(weekHighScore);
      if (weekLowScore) {
        survivorEliminations.push(weekLowScore);
        eliminatedTeams.add(weekLowScore.teamName);
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
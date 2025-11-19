"use client";
import { useState, useEffect } from "react";
/* eslint-disable @next/next/no-img-element */

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

interface TouchdownData {
  player: string;
  yards: number;
  week: number;
  fantasy_owner?: string;
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

export default function Home() {
  const [prizeData, setPrizeData] = useState<PrizeData | null>(null);
  const [longestTDs, setLongestTDs] = useState<LongestTDs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prizeResponse, tdsResponse] = await Promise.all([
          fetch('/api/espn-test'),
          fetch('/api/longest-tds')
        ]);
        
        if (!prizeResponse.ok) throw new Error('Failed to fetch prize data');
        if (!tdsResponse.ok) throw new Error('Failed to fetch TDs data');
        
        const prizeData = await prizeResponse.json();
        const tdsData = await tdsResponse.json();
        
        setPrizeData(prizeData);
        setLongestTDs(tdsData);
      } catch (err) {
        setError('Failed to fetch data: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        

        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-300">Loading...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded p-3 mb-4">
            <p className="text-red-400 text-sm">Error: {error}</p>
          </div>
        )}

        {prizeData && (
          <div className="space-y-6">
            {/* Longest Started TDs Section */}
            {longestTDs && (
              <div className="bg-gradient-to-br from-gray-800/80 via-gray-700/60 to-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  Longest TDs (When Started) 🏆
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {longestTDs.longest_started_rushing_td && (
                    <div className="bg-gradient-to-r from-yellow-700/60 to-yellow-600/40 border border-yellow-500/50 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-yellow-200 mb-2">Longest Started Rushing TD</h3>
                      <p className="text-lg font-bold text-white">{longestTDs.longest_started_rushing_td.player}</p>
                      <p className="text-2xl font-bold text-yellow-300">{longestTDs.longest_started_rushing_td.yards} yards</p>
                      <p className="text-xs text-yellow-200">Week {longestTDs.longest_started_rushing_td.week}</p>
                      <p className="text-xs text-yellow-300 font-medium">📈 Started by {longestTDs.longest_started_rushing_td.fantasy_owner}</p>
                    </div>
                  )}
                  
                  {longestTDs.longest_started_receiving_td && (
                    <div className="bg-gradient-to-r from-yellow-700/60 to-yellow-600/40 border border-yellow-500/50 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-yellow-200 mb-2">Longest Started Receiving TD</h3>
                      <p className="text-lg font-bold text-white">{longestTDs.longest_started_receiving_td.player}</p>
                      <p className="text-2xl font-bold text-yellow-300">{longestTDs.longest_started_receiving_td.yards} yards</p>
                      <p className="text-xs text-yellow-200">Week {longestTDs.longest_started_receiving_td.week}</p>
                      <p className="text-xs text-yellow-300 font-medium">📈 Started by {longestTDs.longest_started_receiving_td.fantasy_owner}</p>
                    </div>
                  )}
                  
                  {longestTDs.longest_started_passing_td && (
                    <div className="bg-gradient-to-r from-yellow-700/60 to-yellow-600/40 border border-yellow-500/50 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-yellow-200 mb-2">Longest Started Passing TD</h3>
                      <p className="text-lg font-bold text-white">{longestTDs.longest_started_passing_td.player}</p>
                      <p className="text-2xl font-bold text-yellow-300">{longestTDs.longest_started_passing_td.yards} yards</p>
                      <p className="text-xs text-yellow-200">Week {longestTDs.longest_started_passing_td.week}</p>
                      <p className="text-xs text-yellow-300 font-medium">📈 Started by {longestTDs.longest_started_passing_td.fantasy_owner}</p>
                    </div>
                  )}
                </div>
                
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Season High Score */}
            <div className="bg-gradient-to-br from-gray-800/80 via-gray-700/60 to-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">
                Season High Score ($25)
              </h2>
              {prizeData.seasonHighScore ? (
                <div className="bg-gradient-to-r from-gray-700/60 to-gray-600/40 border border-gray-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {prizeData.seasonHighScore.logoURL && (
                      <img 
                        src={prizeData.seasonHighScore.logoURL} 
                        alt={prizeData.seasonHighScore.teamName}
                        className="w-6 h-6 rounded"
                      />
                    )}
                    <p className="font-bold text-gray-200 text-sm">
                      {prizeData.seasonHighScore.teamName}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {prizeData.seasonHighScore.score.toFixed(2)}
                  </p>
                  {prizeData.seasonHighScore.week && (
                    <p className="text-xs text-gray-400">
                      Week {prizeData.seasonHighScore.week}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No data</p>
              )}
            </div>

            {/* Weekly High Scores */}
            <div className="bg-gradient-to-br from-gray-800/80 via-gray-700/60 to-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">
                Weekly High Scores ($10/week)
              </h2>
              <div className="space-y-1">
                {prizeData.weeklyHighScores.map((winner) => (
                  <div key={winner.week} className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-700/60 to-gray-600/40 border border-gray-500/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-400 text-xs">
                        W{winner.week}:
                      </span>
                      {winner.logoURL && (
                        <img 
                          src={winner.logoURL} 
                          alt={winner.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-gray-200">
                        {winner.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-white">
                      {winner.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Survivor Eliminations */}
            <div className="bg-gradient-to-br from-gray-800/80 via-gray-700/60 to-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">
                Survivor ($10)
              </h2>
              <div className="space-y-1">
                {prizeData.survivorEliminations.map((elimination) => (
                  <div key={elimination.week} className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-700/60 to-gray-600/40 border border-gray-500/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-400 text-xs">
                        W{elimination.week}:
                      </span>
                      {elimination.logoURL && (
                        <img 
                          src={elimination.logoURL} 
                          alt={elimination.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-gray-200">
                        {elimination.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-white">
                      {elimination.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlucky Teams */}
            <div className="bg-gradient-to-br from-gray-800/80 via-gray-700/60 to-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">
                Unlucky Candidates ($10)
              </h2>
              <div className="space-y-1">
                {prizeData.unluckyTeams.map((team) => (
                  <div key={team.rank} className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-700/60 to-gray-600/40 border border-gray-500/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      {team.logoURL && (
                        <img 
                          src={team.logoURL} 
                          alt={team.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-gray-200">
                        #{team.rank} {team.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-white">
                      {team.pointsAgainst.toFixed(2)} PA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

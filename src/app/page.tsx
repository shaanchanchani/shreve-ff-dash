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

interface PrizeData {
  seasonHighScore: HighScore | null;
  weeklyHighScores: WeeklyWinner[];
  survivorEliminations: EliminatedTeam[];
  unluckyTeams: UnluckyTeam[];
}

export default function Home() {
  const [prizeData, setPrizeData] = useState<PrizeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrizeData = async () => {
      try {
        const response = await fetch('/api/espn-test');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setPrizeData(data);
      } catch (err) {
        setError('Failed to fetch ESPN data: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPrizeData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono">
      <div className="max-w-7xl mx-auto">

        {loading && (
          <div className="text-center py-8">
            <p className="text-green-400">Loading...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded p-3 mb-4">
            <p className="text-red-400 text-sm">Error: {error}</p>
          </div>
        )}

        {prizeData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Season High Score */}
            <div className="bg-gray-900 border border-green-600 rounded p-4">
              <h2 className="text-lg font-bold text-green-400 mb-3">
                Season High Score ($25)
              </h2>
              {prizeData.seasonHighScore ? (
                <div className="bg-green-900/30 border border-green-500 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {prizeData.seasonHighScore.logoURL && (
                      <img 
                        src={prizeData.seasonHighScore.logoURL} 
                        alt={prizeData.seasonHighScore.teamName}
                        className="w-6 h-6 rounded"
                      />
                    )}
                    <p className="font-bold text-green-300 text-sm">
                      {prizeData.seasonHighScore.teamName}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-green-400">
                    {prizeData.seasonHighScore.score.toFixed(2)}
                  </p>
                  {prizeData.seasonHighScore.week && (
                    <p className="text-xs text-green-500">
                      Week {prizeData.seasonHighScore.week}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No data</p>
              )}
            </div>

            {/* Weekly High Scores */}
            <div className="bg-gray-900 border border-blue-600 rounded p-4">
              <h2 className="text-lg font-bold text-blue-400 mb-3">
                Weekly High Scores ($10/week)
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {prizeData.weeklyHighScores.map((winner) => (
                  <div key={winner.week} className="flex justify-between items-center p-2 bg-blue-900/30 border border-blue-700 rounded text-sm">
                    <div className="flex items-center gap-2">
                      {winner.logoURL && (
                        <img 
                          src={winner.logoURL} 
                          alt={winner.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-blue-300">
                        Week {winner.week}: {winner.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-blue-400">
                      {winner.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Survivor Eliminations */}
            <div className="bg-gray-900 border border-red-600 rounded p-4">
              <h2 className="text-lg font-bold text-red-400 mb-3">
                Survivor ($10)
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {prizeData.survivorEliminations.map((elimination) => (
                  <div key={elimination.week} className="flex justify-between items-center p-2 bg-red-900/30 border border-red-700 rounded text-sm">
                    <div className="flex items-center gap-2">
                      {elimination.logoURL && (
                        <img 
                          src={elimination.logoURL} 
                          alt={elimination.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-red-300">
                        Week {elimination.week}: {elimination.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-red-400">
                      {elimination.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlucky Teams */}
            <div className="bg-gray-900 border border-yellow-600 rounded p-4">
              <h2 className="text-lg font-bold text-yellow-400 mb-3">
                Unlucky ($10)
              </h2>
              <div className="space-y-1">
                {prizeData.unluckyTeams.map((team) => (
                  <div key={team.rank} className="flex justify-between items-center p-2 bg-yellow-900/30 border border-yellow-700 rounded text-sm">
                    <div className="flex items-center gap-2">
                      {team.logoURL && (
                        <img 
                          src={team.logoURL} 
                          alt={team.teamName}
                          className="w-4 h-4 rounded"
                        />
                      )}
                      <span className="font-medium text-yellow-300">
                        #{team.rank} {team.teamName}
                      </span>
                    </div>
                    <span className="font-bold text-yellow-400">
                      {team.pointsAgainst.toFixed(2)} PA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

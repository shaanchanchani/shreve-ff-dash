import { useRouter } from "next/navigation";
import { SwipeCard } from "./swipe-card";
import { TeamLogo } from "../common/team-logo";
import type { PrizeData, WeeklyWinner } from "@/types/prizes";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  WEEKLY_CARD_ID,
} from "@/lib/dashboard-navigation";
import { CondensedTeamList } from "./condensed-team-list";

interface WeeklyWinnersCardProps {
  prizeData: PrizeData;
}

const getSortedWinners = (winners: WeeklyWinner[]) =>
  winners
    .filter((winner) => winner.score > 0)
    .sort((a, b) => b.week - a.week);

interface WinnerSummary {
  teamName: string;
  wins: number;
  logoURL?: string;
}

const WEEKLY_BREAKDOWN_ROUTE = "/weekly";

export function WeeklyWinnersCard({ prizeData }: WeeklyWinnersCardProps) {
  return (
    <SwipeCard aria-label="Weekly Winners">
      <WeeklyWinnersSummarySection prizeData={prizeData} />
    </SwipeCard>
  );
}

export function WeeklyWinnersSummarySection({
  prizeData,
}: WeeklyWinnersCardProps) {
  const router = useRouter();
  const winners = getSortedWinners(prizeData.weeklyHighScores);
  const uniqueWinners = getUniqueWinnerSummaries(winners);

  const navigateToBreakdown = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        DASHBOARD_RETURN_CARD_STORAGE_KEY,
        WEEKLY_CARD_ID,
      );
    }
    router.push(WEEKLY_BREAKDOWN_ROUTE);
  };

  const condensedItems = uniqueWinners.map((winner) => ({
    teamName: winner.teamName,
    logoURL: winner.logoURL,
    value: `${winner.wins}W`,
  }));

  return (
    <>
      <p className="mb-3 text-sm uppercase text-white/60">
        Weekly Winners ($10)
      </p>
      <div className="mt-6">
        <h3 className="font-heading mb-3 text-lg uppercase">
          Unique Winners ({uniqueWinners.length})
        </h3>

        <CondensedTeamList
          items={condensedItems}
          footerLabel="See Week Breakdown"
          onFooterClick={navigateToBreakdown}
          emptyMessage="No weeks recorded yet."
        />
      </div>
    </>
  );
}

export function WeeklyWinnersBreakdownContent({
  prizeData,
}: WeeklyWinnersCardProps) {
  const winners = getSortedWinners(prizeData.weeklyHighScores);
  return <WeeklyWinnersTable winners={winners} />;
}

function WeeklyWinnersTable({ winners }: { winners: WeeklyWinner[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <table className="w-full">
        <tbody>
          {winners.length > 0 ? (
            winners.map((winner, index) => (
              <tr
                key={winner.week}
                className={`hover:bg-white/5 ${index < winners.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <td className="p-3">
                  <span className="font-heading text-xs uppercase text-white/50">
                    W{winner.week}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo logoURL={winner.logoURL} label={winner.teamName} />
                    <span className="text-sm text-white/80">
                      {winner.teamName}
                    </span>
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
              <td className="p-3 text-center text-sm text-white/60" colSpan={3}>
                No weeks recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function getUniqueWinnerSummaries(winners: WeeklyWinner[]): WinnerSummary[] {
  const aggregated = new Map<string, WinnerSummary>();

  winners.forEach((winner) => {
    const existing = aggregated.get(winner.teamName);
    if (existing) {
      existing.wins += 1;
    } else {
      aggregated.set(winner.teamName, {
        teamName: winner.teamName,
        wins: 1,
        logoURL: winner.logoURL,
      });
    }
  });

  return Array.from(aggregated.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamName.localeCompare(b.teamName);
  });
}

import { useRouter } from "next/navigation";
import { TeamLogo } from "../common/team-logo";
import type { PrizeData, WeeklyWinner } from "@/types/prizes";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  WEEKLY_CARD_ID,
} from "@/lib/dashboard-navigation";
import { ListFooterButton } from "./list-footer-button";
import { cn } from "@/lib/utils";

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
const sectionHeadingClass =
  "font-heading text-[0.6rem] uppercase tracking-[0.2em] text-white/50 leading-tight";

export function WeeklyWinnersCard({ prizeData }: WeeklyWinnersCardProps) {
  return <WeeklyWinnersSummarySection prizeData={prizeData} />;
}

interface WeeklyWinnersSummarySectionProps extends WeeklyWinnersCardProps {
  className?: string;
}

export function WeeklyWinnersSummarySection({
  prizeData,
  className,
}: WeeklyWinnersSummarySectionProps) {
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

  const rows = chunkWinners(uniqueWinners, 2);

  return (
    <section
      aria-label="Weekly Winners"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Weekly top scores ($10)</p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
        {rows.length > 0 ? (
          <table className="w-full">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={`row-${rowIndex}`}
                  className={rowIndex < rows.length - 1 ? "border-b border-white/10" : ""}
                >
                  {row.map((winner) => (
                    <td
                      key={winner.teamName}
                      className="px-3 py-2.5 align-top"
                    >
                      <div className="flex items-center gap-2">
                        <TeamLogo logoURL={winner.logoURL} label={winner.teamName} />
                        <div className="min-w-0 flex items-center gap-1">
                          <span className="font-heading flex-1 truncate text-[0.5rem] uppercase tracking-wide text-white/80">
                            {winner.teamName}
                          </span>
                          <span className="font-field text-right text-[0.7rem] text-[var(--tide)]">
                            x{winner.wins}
                          </span>
                        </div>
                      </div>
                    </td>
                  ))}
                  {row.length < 2 && <td className="px-3 py-2.5" />}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-center text-[0.65rem] text-white/60">
            No weeks recorded yet.
          </div>
        )}
        <div className="border-t border-white/5">
          <ListFooterButton onClick={navigateToBreakdown}>
            See weekly scores
          </ListFooterButton>
        </div>
      </div>
    </section>
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {winners.length > 0 ? (
            winners.map((winner, index) => (
              <tr
                key={winner.week}
                className={`hover:bg-white/5 ${index < winners.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <span className="font-heading text-[0.6rem] uppercase text-white/50">
                    W{winner.week}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TeamLogo logoURL={winner.logoURL} label={winner.teamName} />
                    <span className="font-heading text-[0.68rem] uppercase tracking-wide text-white/80">
                      {winner.teamName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-sports text-[0.75rem] text-[var(--ember)]">
                    {Math.round(winner.score)}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-2.5 text-center text-[0.65rem] text-white/60" colSpan={3}>
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

function chunkWinners(winners: WinnerSummary[], columns: number) {
  const rows: WinnerSummary[][] = [];
  for (let index = 0; index < winners.length; index += columns) {
    rows.push(winners.slice(index, index + columns));
  }
  return rows;
}

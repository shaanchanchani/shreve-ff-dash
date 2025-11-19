import { SwipeCard } from "./swipe-card";
import { TeamLogo } from "../common/team-logo";
import type { PrizeData, TeamSummary } from "@/types/prizes";
import { formatCurrency, getTeamLogo } from "@/lib/prize-calculations";

interface PayoutPictureCardProps {
  prizeData: PrizeData;
  teamSummaries: TeamSummary[];
}

export function PayoutPictureCard({
  prizeData,
  teamSummaries,
}: PayoutPictureCardProps) {
  return (
    <SwipeCard aria-label="Projected Payouts">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl uppercase">Payout Picture</h2>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full">
          <thead className="border-b border-white/10">
            <tr className="text-xs uppercase text-white/60">
              <th className="p-3 text-left">Team</th>
              <th className="p-3 text-right">Min</th>
              <th className="p-3 text-right">Max</th>
            </tr>
          </thead>
          <tbody>
            {teamSummaries.map(({ teamName, minPayout, maxPayout }, index) => (
              <tr
                key={teamName}
                className={`border-white/5 hover:bg-white/5 ${index < teamSummaries.length - 1 ? "border-b" : ""}`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      logoURL={getTeamLogo(prizeData, teamName)}
                      label={teamName}
                    />
                    <span className="font-heading text-sm uppercase">
                      {teamName}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <span className="font-sports text-xl text-[var(--tide)]">
                    {formatCurrency(minPayout)}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className="font-sports text-xl text-[var(--ember)]">
                    {formatCurrency(maxPayout)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SwipeCard>
  );
}

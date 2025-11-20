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
    <section aria-label="Projected Payouts">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)]">
        <table className="w-full">
          <thead className="border-b border-white/10">
            <tr className="text-[0.58rem] uppercase tracking-[0.2em] text-white/60">
              <th className="px-3 py-2.5 text-left">Team</th>
              <th className="px-3 py-2.5 text-right">Min</th>
              <th className="px-3 py-2.5 text-right">Max</th>
            </tr>
          </thead>
          <tbody>
            {teamSummaries.map(({ teamName, minPayout, maxPayout }, index) => (
              <tr
                key={teamName}
                className={`border-white/5 hover:bg-white/5 ${index < teamSummaries.length - 1 ? "border-b" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      logoURL={getTeamLogo(prizeData, teamName)}
                      label={teamName}
                    />
                    <span className="font-heading text-[0.68rem] uppercase tracking-wide">
                      {teamName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-sports text-[0.75rem] text-[var(--tide)]">
                    {formatCurrency(minPayout)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-sports text-[0.75rem] text-[var(--ember)]">
                    {formatCurrency(maxPayout)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

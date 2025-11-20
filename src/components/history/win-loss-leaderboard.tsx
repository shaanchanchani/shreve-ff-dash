"use client";

import { TeamLogo } from "@/components/common/team-logo";

export type LedgerOwnerRow = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logoURL?: string;
  wins: number;
  losses: number;
  ties: number;
  recordLabel: string;
  winPct: number;
  games: number;
  pointsPerGame: number;
  pointsFor: number;
  seasonsParticipated: number;
};

type Props = {
  owners: LedgerOwnerRow[];
};

export function WinLossLeaderboard({ owners }: Props) {
  if (!owners.length) {
    return null;
  }

  return (
    <section>
      <div className="card-surface overflow-hidden rounded-xl border border-white/10 text-[0.65rem]">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[0.5rem] uppercase tracking-[0.2em] text-white/40">
              <th className="px-3 py-3 font-normal">Team</th>
              <th className="px-3 py-3 text-right font-normal">Record</th>
              <th className="px-3 py-3 text-right font-normal">Win%</th>
              <th className="px-3 py-3 text-right font-normal">PF/G</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner, index) => (
              <tr
                key={owner.ownerKey}
                className="border-t border-white/5 text-white/80 transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <TeamLogo
                        logoURL={owner.logoURL}
                        label={owner.ownerName}
                        className="size-7"
                      />
                      <span className="font-heading absolute -bottom-1 -right-1 rounded bg-white px-1 text-[0.4rem] font-bold text-black">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-heading text-[0.6rem] uppercase tracking-wide text-white">
                        {owner.ownerName}
                      </p>
                      <p className="text-[0.5rem] uppercase tracking-[0.15em] text-white/40">
                        {owner.latestTeamName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-sports text-lg text-[var(--mist)] leading-none">
                  {owner.recordLabel}
                </td>
                <td className="px-3 py-2.5 text-right font-sports text-sm text-white/70">
                  {owner.winPct.toFixed(3)}
                </td>
                <td className="px-3 py-2.5 text-right font-sports text-sm text-white/70">
                  {owner.pointsPerGame.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

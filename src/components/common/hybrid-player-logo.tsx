/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

const playerHeadshots: Record<string, string> = {
  "T.Atwell":
    "https://static.www.nfl.com/image/upload/f_auto,q_auto/league/hpvbp9pn7ifbh62nde0n",
  "M.Stafford":
    "https://static.www.nfl.com/image/upload/f_auto,q_auto/league/xdlnnbapdbk8trxqlasu",
  "J.Taylor":
    "https://static.www.nfl.com/image/upload/f_auto,q_auto/league/ye4runp84oku1vnodsa7",
};

interface HybridPlayerLogoProps {
  teamLogoURL?: string;
  playerName?: string;
  teamLabel?: string;
  className?: string;
}

export function HybridPlayerLogo({
  teamLogoURL,
  playerName,
  teamLabel,
  className,
}: HybridPlayerLogoProps) {
  const playerHeadshotURL = playerName ? playerHeadshots[playerName] : null;

  return (
    <div className={cn("relative h-8 w-8", className)}>
      <div className="absolute left-0 top-0 z-10 h-5 w-5">
        {teamLogoURL ? (
          <img
            src={teamLogoURL}
            alt={teamLabel ?? "team logo"}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="font-heading grid h-full w-full place-items-center rounded-full bg-white/5 text-[0.55rem] uppercase text-white/70">
            {teamLabel?.slice(0, 2)}
          </span>
        )}
      </div>

      <div className="absolute bottom-0 right-0 z-20 h-6 w-6">
        {playerHeadshotURL ? (
          <img
            src={playerHeadshotURL}
            alt={playerName ?? "player"}
            className="h-full w-full rounded-full object-cover bg-transparent"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-white/5" />
        )}
      </div>
    </div>
  );
}

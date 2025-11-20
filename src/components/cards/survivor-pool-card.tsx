import { useRouter } from "next/navigation";
import { TeamLogo } from "../common/team-logo";
import type { PrizeData } from "@/types/prizes";
import { getSurvivingTeams, getTeamLogo } from "@/lib/prize-calculations";
import {
  DASHBOARD_RETURN_CARD_STORAGE_KEY,
  SURVIVOR_CARD_ID,
} from "@/lib/dashboard-navigation";
import { CondensedTeamList } from "./condensed-team-list";
import { ListFooterButton } from "./list-footer-button";
import { cn } from "@/lib/utils";

interface SurvivorPoolCardProps {
  prizeData: PrizeData;
}

type SurvivorElimination = PrizeData["survivorEliminations"][number];

interface SurvivingTeam {
  teamName: string;
  logoURL?: string;
}

const SURVIVOR_BREAKDOWN_ROUTE = "/survivor";
const sectionHeadingClass =
  "font-heading text-[0.6rem] uppercase tracking-[0.2em] text-white/50 leading-tight";

export function SurvivorPoolCard({ prizeData }: SurvivorPoolCardProps) {
  return (
    <section aria-label="Survivor Pool">
      <SurvivorSummarySection prizeData={prizeData} />
    </section>
  );
}

interface SurvivorSummarySectionProps extends SurvivorPoolCardProps {
  className?: string;
}

export function SurvivorSummarySection({
  prizeData,
  className,
}: SurvivorSummarySectionProps) {
  const router = useRouter();
  const survivingTeams = buildSurvivingTeams(prizeData);

  const navigateToBreakdown = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        DASHBOARD_RETURN_CARD_STORAGE_KEY,
        SURVIVOR_CARD_ID,
      );
    }
    router.push(SURVIVOR_BREAKDOWN_ROUTE);
  };

  return (
    <section
      aria-label="Survivor Pool"
      className={cn("space-y-3", className)}
    >
      <p className={sectionHeadingClass}>Survivors ($10)</p>

      <div>
        <SurvivorTeamsSection
          survivingTeams={survivingTeams}
          onBreakdown={navigateToBreakdown}
        />
      </div>
    </section>
  );
}

export function SurvivorBreakdownContent({ prizeData }: SurvivorPoolCardProps) {
  const eliminations = getSortedEliminations(prizeData);
  const survivingTeams = buildSurvivingTeams(prizeData);

  return (
    <>
      <SurvivorEliminationsTable eliminations={eliminations} />

      <div className="mt-6">
        <SurvivorTeamsSection survivingTeams={survivingTeams} />
      </div>
    </>
  );
}

function SurvivorEliminationsTable({
  eliminations,
}: {
  eliminations: SurvivorElimination[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]">
      <table className="w-full">
        <tbody>
          {eliminations.length > 0 ? (
            eliminations.map((elimination, index) => (
              <tr
                key={elimination.week}
                className={`hover:bg-white/5 ${index < eliminations.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <span className="font-heading text-[0.65rem] uppercase text-white/50">
                    W{elimination.week}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      logoURL={elimination.logoURL}
                      label={elimination.teamName}
                    />
                    <span className="font-heading text-[0.65rem] uppercase tracking-wide text-white/80">
                      {elimination.teamName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-sports text-[0.72rem] text-[var(--ember)]">
                    {Math.round(elimination.score)}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-2.5 text-center text-xs text-white/60" colSpan={3}>
                No eliminations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SurvivorTeamsSection({
  survivingTeams,
  onBreakdown,
}: {
  survivingTeams: SurvivingTeam[];
  onBreakdown?: () => void;
}) {
  const condensedItems = survivingTeams.map((team) => ({
    teamName: team.teamName,
    logoURL: team.logoURL,
  }));

  return (
    <div>
      {survivingTeams.length > 1 ? (
        onBreakdown ? (
          <CondensedTeamList
            items={condensedItems}
            footerLabel="See Weekly eliminations"
            onFooterClick={onBreakdown}
            emptyMessage="All teams eliminated."
          />
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[var(--surface)]">
            <table className="w-full">
              <tbody>
                {survivingTeams.map((team, index) => (
                  <tr
                    key={team.teamName}
                    className={`hover:bg-white/5 ${index < survivingTeams.length - 1 ? "border-b border-white/5" : ""}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <TeamLogo
                          logoURL={team.logoURL}
                          label={team.teamName}
                        />
                        <span className="font-heading text-[0.65rem] uppercase tracking-wide text-white/80">
                          {team.teamName}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : survivingTeams.length === 1 ? (
        <div className="overflow-hidden rounded-xl border border-green-400/30 bg-green-900/20 text-center">
          <div className="px-4 py-6">
            <div className="mb-3 flex items-center justify-center gap-3">
              <TeamLogo
                logoURL={survivingTeams[0].logoURL}
                label={survivingTeams[0].teamName}
              />
              <div>
                <div className="font-field text-[0.7rem] uppercase text-[var(--ember)]">
                  {survivingTeams[0].teamName}
                </div>
                <div className="font-heading text-[0.6rem] uppercase text-green-400">
                  Survivor Winner!
                </div>
              </div>
            </div>
            <div className="font-sports text-[0.65rem] text-[var(--tide)]">
              Wins $10!
            </div>
          </div>
          {onBreakdown && (
            <ListFooterButton onClick={onBreakdown}>
              See Weekly eliminations
            </ListFooterButton>
          )}
        </div>
      ) : (
        onBreakdown ? (
          <CondensedTeamList
            items={[]}
            footerLabel="See Weekly eliminations"
            onFooterClick={onBreakdown}
            emptyMessage="All teams eliminated."
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-[var(--surface)] py-6 text-center text-xs text-white/60">
            All teams eliminated.
          </div>
        )
      )}
    </div>
  );
}

function getSortedEliminations(prizeData: PrizeData) {
  return [...prizeData.survivorEliminations].sort((a, b) => b.week - a.week);
}

function buildSurvivingTeams(prizeData: PrizeData): SurvivingTeam[] {
  const survivingTeamNames = getSurvivingTeams(prizeData);
  return survivingTeamNames.map((teamName) => ({
    teamName,
    logoURL: getTeamLogo(prizeData, teamName),
  }));
}

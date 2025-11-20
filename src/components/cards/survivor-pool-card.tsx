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

interface SurvivorPoolCardProps {
  prizeData: PrizeData;
}

type SurvivorElimination = PrizeData["survivorEliminations"][number];

interface SurvivingTeam {
  teamName: string;
  logoURL?: string;
}

const SURVIVOR_BREAKDOWN_ROUTE = "/survivor";

export function SurvivorPoolCard({ prizeData }: SurvivorPoolCardProps) {
  return (
    <section aria-label="Survivor Pool">
      <SurvivorSummarySection prizeData={prizeData} />
    </section>
  );
}

export function SurvivorSummarySection({ prizeData }: SurvivorPoolCardProps) {
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
    <>
      <p className="mb-3 text-sm uppercase text-white/60">
        Survivor Pool ($10)
      </p>

      <div className="mt-6">
        <SurvivorTeamsSection
          survivingTeams={survivingTeams}
          onBreakdown={navigateToBreakdown}
        />
      </div>
    </>
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <table className="w-full">
        <tbody>
          {eliminations.length > 0 ? (
            eliminations.map((elimination, index) => (
              <tr
                key={elimination.week}
                className={`hover:bg-white/5 ${index < eliminations.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <td className="p-3">
                  <span className="font-heading text-xs uppercase text-white/50">
                    W{elimination.week}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      logoURL={elimination.logoURL}
                      label={elimination.teamName}
                    />
                    <span className="text-sm text-white/80">
                      {elimination.teamName}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <span className="font-sports text-xl text-[var(--ember)]">
                    {Math.round(elimination.score)}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-3 text-center text-sm text-white/60" colSpan={3}>
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
            footerLabel="See Week Breakdown"
            onFooterClick={onBreakdown}
            emptyMessage="All teams eliminated."
          />
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
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
                        <span className="text-sm text-white/80">
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
                <div className="font-field text-xl uppercase text-[var(--ember)]">
                  {survivingTeams[0].teamName}
                </div>
                <div className="font-heading text-sm uppercase text-green-400">
                  Survivor Winner!
                </div>
              </div>
            </div>
            <div className="font-sports text-2xl text-[var(--tide)]">
              Wins $10!
            </div>
          </div>
          {onBreakdown && (
            <ListFooterButton onClick={onBreakdown}>
              See Week Breakdown
            </ListFooterButton>
          )}
        </div>
      ) : (
        onBreakdown ? (
          <CondensedTeamList
            items={[]}
            footerLabel="See Week Breakdown"
            onFooterClick={onBreakdown}
            emptyMessage="All teams eliminated."
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 py-6 text-center text-white/60">
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

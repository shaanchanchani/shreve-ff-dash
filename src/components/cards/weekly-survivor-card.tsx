import type { PrizeData } from "@/types/prizes";
import { WeeklyWinnersSummarySection } from "./weekly-winners-card";
import { SurvivorSummarySection } from "./survivor-pool-card";

interface WeeklySurvivorCardProps {
  prizeData: PrizeData;
}

export function WeeklySurvivorCard({ prizeData }: WeeklySurvivorCardProps) {
  return (
    <section
      aria-label="Weekly Winners and Survivor Pool"
      className="space-y-8"
    >
      <WeeklyWinnersSummarySection prizeData={prizeData} />
      <div className="my-8 h-px w-full bg-white/10" />
      <SurvivorSummarySection prizeData={prizeData} />
    </section>
  );
}

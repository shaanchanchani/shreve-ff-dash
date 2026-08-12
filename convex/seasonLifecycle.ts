export type SeasonStatus = "planned" | "preseason" | "active" | "complete";

export const normalizeSleeperSeasonStatus = ({
  leagueStatus,
  nflSeasonType,
  nflWeek,
}: {
  leagueStatus?: string | null;
  nflSeasonType?: string | null;
  nflWeek?: number | null;
}): SeasonStatus => {
  if (leagueStatus === "complete") return "complete";
  if (leagueStatus === "in_season") return "active";
  if (leagueStatus === "pre_draft" || leagueStatus === "drafting") {
    return "preseason";
  }
  if (nflSeasonType === "post") return "complete";
  if (nflSeasonType === "regular" && (nflWeek ?? 0) > 0) return "active";
  return "preseason";
};

const statusOrder: Record<SeasonStatus, number> = {
  planned: 0,
  preseason: 1,
  active: 2,
  complete: 3,
};

export const seasonStatusCanAdvance = (
  current: SeasonStatus,
  next: SeasonStatus,
) => statusOrder[next] >= statusOrder[current];

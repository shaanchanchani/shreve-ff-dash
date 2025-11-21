import { OwnerSummary } from "@/types/history";

export const MANUAL_OWNER_GROUPS = [
  {
    aliasKey: "joon-kim",
    displayName: "Joon Kim",
    ownerNames: ["녑비 주", "Joon Kim"],
    teamNames: ["Team R Kelly", "Team kenneth carson"],
  },
] as const;

export const matchAlias = (ownerName?: string, teamName?: string) => {
  if (!ownerName && !teamName) return null;
  const normalizedOwner = ownerName?.toLowerCase().trim();
  const normalizedTeam = teamName?.toLowerCase().trim();

  return (
    MANUAL_OWNER_GROUPS.find((group) => {
      const ownerMatch = normalizedOwner
        ? group.ownerNames.some(
            (name) => name.toLowerCase().trim() === normalizedOwner,
          )
        : false;
      const teamMatch = normalizedTeam
        ? group.teamNames.some(
            (name) => name.toLowerCase().trim() === normalizedTeam,
          )
        : false;
      return ownerMatch || teamMatch;
    }) ?? null
  );
};

export const canonicalOwnerKey = (
  rawKey: string,
  ownerName?: string,
  teamName?: string,
) => {
  const alias = matchAlias(ownerName, teamName);
  return alias?.aliasKey ?? rawKey;
};

export type AggregatedOwner = {
  ownerKey: string;
  ownerName: string;
  latestTeamName: string;
  logos: OwnerSummary["logos"];
  seasonsParticipated: number;
};

export const aggregateOwners = (owners: OwnerSummary[]) => {
  type InternalMeta = AggregatedOwner & { seasonSet: Set<number> };
  const metaMap = new Map<string, InternalMeta>();

  owners.forEach((owner) => {
    const alias = matchAlias(owner.ownerName, owner.latestTeamName);
    const key = alias?.aliasKey ?? owner.ownerKey;
    const displayName = alias?.displayName ?? owner.ownerName;

    const existing = metaMap.get(key);
    if (!existing) {
      const seasonSet = new Set<number>();
      owner.logos.forEach((logo) => seasonSet.add(logo.seasonId));
      metaMap.set(key, {
        ownerKey: key,
        ownerName: displayName,
        latestTeamName: owner.latestTeamName,
        logos: [...owner.logos],
        seasonsParticipated: seasonSet.size || owner.seasonsParticipated,
        seasonSet,
      });
    } else {
      existing.latestTeamName = owner.latestTeamName;
      owner.logos.forEach((logo) => {
        existing.logos.push(logo);
        existing.seasonSet.add(logo.seasonId);
      });
      existing.ownerName = displayName;
      existing.seasonsParticipated = existing.seasonSet.size;
    }
  });

  const output = new Map<string, AggregatedOwner>();
  metaMap.forEach((meta, key) => {
    output.set(key, {
      ownerKey: key,
      ownerName: meta.ownerName,
      latestTeamName: meta.latestTeamName,
      logos: meta.logos,
      seasonsParticipated: meta.seasonSet.size || meta.seasonsParticipated,
    });
  });

  return output;
};

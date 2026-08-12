export type SleeperLeaguePayload = {
  league_id: string;
  season: string;
  draft_id?: string | null;
  previous_league_id?: string | null;
  roster_positions?: string[] | null;
};

export type SleeperMatchupPayload = {
  roster_id: number;
  matchup_id?: number | null;
  points?: number | null;
  custom_points?: number | null;
  players?: string[] | null;
  starters?: string[] | null;
  players_points?: Record<string, number | null> | null;
};

export type SleeperPlayerPayload = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
  active?: boolean | null;
  espn_id?: string | number | null;
};

export type NormalizedWeek = {
  externalMatchupId: string;
  participants: Array<{
    externalTeamId: string;
    slot: 1 | 2;
    score: number;
    providerScore: number;
    commissionerAdjustment: number;
    result: "pending" | "win" | "loss" | "tie";
    roster: Array<{
      externalPlayerId: string;
      fullName: string;
      position?: string;
      nflTeam?: string;
      rosterSlot: string;
      started: boolean;
      points: number;
    }>;
  }>;
};

const resultFor = (score: number, opponentScore: number, final: boolean) => {
  if (!final) return "pending" as const;
  if (score > opponentScore) return "win" as const;
  if (score < opponentScore) return "loss" as const;
  return "tie" as const;
};

export const sleeperPlayerName = (
  externalPlayerId: string,
  player?: SleeperPlayerPayload,
) =>
  player?.full_name?.trim() ||
  [player?.first_name, player?.last_name].filter(Boolean).join(" ").trim() ||
  `Sleeper Player ${externalPlayerId}`;

export const collectSleeperWeekPlayerIds = (
  rawMatchups: SleeperMatchupPayload[],
) =>
  Array.from(
    new Set(
      rawMatchups.flatMap((participant) => participant.players ?? []),
    ),
  );

export const normalizeSleeperWeek = ({
  league,
  rawMatchups,
  playerCatalog,
  week,
  state,
}: {
  league: SleeperLeaguePayload;
  rawMatchups: SleeperMatchupPayload[];
  playerCatalog: Record<string, SleeperPlayerPayload>;
  week: number;
  state: "scheduled" | "live" | "final";
}) => {
  const issues: string[] = [];
  const byeRosterIds: string[] = [];
  const grouped = new Map<string, SleeperMatchupPayload[]>();

  for (const participant of rawMatchups) {
    if (participant.matchup_id == null) {
      byeRosterIds.push(String(participant.roster_id));
      continue;
    }
    const key = String(participant.matchup_id);
    const participants = grouped.get(key) ?? [];
    participants.push(participant);
    grouped.set(key, participants);
  }

  for (const [matchupId, participants] of grouped) {
    if (participants.length !== 2) {
      issues.push(
        `Matchup ${matchupId} has ${participants.length} participants instead of 2.`,
      );
    } else if (participants[0].roster_id === participants[1].roster_id) {
      issues.push(`Matchup ${matchupId} contains the same Roster twice.`);
    }
    for (const participant of participants) {
      const rosterPlayers = new Set(participant.players ?? []);
      for (const starter of participant.starters ?? []) {
        if (starter !== "0" && !rosterPlayers.has(starter)) {
          issues.push(
            `Roster ${participant.roster_id} starts Player ${starter} without rostering it.`,
          );
        }
      }
    }
  }

  if (issues.length > 0) {
    return { matchups: [] as NormalizedWeek[], byeRosterIds, issues };
  }

  const starterSlots = (league.roster_positions ?? []).filter(
    (slot) => !["BN", "IR", "TAXI"].includes(slot),
  );
  const final = state === "final";
  const matchups = Array.from(grouped.entries()).map(
    ([externalMatchupId, inputs]): NormalizedWeek => {
      const sorted = [...inputs].sort(
        (left, right) => left.roster_id - right.roster_id,
      );
      const scores = sorted.map((participant) => {
        const providerScore =
          typeof participant.points === "number" ? participant.points : 0;
        const score =
          typeof participant.custom_points === "number"
            ? participant.custom_points
            : providerScore;
        return { score, providerScore };
      });

      return {
        externalMatchupId: `${week}:${externalMatchupId}`,
        participants: sorted.map((participant, index) => {
          const starters = participant.starters ?? [];
          const starterIndex = new Map(
            starters.map((externalPlayerId, slotIndex) => [
              externalPlayerId,
              slotIndex,
            ]),
          );
          const roster = (participant.players ?? []).map(
            (externalPlayerId) => {
              const player = playerCatalog[externalPlayerId];
              const indexInStarters = starterIndex.get(externalPlayerId);
              const started = indexInStarters !== undefined;
              return {
                externalPlayerId,
                fullName: sleeperPlayerName(externalPlayerId, player),
                ...(player?.position ? { position: player.position } : {}),
                ...(player?.team ? { nflTeam: player.team } : {}),
                rosterSlot: started
                  ? (starterSlots[indexInStarters] ??
                    player?.position ??
                    "START")
                  : "BN",
                started,
                points: participant.players_points?.[externalPlayerId] ?? 0,
              };
            },
          );
          const opponent = scores[index === 0 ? 1 : 0];
          const own = scores[index];
          return {
            externalTeamId: String(participant.roster_id),
            slot: (index === 0 ? 1 : 2) as 1 | 2,
            score: own.score,
            providerScore: own.providerScore,
            commissionerAdjustment: own.score - own.providerScore,
            result: resultFor(own.score, opponent.score, final),
            roster,
          };
        }),
      };
    },
  );

  return { matchups, byeRosterIds, issues };
};

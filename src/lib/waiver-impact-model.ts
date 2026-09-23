import type { HistoricalMatchup, HistoricalMatchupTeam, HistoricalPlayer } from "../types/history";
import { canonicalOwnerKey } from "./owner-utils.ts";

export type ImpactPosition = "QB" | "RB" | "WR" | "TE" | "D/ST";
export type ImpactPositionFilter = "offense" | ImpactPosition;
export const BIG_START_POINTS = 5;
const EPSILON = 1e-8;

export type ImpactStart = {
  week: number;
  score: number;
  benchmark: number;
  replacementName: string;
  impact: number;
  benchmarkSize: number;
};
export type PickupImpact = {
  key: string;
  ownerKey: string;
  ownerName: string;
  playerName: string;
  headshotURL?: string;
  season: number;
  position: ImpactPosition;
  impact: number;
  points: number;
  starts: number;
  bigStarts: number;
  swingWins: number;
  inferredStarts: number;
  bestStart: ImpactStart;
};
export type ManagerImpact = {
  ownerKey: string;
  ownerName: string;
  impact: number;
  starts: number;
  bigStarts: number;
  swingWins: number;
  games: number;
  pickups: PickupImpact[];
};
export type WaiverImpactResult = {
  pickups: PickupImpact[];
  managers: ManagerImpact[];
  skippedStarts: number;
  inferredStarts: number;
};

const positionOf = (player: HistoricalPlayer): ImpactPosition | null => {
  const position = player.realPosition;
  if (position === "DEF" || position === "DST" || position === "D/ST") return "D/ST";
  return ["QB", "RB", "WR", "TE"].includes(position ?? "") ? position as ImpactPosition : null;
};
const isStarter = (player: HistoricalPlayer) =>
  !["BN", "Bench", "IR"].includes(player.position) && Number.isFinite(player.points);
const fitsSlot = (bench: HistoricalPlayer, starter: HistoricalPlayer) => {
  const position = positionOf(bench);
  if (!position) return false;
  switch (starter.position) {
    case "FLEX": case "RB/WR/TE": return ["RB", "WR", "TE"].includes(position);
    case "RB/WR": return ["RB", "WR"].includes(position);
    case "WR/TE": return ["WR", "TE"].includes(position);
    case "SUPER_FLEX": case "SUPERFLEX": case "SF": case "OP": case "QB/RB/WR/TE":
      return position !== "D/ST";
    case "DEF": case "DST": case "D/ST": return position === "D/ST";
    case "QB": case "RB": case "WR": case "TE": return position === starter.position;
    default: return false;
  }
};

/** Fill as many pickup slots as possible, then maximize actual bench points.
 * Assign jointly so a bench player cannot fill two slots. Stable ordering breaks
 * ties; filters never change the assignments. Other actual starters stay put.
 */
function benchReplacements(starters: HistoricalPlayer[], bench: HistoricalPlayer[]) {
  const choices = [...bench].sort((a,b) => b.points-a.points || String(a.id).localeCompare(String(b.id)));
  const slots = [...starters].sort((a,b) =>
    choices.filter(p => fitsSlot(p,a)).length - choices.filter(p => fitsSlot(p,b)).length ||
    String(a.id).localeCompare(String(b.id)));
  type Assignment = { count: number; points: number; players: (HistoricalPlayer | null)[] };
  const memo = new Map<string, Assignment>();
  const solve = (index: number, used: Set<number>): Assignment => {
    if (index === slots.length) return {count:0, points:0, players:[]};
    const key = `${index}:${[...used].sort((a,b)=>a-b).join(",")}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best: Assignment | undefined;
    for (let i=0; i<choices.length; i++) {
      if (used.has(i) || !fitsSlot(choices[i],slots[index])) continue;
      used.add(i);
      const next = solve(index+1,used);
      used.delete(i);
      const candidate = {count:next.count+1, points:next.points+choices[i].points, players:[choices[i],...next.players]};
      if (!best || candidate.count > best.count ||
        (candidate.count === best.count && candidate.points > best.points + EPSILON)) best = candidate;
    }
    const next = solve(index+1,used);
    const skipped = {...next, players:[null,...next.players]};
    if (!best || skipped.count > best.count ||
      (skipped.count === best.count && skipped.points > best.points + EPSILON)) best = skipped;
    memo.set(key,best);
    return best;
  };
  const result = solve(0,new Set());
  return new Map(slots.map((player,index) => [String(player.id),result.players[index]]));
}
const ownerKey = (team: HistoricalMatchupTeam) => canonicalOwnerKey(team.ownerKey, team.ownerName, team.teamName);
const rankPickups = (a: PickupImpact, b: PickupImpact) => b.impact - a.impact || b.bigStarts - a.bigStarts || a.key.localeCompare(b.key);

/**
 * Final-week canonical history only. Attribution is supplied by the backend:
 * don't infer pickups again, and don't use its old top-24 raw-points metric.
 * Replacement = an eligible bench player on that manager's roster that week.
 * This is a hindsight lineup comparison, not acquisition value or a projection.
 * Apply position filters after assigning distinct replacements to all pickups.
 */
export function buildWaiverImpact(matchups: HistoricalMatchup[], filter: ImpactPositionFilter = "offense"): WaiverImpactResult {
  const weeks = new Map<string, HistoricalMatchup[]>();
  const seenGames = new Set<string>();
  for (const game of matchups) {
    if (seenGames.has(game.id)) continue;
    seenGames.add(game.id);
    const key = `${game.seasonId}:${game.week}`;
    const slate = weeks.get(key) ?? [];
    slate.push(game);
    weeks.set(key, slate);
  }
  const pickups = new Map<string, PickupImpact>();
  const managers = new Map<string, ManagerImpact>();
  let skippedStarts = 0;
  let inferredStarts = 0;
  for (const games of weeks.values()) {
    const teams = games.flatMap(game => [game.home, game.away]);
    // Multiple snapshots for one team/week cannot safely be combined.
    if (new Set(teams.map(t => String(t.teamId))).size !== teams.length) continue;
    const field = teams.flatMap(team => team.rosterUnavailable ? [] : (team.roster ?? []));
    const occurrences = new Map<string, number>();
    for (const player of field) occurrences.set(String(player.id), (occurrences.get(String(player.id)) ?? 0) + 1);

    for (const game of games) for (const [team, opponent] of [[game.home, game.away], [game.away, game.home]]) {
      if (team.rosterUnavailable || !Number.isFinite(team.score) || !Number.isFinite(opponent.score)) continue;
      const key = ownerKey(team);
      const allCandidates = (team.roster ?? []).filter(player =>
        isStarter(player) && player.wasDraftedByTeam === false && positionOf(player));
      const candidates = allCandidates.filter(player =>
        filter === "offense" ? positionOf(player) !== "D/ST" : positionOf(player) === filter);
      if (!candidates.length) continue;
      const bench = (team.roster ?? []).filter(player =>
        ["BN", "Bench"].includes(player.position) && Number.isFinite(player.points) &&
        occurrences.get(String(player.id)) === 1);
      const replacements = benchReplacements(allCandidates.filter(player => occurrences.get(String(player.id)) === 1),bench);
      let gameImpact = 0;
      let measured = 0;
      let missing = false;
      for (const player of candidates) {
        const position = positionOf(player)!;
        const replacement = replacements.get(String(player.id));
        if (!replacement || occurrences.get(String(player.id)) !== 1) {
          skippedStarts++; missing = true; continue;
        }
        const benchmark = replacement.points;
        const impact = player.points - benchmark;
        const inferred = player.waiverEvidence !== "transaction";
        const pickupKey = `${key}:${game.seasonId}:${player.id}`;
        const start = {week:game.week, score:player.points, benchmark, replacementName:replacement.name,
          impact, benchmarkSize:bench.filter(p => fitsSlot(p,player)).length};
        const pickup = pickups.get(pickupKey) ?? {
          key:pickupKey, ownerKey:key, ownerName:team.ownerName, playerName:player.name,
          ...(player.headshotURL ? {headshotURL:player.headshotURL} : {}),
          season:game.seasonId, position, impact:0, points:0, starts:0, bigStarts:0,
          swingWins:0, inferredStarts:0, bestStart:start,
        };
        pickup.impact += impact;
        pickup.points += player.points;
        pickup.starts++;
        pickup.bigStarts += Number(impact >= BIG_START_POINTS - EPSILON);
        pickup.swingWins += Number(team.score > opponent.score && impact >= team.score - opponent.score - EPSILON);
        pickup.inferredStarts += Number(inferred);
        if (impact > pickup.bestStart.impact || (impact === pickup.bestStart.impact && game.week < pickup.bestStart.week)) pickup.bestStart = start;
        pickups.set(pickupKey, pickup);
        inferredStarts += Number(inferred);
        gameImpact += impact;
        measured++;
      }
      if (!measured) continue;
      const manager = managers.get(key) ?? {ownerKey:key, ownerName:team.ownerName, impact:0, starts:0, bigStarts:0, swingWins:0, games:0, pickups:[]};
      manager.impact += gameImpact;
      manager.starts += measured;
      manager.games++;
      // Replace all measured pickups together. Count a game once, not once for
      // every player whose individual contribution exceeds a narrow win margin.
      manager.swingWins += Number(!missing && team.score > opponent.score && gameImpact >= team.score - opponent.score - EPSILON);
      managers.set(key, manager);
    }
  }
  const ranked = [...pickups.values()].sort(rankPickups);
  for (const pickup of ranked) {
    const manager = managers.get(pickup.ownerKey)!;
    manager.pickups.push(pickup);
    manager.bigStarts += pickup.bigStarts;
  }
  return {
    pickups:ranked,
    managers:[...managers.values()].sort((a,b) => b.impact-a.impact || a.ownerKey.localeCompare(b.ownerKey)),
    skippedStarts,
    inferredStarts,
  };
}

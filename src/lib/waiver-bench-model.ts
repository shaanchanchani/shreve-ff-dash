import type { HistoricalMatchup, HistoricalMatchupTeam, HistoricalPlayer } from "../types/history";
import { canonicalOwnerKey } from "./owner-utils.ts";
import { fitsSlot, positionOf, type ImpactPosition, type ImpactPositionFilter } from "./waiver-impact-model.ts";

const EPSILON = 1e-8;
const isBench = (player: HistoricalPlayer) => ["BN", "Bench"].includes(player.position);
const ownerKey = (team: HistoricalMatchupTeam) => canonicalOwnerKey(team.ownerKey, team.ownerName, team.teamName);

export type BenchComparison = {
  teamId: string;
  ownerKey: string;
  ownerName: string;
  playerName: string;
  slot: string;
  starterPoints: number;
  upgrade: number;
};
export type BenchWeek = {
  week: number;
  points: number;
  value: number;
  improvedLineups: number;
  comparisons: BenchComparison[];
  missingLineups: number;
};
export type BenchPickup = {
  key: string;
  ownerKey: string;
  ownerName: string;
  playerName: string;
  headshotURL?: string;
  season: number;
  position: ImpactPosition;
  benchValue: number;
  benchWeeks: number;
  valuableWeeks: number;
  improvedLineups: number;
  comparedLineups: number;
  inferredWeeks: number;
  partialWeeks: number;
  bestWeek: BenchWeek;
  weeks: BenchWeek[];
};
export type WaiverBenchResult = {
  pickups: BenchPickup[];
  skippedWeeks: number;
  inferredWeeks: number;
  missingComparisons: number;
};

/** Each pickup is a separate hindsight scenario on each other observed team.
 * Weekly value = mean positive upgrade across ALL comparable teams, including
 * zero upgrades. Never add these hypothetical points to actual starter impact.
 */
export function buildWaiverBenchValue(matchups: HistoricalMatchup[], filter: ImpactPositionFilter = "offense"): WaiverBenchResult {
  const weeks = new Map<string, HistoricalMatchup[]>();
  const seen = new Set<string>();
  for (const game of matchups) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    const key = `${game.seasonId}:${game.week}`;
    const games = weeks.get(key) ?? [];
    games.push(game);
    weeks.set(key,games);
  }
  const pickups = new Map<string, BenchPickup>();
  let skippedWeeks = 0;
  let inferredWeeks = 0;
  let missingComparisons = 0;
  const candidates = (team: HistoricalMatchupTeam) => team.rosterUnavailable ? [] : (team.roster ?? []).filter(player => {
    const position = positionOf(player);
    return isBench(player) && player.wasDraftedByTeam === false && position &&
      (filter === "offense" ? position !== "D/ST" : position === filter);
  });
  for (const games of weeks.values()) {
    const teams = games.flatMap(game => [game.home,game.away]);
    if (new Set(teams.map(team => String(team.teamId))).size !== teams.length) {
      skippedWeeks += teams.reduce((sum,team) => sum+candidates(team).length,0);
      continue;
    }
    const occurrences = new Map<string,number>();
    for (const team of teams) if (!team.rosterUnavailable) for (const player of team.roster ?? []) {
      occurrences.set(String(player.id),(occurrences.get(String(player.id)) ?? 0)+1);
    }
    for (const game of games) for (const team of [game.home,game.away]) for (const player of candidates(team)) {
      if (!Number.isFinite(player.points) || occurrences.get(String(player.id)) !== 1) {
        skippedWeeks++;
        continue;
      }
      const comparisons: BenchComparison[] = [];
      let missingLineups = 0;
      for (const other of teams) {
        if (String(other.teamId) === String(team.teamId)) continue;
        const slots = other.rosterUnavailable ? [] : (other.roster ?? []).filter(starter =>
          !isBench(starter) && starter.position !== "IR" && fitsSlot(player,starter));
        // An unknown eligible starter score could change the best substitution.
        if (!slots.length || slots.some(starter => !Number.isFinite(starter.points) || occurrences.get(String(starter.id)) !== 1)) {
          missingLineups++;
          continue;
        }
        const replacement = [...slots].sort((a,b) => a.points-b.points || String(a.id).localeCompare(String(b.id)))[0];
        const delta = player.points-replacement.points;
        comparisons.push({
          teamId:String(other.teamId),ownerKey:ownerKey(other),ownerName:other.ownerName,
          playerName:replacement.name,slot:replacement.position,starterPoints:replacement.points,
          upgrade:delta > EPSILON ? delta : 0,
        });
      }
      missingComparisons += missingLineups;
      if (!comparisons.length) {
        skippedWeeks++;
        continue;
      }
      comparisons.sort((a,b) => b.upgrade-a.upgrade || a.teamId.localeCompare(b.teamId));
      const value = comparisons.reduce((sum,item) => sum+item.upgrade,0)/comparisons.length;
      const improvedLineups = comparisons.filter(item => item.upgrade > 0).length;
      const week: BenchWeek = {week:game.week,points:player.points,value,improvedLineups,comparisons,missingLineups};
      const key = ownerKey(team);
      const pickupKey = `${key}:${game.seasonId}:${player.id}`;
      const pickup = pickups.get(pickupKey) ?? {
        key:pickupKey,ownerKey:key,ownerName:team.ownerName,playerName:player.name,
        ...(player.headshotURL ? {headshotURL:player.headshotURL} : {}),
        season:game.seasonId,position:positionOf(player)!,benchValue:0,benchWeeks:0,valuableWeeks:0,
        improvedLineups:0,comparedLineups:0,inferredWeeks:0,partialWeeks:0,bestWeek:week,weeks:[],
      };
      pickup.benchWeeks++;
      pickup.valuableWeeks += Number(improvedLineups > 0);
      pickup.improvedLineups += improvedLineups;
      pickup.comparedLineups += comparisons.length;
      pickup.inferredWeeks += Number(player.waiverEvidence !== "transaction");
      pickup.partialWeeks += Number(missingLineups > 0);
      pickup.weeks.push(week);
      pickups.set(pickupKey,pickup);
      inferredWeeks += Number(player.waiverEvidence !== "transaction");
    }
  }
  for (const pickup of pickups.values()) {
    pickup.weeks.sort((a,b) => a.week-b.week);
    pickup.benchValue = pickup.weeks.reduce((sum,week) => sum+week.value,0);
    pickup.bestWeek = [...pickup.weeks].sort((a,b) => b.value-a.value || b.improvedLineups-a.improvedLineups || a.week-b.week)[0];
  }
  return {
    pickups:[...pickups.values()].sort((a,b) => b.benchValue-a.benchValue || b.valuableWeeks-a.valuableWeeks || a.key.localeCompare(b.key)),
    skippedWeeks,inferredWeeks,missingComparisons,
  };
}

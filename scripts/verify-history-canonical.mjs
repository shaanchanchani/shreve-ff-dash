import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");

const client = new ConvexHttpClient(convexUrl);
const history = await client.query(makeFunctionReference("history:all"), {});
if (!history) throw new Error("No canonical history snapshot is available.");

const expectedSeasons = (process.env.EXPECTED_HISTORY_SEASONS ?? "2022,2023,2024,2025")
  .split(",")
  .map((year) => Number.parseInt(year.trim(), 10))
  .filter(Number.isFinite);
const actualSeasons = history.seasons
  .map((season) => season.seasonId)
  .sort((left, right) => left - right);
const missingSeasons = expectedSeasons.filter(
  (season) => !actualSeasons.includes(season),
);
const teams = history.seasons.flatMap((season) => season.teams);
const matchupTeams = history.matchups.flatMap((matchup) => [
  matchup.home,
  matchup.away,
]);
const players = matchupTeams.flatMap((team) => team.roster);
const numericTeamIds = [
  ...teams.map((team) => team.teamId),
  ...matchupTeams.map((team) => team.teamId),
].filter((id) => typeof id !== "string");
const numericPlayerIds = players.filter((player) => typeof player.id !== "string");
const emptyCanonicalIds = players.filter(
  (player) => typeof player.id !== "string" || player.id.trim().length === 0,
);
const unavailableRosters = matchupTeams.filter((team) => team.rosterUnavailable);
const failures = [];
if (missingSeasons.length > 0) failures.push("missing_seasons");
if (numericTeamIds.length > 0) failures.push("noncanonical_team_ids");
if (numericPlayerIds.length > 0) failures.push("noncanonical_player_ids");
if (emptyCanonicalIds.length > 0) failures.push("empty_player_ids");
if (players.length === 0) failures.push("no_roster_players");
if (unavailableRosters.length > 0) failures.push("unavailable_rosters");

console.log(
  JSON.stringify(
    {
      passed: failures.length === 0,
      payloadBytes: Buffer.byteLength(JSON.stringify(history)),
      seasons: actualSeasons,
      matchupCount: history.matchups.length,
      matchupTeamCount: matchupTeams.length,
      rosterEntryCount: players.length,
      canonicalPlayerCount: new Set(players.map((player) => player.id)).size,
      playerMediaCount: Object.keys(history.playerMedia ?? {}).length,
      numericTeamIdCount: numericTeamIds.length,
      numericPlayerIdCount: numericPlayerIds.length,
      unavailableRosterCount: unavailableRosters.length,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exitCode = 1;

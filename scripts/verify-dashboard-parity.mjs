import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
}

const legacyUrl =
  process.env.LEGACY_DASHBOARD_URL ??
  "https://shreve-ff-dash.vercel.app/api/espn-test";
const seasonYear = Number.parseInt(process.env.SEASON_YEAR ?? "2025", 10);
const tolerance = 0.011;
const normalizeText = (value) => value?.trim() ?? "";
const close = (left, right) => Math.abs(left - right) <= tolerance;
const mismatches = [];

const client = new ConvexHttpClient(convexUrl);
const snapshot = await client.query(
  makeFunctionReference("dashboard:current"),
  { seasonYear },
);
if (!snapshot) {
  throw new Error(`No Convex dashboard snapshot exists for ${seasonYear}.`);
}

const legacyResponse = await fetch(legacyUrl);
if (!legacyResponse.ok) {
  throw new Error(`Legacy dashboard returned HTTP ${legacyResponse.status}.`);
}
const legacy = await legacyResponse.json();
const current = snapshot.data;

const compareWinner = (label, left, right) => {
  if (
    normalizeText(left?.teamName) !== normalizeText(right?.teamName) ||
    left?.week !== right?.week ||
    !close(left?.score ?? 0, right?.score ?? 0)
  ) {
    mismatches.push(label);
  }
};

compareWinner("seasonHighScore", current.seasonHighScore, legacy.seasonHighScore);

for (const field of ["weeklyHighScores", "survivorEliminations"]) {
  if (current[field].length !== legacy[field].length) {
    mismatches.push(`${field}.length`);
    continue;
  }
  current[field].forEach((winner, index) =>
    compareWinner(`${field}[${index}]`, winner, legacy[field][index]),
  );
}

const legacyStandingByName = new Map(
  legacy.standings.map((standing) => [normalizeText(standing.teamName), standing]),
);
for (const standing of current.standings) {
  const counterpart = legacyStandingByName.get(normalizeText(standing.teamName));
  if (!counterpart) {
    mismatches.push(`standings.${standing.teamName}.missing`);
    continue;
  }
  for (const field of ["wins", "losses", "ties"]) {
    if (standing[field] !== counterpart[field]) {
      mismatches.push(`standings.${standing.teamName}.${field}`);
    }
  }
  if (!close(standing.pointsFor, counterpart.pointsFor)) {
    mismatches.push(`standings.${standing.teamName}.pointsFor`);
  }
}

if (current.unluckyTeams.length !== legacy.unluckyTeams.length) {
  mismatches.push("unluckyTeams.length");
} else {
  current.unluckyTeams.forEach((entry, index) => {
    const counterpart = legacy.unluckyTeams[index];
    if (
      normalizeText(entry.teamName) !== normalizeText(counterpart.teamName) ||
      entry.rank !== counterpart.rank ||
      !close(entry.pointsAgainst, counterpart.pointsAgainst)
    ) {
      mismatches.push(`unluckyTeams[${index}]`);
    }
  });
}

for (const field of ["winsAboveMedian", "totalWins", "percentage"]) {
  if (!close(current.leagueMedianStats[field], legacy.leagueMedianStats[field])) {
    mismatches.push(`leagueMedianStats.${field}`);
  }
}

console.log(
  JSON.stringify(
    {
      passed: mismatches.length === 0,
      seasonYear,
      calculationVersion: snapshot.calculationVersion,
      generatedAt: snapshot.generatedAt,
      mismatches,
    },
    null,
    2,
  ),
);

if (mismatches.length > 0) process.exitCode = 1;

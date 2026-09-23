# Waiver impact: value over your bench

For each eligible pickup start, impact is the pickup's actual points minus an eligible bench replacement's actual points for that manager and week. The league median and lower-quartile starter baselines are no longer used. A pickup scoring 18 while its bench alternative scores 7 earns +11; scoring 4 earns −3.

## Replacement selection

Use the recorded starting slot, not just the pickup's real position. Fixed slots require that position; FLEX accepts RB/WR/TE, restricted flex slots retain their restrictions, and superflex accepts offensive positions. Only recorded BN/Bench players with finite scores can replace a starter. IR, other starters, players on other teams, and duplicate player records cannot serve as alternatives.

Assign replacements jointly across all qualifying pickups on a team that week. First maximize how many slots can be filled, then maximize the replacement lineup's points, using each bench player at most once. Other actual starters stay put. For ties, process the most constrained slots first and then player IDs, with bench choices ordered by points and ID. This keeps the result deterministic. Position filters apply after assignment, so a pickup's value does not change when a filter hides another pickup.

If no distinct eligible backup can be assigned, exclude that start and disclose the exclusion. Missing alternatives do not become zero-point baselines. Recorded zero and negative scores count on both sides, and negative impact is retained. Multiple pickups competing for too few backups can leave starts unmeasured even when an individual backup exists.

This is a hindsight comparison with the recorded bench. It does not predict whom a manager would actually have started, determine free-agent availability, or model moving other starters between slots. Historical injury and bye availability is incomplete: a bench player may have scored zero for either reason. Eligibility here means lineup-slot eligibility, not a verified healthy player.

## Rankings and supporting stats

Sum signed impact by player/owner/season; manager totals sum those measured starts. A big start earns at least +5. An estimated win swing is an actual win that would become a tie or loss with the assigned bench points instead. Manager swings replace the selected pickups together and count each game once; games with any unmatched selected pickup do not earn a manager swing. Individual player swing counts are not additive or causal wins.

The UI exposes actual points, total bench points, per-start impact, the named bench replacement for the best week, and samples under three starts. Offense is the default, defense has its own filter, and kickers are excluded. Totals depend on tenure and measured starts; use season filters for a common period.

## Attribution and data

Use the canonical backend pickup eligibility, including its trade exclusions and missing-roster safeguards. Do not infer acquisitions again or use the legacy top-24 `effectiveWaiverPoints` cutoff. Originally drafted players are outside this definition. ESPN 2022–2025 attribution is inferred from roster history; imported Sleeper transactions take precedence where available. The supporting attribution correction is included so source-based deployments retain these safeguards.

Only completed canonical history is analyzed. This metric does not change historical game scores or outcomes.

## Verification

`tests/waiver-impact.test.ts` covers own-team weekly bench comparisons, negative starts, zero/negative bench scores, exclusions, missing alternatives, FLEX and superflex, joint replacement assignment, stable position filters, no double use of a backup, ambiguous rosters, win swings, seasons, and duplicate games. `tests/waiver-attribution.test.ts` covers acquisition attribution and trade exclusions.

September 23, 2026 validation: all 25 tests in the isolated waiver branch passed, as did lint and the production build including TypeScript. The full working tree passed 52 tests, typecheck, and lint. A read-only canonical history snapshot contained 556 measured offensive starts across 229 pickups, with 64 excluded starts; defense had 151 measured and 179 excluded starts. Independent exhaustive Python assignment reproduced all offensive measured/excluded counts and the +1,013.94 total. LaPorta / Rohan / 2023: 182.8 scored − 104.4 bench points = +78.4 over 13 starts. The production build was checked in the browser, including the named bench alternative in pickup details.

## Bench value: starter potential elsewhere

The separate Bench value view recognizes undrafted pickups who remained on their owner's bench but outscored eligible starters on other teams. It is never added to started impact or win swings.

For every qualifying BN/Bench week, compare the player with each other observed team's lowest-scoring eligible starting slot. Respect fixed, FLEX, restricted flex, superflex, and defense eligibility, using the same slot rules as started impact. Each other team supplies at most one comparison. The owner's own team, other bench players, and IR players are excluded.

`weekly bench value = sum(max(0, bench points − eligible starter points)) / number of comparable other teams`

Include zero-upgrade teams in the denominator. Four upgrades of 10 points among eight comparable teams earn +5 for the week. Sum weekly values by pickup/owner/season. This normalization avoids automatically rewarding larger leagues. Measured weeks with no upgrades remain visible with zero value; per-week values and a complete weekly log distinguish consistent depth from a long bench tenure. The leaderboard shows how many measured bench weeks improved at least one other lineup. Details identify the destination managers, the eligible starters, and individual upgrades in the best week.

These are separate hindsight scenarios, one pickup and one destination team at a time. The score is neither actual production nor a claim that a player was available to, denied to, or would have been started by another manager. It does not award hypothetical game wins. Other actual starters stay put. Positions are filtered by the pickup's real position, but comparison slots always include every eligible slot.

Missing rosters, absent eligible starting slots, nonfinite scores, and duplicate player records are unavailable comparisons, not zero baselines. A bench week without any valid comparison is unmeasured. Partial coverage is disclosed; absent bye teams are not reconstructed. Only canonical undrafted pickup eligibility earns credit, retaining existing transaction evidence and trade exclusions.

Implementation: `src/lib/waiver-bench-model.ts`; regressions: `tests/waiver-bench.test.ts`.

Bench-value validation (September 23, 2026): all 37 waiver tests, lint, and the production build including TypeScript passed. An independent Python calculation matched 1,157 offensive bench weeks across 312 pickups, 5,363 improved lineups out of 13,211 comparisons, and 3,500.6477 cumulative bench-value points. The snapshot had no unavailable offensive comparisons. Browser checks covered both metric modes, named comparisons, the full weekly log, position filtering, pagination, and console errors (none).

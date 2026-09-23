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

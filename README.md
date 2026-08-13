# Shreve Fantasy Football Dashboard

The Shreve league dashboard is a Next.js application backed by warm,
materialized Convex data. ESPN remains the historical source through 2025;
Sleeper becomes the authoritative provider in 2026 without changing the UI's
data model.

- Isolated Convex-backed deployment: https://shreve-ff-dash-convex.vercel.app
- Convex production deployment: `small-owl-897`
- Domain model and invariants: [CONTEXT.md](./CONTEXT.md)

## Architecture

Provider adapters ingest ESPN or Sleeper payloads into canonical League,
Season, Member, Entry, Matchup, Player, Lineup, Draft, and Transaction facts.
They also normalize provider settings into versioned Season Rules—regular-season
length, playoff teams and byes, League Median behavior, roster slots, and point
rules—and advance the Season Lifecycle monotonically from planned through
complete.
Calculations materialize small dashboard snapshots and one history snapshot per
season. The browser subscribes only to those warm read models; it never waits on
a provider API.

```text
ESPN (2022-2025) ─┐
                  ├─ provider adapters ─ canonical Convex facts
Sleeper (2026+) ──┘                         │
                                            ├─ dashboard snapshots
                                            └─ history season snapshots
                                                       │
                                              Next.js + Convex subscriptions
```

The old Next.js ESPN and history routes remain temporarily as rollback and
parity references. The legacy Python longest-touchdown implementation remains
in source control, but Vercel does not package it; Convex refreshes and stores
that result in the background.

## Local development

Use Node.js 20 or newer.

```bash
npm ci
npx convex dev
npm run dev
```

Required local variables:

```dotenv
CONVEX_DEPLOYMENT=dev:...
NEXT_PUBLIC_CONVEX_URL=https://<dev-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<dev-deployment>.convex.site
NEXT_PUBLIC_CURRENT_SEASON=2025
```

The ESPN importer additionally expects `ESPN_S2`, `ESPN_SWID`, and
`ESPN_LEAGUE_ID` in the Convex deployment environment. Do not commit provider
credentials to `.env.local` or source control.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:dashboard-parity
npm run verify:history-canonical
```

Canonical data can be reconciled independently of the UI:

```bash
npx convex run reconciliation:season '{"seasonYear":2025}'
npx convex run --prod reconciliation:season '{"seasonYear":2025}'
```

A passing reconciliation has no structural issues, score mismatches, or
unresolved identity exceptions.

The history verifier additionally proves that every historical roster entry is
preserved with canonical Player and Season Entry identities. ESPN player IDs
are used only for optional headshot media, so Sleeper-only rookies remain in
history rather than being silently dropped.

The Sleeper adapter can also be exercised against any league without writing
that league into Convex. This runs the same normalization used by production
for rosters, matchups, lineups, draft picks, and transactions:

```bash
npx convex run providers/sleeper:verifyLeaguePayload \
  '{"externalLeagueId":"<league-id>","week":1}'
```

## 2026 Sleeper cutover

The refresh cron is already deployed and safely returns `not_configured` until
the real league ID is attached. Once attached, the cron reads the durable
Provider Reference from Convex; an environment variable is only an optional
operational override.

1. Verify and prepare the production League Season in one fail-before-write
   operation:

   ```bash
   npx convex run --prod cutover:prepareSleeper \
     '{"seasonYear":2026,"externalLeagueId":"<league-id>","verificationWeek":1}'
   ```

   This verifies provider references and normalized rules without mutation
   first, then attaches the durable league reference, imports Season Rules and
   rosters, checks the draft, and returns the Member crosswalk plus current
   readiness blockers. `SLEEPER_LEAGUE_ID` and `SLEEPER_SEASON_YEAR` may still
   be set as emergency overrides, but are not required for normal refreshes.

2. Explicitly link each Sleeper user to an existing canonical Member. The
   importer deliberately refuses to merge people by display name:

   ```bash
   npx convex run --prod identityManagement:linkSleeperMember \
     '{"sleeperUserId":"<user-id>","canonicalMemberKey":"<member-key>"}'
   ```

3. Run `refresh:sleeper`, reconcile the new season, and run the cutover gate:

   ```bash
   npx convex run --prod refresh:sleeper
   npx convex run --prod reconciliation:season '{"seasonYear":2026}'
   npx convex run --prod cutover:readiness \
     '{"seasonYear":2026,"provider":"sleeper"}'
   ```

   The cutover result must say `"ready": true`. Its blocker codes cover the
   authoritative provider, league configuration, canonical Season Rules,
   provider-driven Season Lifecycle, explicit owner crosswalk,
   unresolved identities, matchup/lineup integrity, provider score parity,
   sync freshness, player catalog freshness, and the warm dashboard and history
   snapshots.
   Missing ESPN IDs for legitimate Sleeper-only players are warnings, not
   blockers. The cron refreshes the current week every five minutes, completed
   weeks once, entries and drafts every six hours, and Sleeper's player catalog
   at most once per day.

4. After validating the 2026 snapshot, change
   `NEXT_PUBLIC_CURRENT_SEASON` in Vercel from `2025` to `2026` and redeploy.
   This is the only frontend cutover switch.

Do not repoint the existing production domain until reconciliation passes and
`cutover:readiness` reports no blockers.

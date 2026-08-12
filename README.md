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
```

Canonical data can be reconciled independently of the UI:

```bash
npx convex run reconciliation:season '{"seasonYear":2025}'
npx convex run --prod reconciliation:season '{"seasonYear":2025}'
```

A passing reconciliation has no structural issues, score mismatches, or
unresolved identity exceptions.

## 2026 Sleeper cutover

The refresh cron is already deployed and safely returns `not_configured` until
the real league ID is available.

1. Set the production league ID and season:

   ```bash
   npx convex env set --prod SLEEPER_LEAGUE_ID '<league-id>'
   npx convex env set --prod SLEEPER_SEASON_YEAR '2026'
   ```

2. Probe and import rosters:

   ```bash
   npx convex run --prod providers/sleeper:probe \
     '{"externalLeagueId":"<league-id>"}'
   npx convex run --prod providers/sleeper:syncSeasonEntries \
     '{"seasonYear":2026,"externalLeagueId":"<league-id>"}'
   npx convex run --prod identityManagement:sleeperCrosswalk
   ```

3. Explicitly link each Sleeper user to an existing canonical Member. The
   importer deliberately refuses to merge people by display name:

   ```bash
   npx convex run --prod identityManagement:linkSleeperMember \
     '{"sleeperUserId":"<user-id>","canonicalMemberKey":"<member-key>"}'
   ```

4. Run `refresh:sleeper`, confirm the crosswalk is complete, and reconcile the
   new season. The cron then refreshes the current week every five minutes,
   completed weeks once, entries and drafts every six hours, and Sleeper's
   5 MB player catalog at most once per day.

5. After validating the 2026 snapshot, change
   `NEXT_PUBLIC_CURRENT_SEASON` in Vercel from `2025` to `2026` and redeploy.
   This is the only frontend cutover switch.

Do not repoint the existing production domain until the 2026 member crosswalk,
dashboard snapshot, and reconciliation all pass.

# Shreve Fantasy Football Domain

## Core concepts

- **League** — the continuing Shreve fantasy-football competition across all years and hosting providers.
- **League Season** — one NFL season of the League. A League Season has exactly one authoritative provider at a time.
- **Member** — a real person whose identity persists across providers, team renames, and seasons.
- **Season Entry** — a fantasy roster competing in one League Season. Its name, logo, provider roster ID, and ownership may change without changing historical Member identity.
- **Provider Reference** — an external ESPN or Sleeper identifier attached to an internal League Season, Member, Season Entry, Matchup, Transaction, or Player.
- **Week** — a numbered scoring period within a League Season.
- **Matchup** — a contest in a Week. Participants are modeled separately because providers disagree about home/away semantics.
- **Lineup Entry** — one player's scored participation for one Matchup Participant, including whether the player started.
- **Scoring Rule Version** — the normalized scoring and roster configuration effective from a particular week.
- **League Season Lifecycle** — the monotonic `planned → preseason → active → complete` progression of a League Season. Only its authoritative Provider Adapter may advance it.
- **Sync Run** — one observable, retryable attempt to ingest provider data into the canonical model.
- **Dashboard Snapshot** — a small, precomputed read model served to the application; it is derived from canonical facts and is never the source of truth.

## Invariants

1. Internal Convex document IDs are the only join keys used by calculations and UI read models.
2. Display names, logos, ESPN IDs, and Sleeper IDs are metadata—not canonical identity.
3. Provider identifiers are always stored with their provider and the provider league reference that scopes them.
4. A Member may own multiple Season Entries over time, and a Season Entry may have multiple Members.
5. Completed historical facts are immutable except through an explicit correction carrying new provenance.
6. Provider imports are idempotent and traceable to a Sync Run.
7. Derived prizes, standings, and analytics record their calculation version and source Sync Run.
8. Uncertain identity matches remain unresolved; the importer must not silently merge them by display name.
9. Calculations read League Season behavior from canonical Scoring Rule Versions, never directly from provider settings or hard-coded team counts.
10. League Season Lifecycle may advance but never regress during normal provider refreshes.

## Provider policy

- ESPN remains the authoritative historical provider through the 2025 League Season.
- Sleeper is planned as the authoritative provider beginning with the 2026 League Season.
- Provider adapters translate external payloads into canonical facts. Downstream calculations never branch on provider.

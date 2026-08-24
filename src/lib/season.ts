/**
 * The one frontend switch for the 2026 provider cutover: flipping
 * NEXT_PUBLIC_CURRENT_SEASON is all the UI needs, because it reads canonical
 * teams and members rather than anything provider-shaped.
 */
export const CURRENT_SEASON = Number.parseInt(
  process.env.NEXT_PUBLIC_CURRENT_SEASON ?? "2025",
  10,
);


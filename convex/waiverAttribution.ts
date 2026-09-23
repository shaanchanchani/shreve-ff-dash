export type WaiverEvidence = "transaction" | "inferred";
export type WaiverEvent = {
  week: number;
  occurredAt: number;
  kind: string;
  movements: Array<{ playerId: string; ownerId: string; direction: "add" | "drop" }>;
};

/** Attribution only; scoring and positional cutoffs remain in materialization. */
export function createWaiverTracker(drafted: ReadonlySet<string>, events: WaiverEvent[]) {
  const ordered = [...events].sort((a, b) => a.week - b.week || a.occurredAt - b.occurredAt);
  const claims = new Map<string, { ownerId: string; evidence: WaiverEvidence } | null>();
  const transactionPlayers = new Set<string>();
  let cursor = 0;
  let previous = new Map<string, string>();
  let previousWeek = -1;
  let previousComplete = false;

  return {
    advance(week: number, rosters: Map<string, string>, complete: boolean) {
      if (week <= previousWeek) throw new Error("Waiver weeks must be chronological.");
      const departingClaims = new Map<string, { ownerId: string; evidence: WaiverEvidence }>();
      // Never let a later pickup rewrite an earlier week's attribution. Process
      // drops before adds within a transaction, independent of provider ordering.
      while (cursor < ordered.length && ordered[cursor].week <= week) {
        const event = ordered[cursor++];
        for (const movement of event.movements) {
          const claim = claims.get(movement.playerId);
          if (event.week === week && movement.direction === "drop" && claim?.ownerId === movement.ownerId) {
            departingClaims.set(movement.playerId, claim);
          }
        }
        for (const movement of event.movements) {
          transactionPlayers.add(movement.playerId);
          claims.set(movement.playerId, null);
        }
        if (event.kind === "waiver" || event.kind === "free_agent") {
          for (const movement of event.movements) {
            if (movement.direction === "add") claims.set(movement.playerId, {
              ownerId: movement.ownerId, evidence: "transaction",
            });
          }
        }
      }

      const eligible = new Map<string, WaiverEvidence>();
      for (const [playerId, ownerId] of rosters) {
        // Missing draft data is unknown, not evidence that everyone was undrafted.
        if (drafted.size === 0 || drafted.has(playerId)) continue;
        if (!transactionPlayers.has(playerId)) {
          const lastOwner = previous.get(playerId);
          if (lastOwner && lastOwner !== ownerId) {
            // A direct transfer is ambiguous (trade or same-week drop/add).
            // It cannot establish a waiver claim, including a trade back.
            claims.set(playerId, null);
          } else if (!claims.has(playerId) || (
            !lastOwner && previousComplete && previousWeek === week - 1
          )) {
            claims.set(playerId, { ownerId, evidence: "inferred" });
          }
        }
        const activeClaim = claims.get(playerId);
        const departed = departingClaims.get(playerId);
        // A provider's transaction week can include the post-game drop. If its
        // final scoring roster still contains that starter, preserve that week's
        // earned credit for the departing owner only, never the trade recipient.
        const claim = activeClaim?.ownerId === ownerId ? activeClaim : departed;
        if (claim?.ownerId === ownerId) eligible.set(playerId, claim.evidence);
      }
      previous = new Map(rosters);
      previousWeek = week;
      previousComplete = complete;
      return eligible;
    },
  };
}

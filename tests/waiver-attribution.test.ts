import assert from "node:assert/strict";
import test from "node:test";
import { createWaiverTracker, type WaiverEvent } from "../convex/waiverAttribution.ts";
const roster = (owner?: string) => new Map(owner ? [["player", owner]] : []);
const tracker = (events: WaiverEvent[] = []) => createWaiverTracker(new Set(["drafted"]), events);
const event = (week: number, kind: string, ownerId: string, direction: "add" | "drop" = "add", occurredAt = week): WaiverEvent => ({week,kind,occurredAt,movements:[{playerId:"player",ownerId,direction}]});

test("inferred direct transfers and trade backs cannot earn waiver credit", () => {
  const t = tracker();
  assert.equal(t.advance(1, roster("A"), true).get("player"), "inferred");
  assert.equal(t.advance(2, roster("B"), true).size, 0);
  assert.equal(t.advance(3, roster("A"), true).size, 0);
});

test("a complete unrostered week allows a new inferred pickup", () => {
  const t = tracker(); t.advance(1, roster("A"), true); t.advance(2, roster(), true);
  assert.equal(t.advance(3, roster("B"), true).get("player"), "inferred");
});

test("a previously complete absence remains usable when other teams have byes now", () => {
  const t = tracker(); t.advance(1, roster("A"), true); t.advance(2, roster(), true);
  assert.equal(t.advance(3, roster("B"), false).get("player"), "inferred");
});

test("missing roster data and skipped weeks cannot be treated as free agency", () => {
  const t = tracker(); t.advance(1, roster("A"), true); t.advance(2, roster(), false);
  assert.equal(t.advance(3, roster("B"), true).size, 0);
  const skipped = tracker(); skipped.advance(1, roster("A"), true);
  assert.equal(skipped.advance(3, roster("B"), true).size, 0);
});

test("future transactions do not change previous attribution", () => {
  const t = tracker([event(3,"free_agent","B")]);
  assert.equal(t.advance(1, roster("A"), true).get("player"), "inferred");
  assert.equal(t.advance(2, roster("A"), true).get("player"), "inferred");
  assert.equal(t.advance(3, roster("B"), true).get("player"), "transaction");
});

test("explicit same-week drop and pickup beats ambiguous roster transfer", () => {
  const t = tracker([event(2,"free_agent","A","drop",1), event(2,"waiver","B","add",2)]);
  t.advance(1, roster("A"), true);
  assert.equal(t.advance(2, roster("B"), true).get("player"), "transaction");
});

test("trade clears credit until a subsequent explicit pickup", () => {
  const t = tracker([event(1,"waiver","A"), event(2,"trade","B"), event(4,"free_agent","B")]);
  assert.equal(t.advance(1, roster("A"), true).get("player"), "transaction");
  assert.equal(t.advance(2, roster("B"), true).size, 0);
  assert.equal(t.advance(3, roster("B"), true).size, 0);
  assert.equal(t.advance(4, roster("B"), true).get("player"), "transaction");
});

test("drafted players and missing draft lists cannot earn waiver credit", () => {
  const events = [event(1,"waiver","A")];
  for (const drafted of [new Set<string>(),new Set(["player"])]) {
    assert.equal(createWaiverTracker(drafted,events).advance(1,roster("A"),true).size,0);
  }
});

test("event ordering is chronological and independent of movement order", () => {
  const combined = event(1,"waiver","A");
  combined.movements.push({playerId:"player",ownerId:"B",direction:"drop"});
  assert.equal(tracker([combined]).advance(1,roster("A"),true).get("player"),"transaction");
  const t = tracker([event(1,"trade","B","add",2),event(1,"waiver","A","add",1)]);
  assert.equal(t.advance(1,roster("B"),true).size,0);
});

test("a post-game drop preserves the scoring starter's points but not future credit", () => {
  const t = tracker([event(1,"free_agent","A","add",1),event(1,"waiver","A","drop",2)]);
  assert.equal(t.advance(1,roster("A"),true).get("player"),"transaction");
  assert.equal(t.advance(2,roster("A"),true).size,0);
});

test("a playoff bye does not restart credit for a previously transferred player", () => {
  const t = tracker();t.advance(1,roster("A"),true);t.advance(2,roster("B"),true);
  t.advance(3,roster(),false);
  assert.equal(t.advance(4,roster("B"),true).size,0);
  assert.equal(t.advance(5,roster("B"),true).size,0);
});

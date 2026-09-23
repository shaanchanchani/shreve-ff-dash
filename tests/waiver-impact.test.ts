import assert from "node:assert/strict";
import test from "node:test";
import { buildWaiverImpact } from "../src/lib/waiver-impact-model.ts";
import type { HistoricalMatchup, HistoricalMatchupTeam, HistoricalPlayer } from "../src/types/history.ts";

const player = (id: string, points: number, overrides: Partial<HistoricalPlayer> = {}): HistoricalPlayer =>
  ({id,name:id,points,position:"QB",realPosition:"QB",wasDraftedByTeam:true,...overrides});
const bench = (id: string, points: number, realPosition = "QB") => player(id,points,{position:"BN",realPosition});
const team = (id: string, roster: HistoricalPlayer[], score=100): HistoricalMatchupTeam =>
  ({teamId:id,teamName:id,ownerName:id,ownerKey:id,roster,score,rosterUnavailable:false,waiverPoints:0});
const game = (points=25, week=1): HistoricalMatchup => ({
  id:`2025-${week}`,seasonId:2025,week,phase:"regular",label:"",
  home:team("a",[player("pickup",points,{wasDraftedByTeam:false,waiverEvidence:"transaction"}),bench("backup",10)],105),
  away:team("b",[player("opponent",100)],100),
});
const near = (actual:number,expected:number) => assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test("impact uses the manager's weekly bench and subtracts bad starts",()=>{
  const result=buildWaiverImpact([game(25),game(7,2)]);
  const p=result.pickups[0];near(p.impact,12);near(p.points,32);assert.equal(p.starts,2);
  assert.equal(p.bigStarts,1);assert.equal(p.swingWins,1);
  assert.equal(p.bestStart.benchmark,10);assert.equal(p.bestStart.replacementName,"backup");
  assert.equal(p.inferredStarts,0);
});

test("other teams and the manager's other starters cannot move the benchmark",()=>{
  const g=game(12);
  g.home.roster!.push(player("other-starter",200),bench("best-backup",11));
  g.away.roster!.push(bench("opposing-bench",300));
  const p=buildWaiverImpact([g]).pickups[0];
  near(p.impact,1);assert.equal(p.bestStart.replacementName,"best-backup");
});

test("zero and negative pickup scores remain in net impact",()=>{
  const p=buildWaiverImpact([game(0),game(-2,2)]).pickups[0];
  near(p.impact,-22);assert.equal(p.starts,2);assert.equal(p.bigStarts,0);
});

test("recorded zero and negative bench scores are valid alternatives",()=>{
  const first=game(0);first.home.roster![1].points=0;
  const second=game(-1,2);second.home.roster![1].points=-3;
  const p=buildWaiverImpact([first,second]).pickups[0];
  near(p.impact,2);assert.equal(p.bestStart.benchmark,-3);
});

test("bench, IR, kickers, drafted players and trade recipients cannot earn impact",()=>{
  const g=game();g.home.roster=[
    bench("bench",100),player("ir",100,{position:"IR",wasDraftedByTeam:false}),
    player("kicker",100,{realPosition:"K",position:"K",wasDraftedByTeam:false}),
    player("drafted",100),player("traded",100,{wasDraftedByTeam:true}),
  ];assert.equal(buildWaiverImpact([g]).pickups.length,0);
});

test("missing alternatives are skipped without a fabricated zero or league fallback",()=>{
  const g=game();g.home.roster=[g.home.roster![0],
    player("ir",20,{position:"IR"}),bench("wrong-position",12,"WR"),bench("unknown-score",NaN)];
  const r=buildWaiverImpact([g]);assert.equal(r.pickups.length,0);assert.equal(r.skippedStarts,1);
  g.home.rosterUnavailable=true;
  assert.equal(buildWaiverImpact([g]).pickups.length,0);
});

test("FLEX accepts eligible RB/WR/TE bench players but not QBs or defenses",()=>{
  const g=game();g.home.roster=[
    player("flex-pickup",20,{position:"FLEX",realPosition:"RB",wasDraftedByTeam:false}),
    bench("tight-end",8,"TE"),bench("receiver",12,"WR"),bench("qb",100),bench("defense",100,"DEF"),
  ];
  const offense=buildWaiverImpact([g]).pickups[0];
  near(offense.impact,8);assert.equal(offense.bestStart.replacementName,"receiver");
  assert.deepEqual(buildWaiverImpact([g],"RB").pickups[0],offense);
  assert.equal(buildWaiverImpact([g],"WR").pickups.length,0);
});

test("restricted flex and superflex honor the recorded slot",()=>{
  const g=game();g.home.roster=[
    player("pickup",20,{position:"RB/WR",realPosition:"RB",wasDraftedByTeam:false}),
    bench("receiver",8,"WR"),bench("tight-end",15,"TE"),bench("qb",18),
  ];
  assert.equal(buildWaiverImpact([g]).pickups[0].bestStart.replacementName,"receiver");
  g.home.roster![0].position="SUPER_FLEX";
  assert.equal(buildWaiverImpact([g]).pickups[0].bestStart.replacementName,"qb");
});

test("joint assignment fills fixed and FLEX slots optimally without reusing a bench player",()=>{
  const g=game();g.home.roster=[
    player("a-flex",25,{position:"FLEX",realPosition:"WR",wasDraftedByTeam:false}),
    player("z-rb",20,{position:"RB",realPosition:"RB",wasDraftedByTeam:false}),
    bench("rb-backup",15,"RB"),bench("wr-backup",8,"WR"),
  ];
  const r=buildWaiverImpact([g]);near(r.managers[0].impact,22);
  assert.equal(r.pickups.find(p=>p.playerName==="a-flex")!.bestStart.replacementName,"wr-backup");
  assert.equal(r.pickups.find(p=>p.playerName==="z-rb")!.bestStart.replacementName,"rb-backup");
  assert.equal(r.managers[0].swingWins,1);assert.equal(r.pickups.reduce((s,p)=>s+p.swingWins,0),2);
  assert.deepEqual(buildWaiverImpact([g],"WR").pickups[0],r.pickups.find(p=>p.playerName==="a-flex"));
  g.home.roster!.reverse();
  assert.deepEqual(buildWaiverImpact([g]),r);
});

test("insufficient distinct backups skip unmatched starts and suppress manager win swings",()=>{
  const g=game();g.home.roster=[
    player("pickup-a",25,{position:"RB",realPosition:"RB",wasDraftedByTeam:false}),
    player("pickup-b",20,{position:"RB",realPosition:"RB",wasDraftedByTeam:false}),
    bench("only-backup",10,"RB"),
  ];
  const r=buildWaiverImpact([g]);assert.equal(r.skippedStarts,1);assert.equal(r.pickups.length,1);
  assert.equal(r.managers[0].swingWins,0);assert.equal(r.pickups[0].playerName,"pickup-a");
});

test("defense aliases are normalized and offense excludes defense",()=>{
  const g=game();g.home.roster=[
    player("pickup",20,{position:"DEF",realPosition:"DST",wasDraftedByTeam:false}),bench("backup",5,"D/ST"),
  ];
  assert.equal(buildWaiverImpact([g]).pickups.length,0);
  near(buildWaiverImpact([g],"D/ST").pickups[0].impact,15);
});

test("swing estimates require a real win and reaching a tie counts",()=>{
  const g=game(15);assert.equal(buildWaiverImpact([g]).pickups[0].swingWins,1);
  g.home.score=100;assert.equal(buildWaiverImpact([g]).pickups[0].swingWins,0);
  g.home.score=90;assert.equal(buildWaiverImpact([g]).pickups[0].swingWins,0);
});

test("ambiguous duplicated players cannot earn credit or serve as replacements",()=>{
  const g=game();g.away.roster!.push(bench("backup",10));
  assert.equal(buildWaiverImpact([g]).skippedStarts,1);
  g.away.roster=[player("pickup",25)];
  assert.equal(buildWaiverImpact([g]).skippedStarts,1);
});

test("seasons stay separate; duplicate games and input ordering do not inflate totals",()=>{
  const first=game();const next={...game(20),id:"2026-1",seasonId:2026};
  const result=buildWaiverImpact([first,next]);assert.equal(result.pickups.length,2);
  assert.deepEqual(buildWaiverImpact([first,next,first]),result);
  assert.deepEqual(buildWaiverImpact([next,first]),result);
});

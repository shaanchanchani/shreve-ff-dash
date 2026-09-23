import assert from "node:assert/strict";
import test from "node:test";
import { buildWaiverBenchValue } from "../src/lib/waiver-bench-model.ts";
import { buildWaiverImpact } from "../src/lib/waiver-impact-model.ts";
import type { HistoricalMatchup, HistoricalMatchupTeam, HistoricalPlayer } from "../src/types/history.ts";

const player = (id:string,points:number,overrides:Partial<HistoricalPlayer>={}):HistoricalPlayer =>
  ({id,name:id,points,position:"RB",realPosition:"RB",wasDraftedByTeam:true,...overrides});
const team = (id:string,roster:HistoricalPlayer[]):HistoricalMatchupTeam =>
  ({teamId:id,teamName:id,ownerKey:id,ownerName:id,score:100,roster,rosterUnavailable:false,waiverPoints:0});
const slate = (points=20,scores=[10,20,30],week=1):HistoricalMatchup[] => {
  const teams=[team("owner",[player("own-starter",2),player("stash",points,{position:"BN",wasDraftedByTeam:false,waiverEvidence:"transaction"})]),
    ...scores.map((score,index)=>team(`peer-${index}`,[player(`starter-${index}`,score)]))];
  return Array.from({length:teams.length/2},(_,index)=>({
    id:`2025-${week}-${index}`,seasonId:2025,week,phase:"regular",label:"",home:teams[index*2],away:teams[index*2+1],
  }));
};
const near = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test("a useful bench pickup earns average upgrade across all other lineups, including zeros",()=>{
  const result=buildWaiverBenchValue(slate());const p=result.pickups[0];
  near(p.benchValue,10/3);assert.equal(p.improvedLineups,1);assert.equal(p.comparedLineups,3);
  assert.equal(p.benchWeeks,1);assert.equal(p.valuableWeeks,1);assert.equal(p.inferredWeeks,0);
  assert.equal(p.bestWeek.comparisons[0].playerName,"starter-0");
  assert.equal(p.bestWeek.comparisons.some(c=>c.ownerKey==="owner"),false);
  assert.equal(buildWaiverImpact(slate()).pickups.length,0);
});

test("same-position and FLEX slots produce only one best substitution per other team",()=>{
  const games=slate(20,[35,25,30]);
  games[0].away.roster!.push(player("flex-wr",5,{position:"FLEX",realPosition:"WR"}),player("second-rb",10));
  const p=buildWaiverBenchValue(games).pickups[0];
  near(p.benchValue,5);assert.equal(p.improvedLineups,1);assert.equal(p.comparedLineups,3);
  assert.equal(p.bestWeek.comparisons[0].playerName,"flex-wr");
  assert.deepEqual(buildWaiverBenchValue(games,"RB").pickups[0],p);
  assert.equal(buildWaiverBenchValue(games,"WR").pickups.length,0);
});

test("bench and IR players on other teams are never comparison starters",()=>{
  const games=slate();
  games[0].away.roster!.push(player("opponent-bench",-50,{position:"Bench"}),player("opponent-ir",-100,{position:"IR"}));
  near(buildWaiverBenchValue(games).pickups[0].benchValue,10/3);
});

test("restricted FLEX and superflex use actual slot eligibility",()=>{
  const games=slate(20,[5,10,30]);
  games[0].away.roster![0].position="WR/TE";
  games[1].home.roster![0].position="SUPER_FLEX";
  const r=buildWaiverBenchValue(games);
  near(r.pickups[0].benchValue,5);assert.equal(r.pickups[0].comparedLineups,2);
  assert.equal(r.missingComparisons,1);assert.equal(r.pickups[0].partialWeeks,1);
});

test("ties, worse scores, and negative scores cannot produce negative bench value",()=>{
  const p=buildWaiverBenchValue(slate(-2,[-2,0,5])).pickups[0];
  near(p.benchValue,0);assert.equal(p.valuableWeeks,0);assert.equal(p.benchWeeks,1);
  const zero=buildWaiverBenchValue(slate(0,[-3,0,1])).pickups[0];
  near(zero.benchValue,1);assert.equal(zero.improvedLineups,1);
});

test("normalizing by all comparisons avoids automatic extra credit in a larger league",()=>{
  const small=buildWaiverBenchValue(slate(20,[10,10,10])).pickups[0];
  const large=buildWaiverBenchValue(slate(20,[10,10,10,10,10])).pickups[0];
  near(small.benchValue,large.benchValue);assert.equal(large.comparedLineups,5);
});

test("weekly values include zero-value weeks and never borrow another week's starters",()=>{
  const first=slate(20,[10,10,10]);const second=slate(5,[10,10,10],2);
  const p=buildWaiverBenchValue([...first,...second]).pickups[0];
  near(p.benchValue,10);assert.equal(p.benchWeeks,2);assert.equal(p.valuableWeeks,1);
  assert.equal(p.bestWeek.week,1);assert.deepEqual(p.weeks.map(w=>w.value),[10,0]);
});

test("only undrafted eligible bench pickups qualify; trade recipients, IR and starters do not",()=>{
  for(const override of [{wasDraftedByTeam:true},{wasDraftedByTeam:undefined},{position:"IR"},{position:"RB"},{realPosition:"K"}]){
    const games=slate();Object.assign(games[0].home.roster![1],override);
    assert.equal(buildWaiverBenchValue(games).pickups.length,0);
  }
  const games=slate();games[0].home.roster![1].position="Bench";games[0].home.roster![1].waiverEvidence="inferred";
  assert.equal(buildWaiverBenchValue(games).inferredWeeks,1);
});

test("missing and nonfinite comparison scores are excluded instead of becoming zero",()=>{
  const games=slate();games[0].away.rosterUnavailable=true;
  games[1].home.roster![0].points=NaN;
  games[1].home.roster!.push(player("otherwise-usable",10));
  const r=buildWaiverBenchValue(games);assert.equal(r.missingComparisons,2);
  assert.equal(r.pickups[0].comparedLineups,1);near(r.pickups[0].benchValue,0);
  games[1].away.roster=[];
  const empty=buildWaiverBenchValue(games);assert.equal(empty.skippedWeeks,1);assert.equal(empty.pickups.length,0);
});

test("ambiguous players or team snapshots cannot manufacture bench value",()=>{
  const duplicate=slate();duplicate[0].away.roster!.push({...duplicate[0].home.roster![1]});
  assert.equal(buildWaiverBenchValue(duplicate).pickups.length,0);
  const teams=slate();teams[1].home.teamId="owner";
  assert.equal(buildWaiverBenchValue(teams).skippedWeeks,1);
  const unknown=slate();unknown[0].home.roster![1].points=NaN;
  assert.equal(buildWaiverBenchValue(unknown).skippedWeeks,1);
});

test("defense aliases work only in the defense filter",()=>{
  const games=slate();for(const g of games)for(const t of [g.home,g.away])for(const p of t.roster!){
    p.realPosition=p.id==="stash"?"DEF":"DST";if(p.position!=="BN")p.position="D/ST";
  }
  assert.equal(buildWaiverBenchValue(games).pickups.length,0);
  near(buildWaiverBenchValue(games,"D/ST").pickups[0].benchValue,10/3);
});

test("duplicate games, order, and separate seasons preserve deterministic results",()=>{
  const games=[...slate(),...slate(12,[0,10,30],2)];
  const result=buildWaiverBenchValue(games);
  assert.deepEqual(buildWaiverBenchValue([...games,...games]),result);
  for(const g of games)for(const t of [g.home,g.away])t.roster!.reverse();
  assert.deepEqual(buildWaiverBenchValue([...games].reverse()),result);
  const next=slate().map(g=>({...g,id:`2026-${g.id}`,seasonId:2026}));
  assert.equal(buildWaiverBenchValue([...games,...next]).pickups.length,2);
});

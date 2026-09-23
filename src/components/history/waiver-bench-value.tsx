"use client";

import { useMemo, useState } from "react";
import { Module } from "@/components/ui/module";
import { PlayerMark } from "@/components/common/entry-mark";
import { buildWaiverBenchValue, type BenchPickup } from "@/lib/waiver-bench-model";
import type { ImpactPositionFilter } from "@/lib/waiver-impact-model";
import type { AggregatedOwner } from "@/lib/owner-utils";
import type { HistoricalMatchup } from "@/types/history";

function BenchDetail({ pickup }: { pickup: BenchPickup }) {
  const best = pickup.bestWeek;
  return (
    <div className="space-y-3 border-t border-rule-2 bg-paper-2/60 px-3 py-3 text-xs text-ink-2">
      <dl className="grid grid-cols-2 gap-3">
        <div><dt>Value per bench week</dt><dd className="num mt-1 text-sm text-ink">{(pickup.benchValue/pickup.benchWeeks).toFixed(1)}</dd></div>
        <div><dt>Lineups improved</dt><dd className="num mt-1 text-sm text-ink">{pickup.improvedLineups} / {pickup.comparedLineups} comparisons</dd></div>
      </dl>
      <p className="leading-relaxed">Best: Week {best.week} · {best.points.toFixed(1)} bench points would improve {best.improvedLineups} of {best.comparisons.length} other recorded lineups. Average upgrade across all {best.comparisons.length}: <strong className="font-medium text-ink">+{best.value.toFixed(1)} points</strong>.</p>
      <ul aria-label={`Week ${best.week} lineup comparisons`} className="divide-y divide-rule-2">
        {best.comparisons.map(comparison => <li key={comparison.teamId} className="flex items-start justify-between gap-3 py-2">
          <span className="min-w-0 [overflow-wrap:anywhere]">{comparison.ownerName}<span className="mt-0.5 block text-ink-3">{comparison.playerName} · {comparison.slot} · {comparison.starterPoints.toFixed(1)} scored</span></span>
          <span className="num shrink-0 text-ink">{comparison.upgrade > 0 ? `+${comparison.upgrade.toFixed(1)}` : "No upgrade"}</span>
        </li>)}
      </ul>
      <details>
        <summary className="cursor-pointer font-medium text-ink">All {pickup.benchWeeks} measured bench weeks</summary>
        <ul className="mt-2 divide-y divide-rule-2">
          {pickup.weeks.map(week => <li key={week.week} className="flex justify-between gap-3 py-2">
            <span>Week {week.week} · {week.points.toFixed(1)} scored<span className="mt-0.5 block text-ink-3">Improves {week.improvedLineups}/{week.comparisons.length} lineups{week.missingLineups > 0 ? ` · ${week.missingLineups} unavailable` : ""}</span></span>
            <span className="num shrink-0">+{week.value.toFixed(1)}</span>
          </li>)}
        </ul>
      </details>
      {pickup.partialWeeks > 0 ? <p>{pickup.partialWeeks} weeks have incomplete comparison coverage.</p> : null}
      {pickup.inferredWeeks > 0 ? <p>Pickup attribution is estimated for {pickup.inferredWeeks} of {pickup.benchWeeks} weeks.</p> : null}
    </div>
  );
}

export function WaiverBenchValue({ matchups, owners }: {
  matchups: HistoricalMatchup[];
  owners: Map<string, AggregatedOwner>;
}) {
  const [position,setPosition] = useState<ImpactPositionFilter>("offense");
  const [expanded,setExpanded] = useState<string | null>(null);
  const [limit,setLimit] = useState(10);
  const result = useMemo(() => buildWaiverBenchValue(matchups,position),[matchups,position]);
  return (
    <Module title="Waiver bench value" qualifier="Starter potential elsewhere"
      note="Hindsight roster value only. These points are hypothetical and are never added to started impact or win swings.">
      <div className="space-y-3 border-b border-rule-2 px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-2">Good pickups can be valuable even when your own starters keep them on the bench.
          <span className="block text-xs">Improve four of eight other lineups by 10 points each: <strong className="font-medium text-ink">+5 bench value</strong> that week.</span>
        </p>
        <label className="block text-xs text-ink-2">Positions
          <select value={position} onChange={event => {setPosition(event.target.value as ImpactPositionFilter);setExpanded(null);setLimit(10);}}
            className="mt-1 block h-11 w-full border border-rule-2 bg-paper px-2 text-sm text-ink">
            <option value="offense">Offense</option><option value="QB">Quarterbacks</option>
            <option value="RB">Running backs</option><option value="WR">Receivers</option>
            <option value="TE">Tight ends</option><option value="D/ST">Defense (D/ST)</option>
          </select>
        </label>
      </div>
      <details className="border-b border-rule-2 px-3 py-3 text-xs text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">{result.inferredWeeks > 0 ? "Includes estimates · how bench value works" : "How bench value works"}</summary>
        <p className="mt-2 leading-relaxed">For each week an undrafted pickup was on your bench, compare his score with each other team’s lowest-scoring starter whose slot he could fill, including FLEX. Count each other team once. A tie or worse score earns zero; a better score earns the difference. Your own lineup is excluded.</p>
        <p className="mt-2 leading-relaxed">Weekly value is the average upgrade across all comparable teams, including teams he would not improve. Sum those weekly averages for the ranking. This avoids simply awarding more points in larger leagues. Longer bench histories can accumulate more value; per-week value and the full weekly log appear in the details.</p>
        <p className="mt-2 leading-relaxed">“Lineups improved” describes actual scores with hindsight, not a prediction that a manager would have started the player. Each player and destination team is a separate hypothetical scenario. These comparisons do not establish denied acquisitions or wins. Other starters stay put.</p>
        <p className="mt-2 leading-relaxed">Only recorded BN/Bench weeks qualify. IR, drafted players, trade recipients, and kickers are excluded. Missing or ambiguous eligible starters are excluded, never treated as zero. The comparison covers observed lineups; teams on byes may be absent. Injury and game availability are not fully recorded. ESPN pickup attribution is inferred from roster history; imported transactions take precedence where available.</p>
      </details>
      {result.skippedWeeks > 0 || result.missingComparisons > 0 ? <p className="border-b border-rule-2 px-3 py-2 text-xs text-ink-2">{result.skippedWeeks} bench weeks unmeasured · {result.missingComparisons} other-team comparisons unavailable or ambiguous.</p> : null}
      {result.pickups.length === 0 ? <p className="px-3 py-8 text-center text-sm text-ink-2">No comparable bench pickups for these filters. Try another position or season.</p> : <>
        <div className="flex justify-between gap-3 border-b border-rule-2 px-3 py-2 text-xs text-ink-2"><span>{result.pickups.length} pickups · ranked by bench value</span><span className="shrink-0">Value pts</span></div>
        <ol className="divide-y divide-rule-2">
          {result.pickups.slice(0,limit).map((pickup,index) => {
            const open = expanded === pickup.key;
            return <li key={pickup.key}>
              <button type="button" aria-expanded={open} aria-controls={`bench-${pickup.key}`}
                onClick={() => setExpanded(open ? null : pickup.key)}
                className="flex min-h-16 w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-paper-2">
                <span className="num w-5 shrink-0 text-xs text-ink-3">{index+1}</span>
                <PlayerMark headshotURL={pickup.headshotURL} size={28}/>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight [overflow-wrap:anywhere]">{pickup.playerName}</span>
                  <span className="mt-1 block text-xs text-ink-2">{owners.get(pickup.ownerKey)?.ownerName ?? pickup.ownerName} · {pickup.season}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">Improves other lineups in {pickup.valuableWeeks}/{pickup.benchWeeks} bench weeks{pickup.benchWeeks < 3 ? " · small sample" : ""}</span>
                </span>
                <span className="num shrink-0 text-sm font-medium text-ink">+{pickup.benchValue.toFixed(1)}</span>
                <span aria-hidden="true" className="text-xs text-ink-3">{open ? "▾" : "▸"}</span>
              </button>
              {open ? <div id={`bench-${pickup.key}`}><BenchDetail pickup={pickup}/></div> : null}
            </li>;
          })}
        </ol>
        {result.pickups.length > limit ? <button type="button" onClick={() => setLimit(limit+10)} className="min-h-11 w-full border-t border-rule-2 px-3 py-3 text-sm text-ink-2 hover:bg-paper-2">Show {Math.min(10,result.pickups.length-limit)} more pickups</button> : null}
      </>}
    </Module>
  );
}

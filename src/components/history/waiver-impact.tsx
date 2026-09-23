"use client";

import { useMemo, useState } from "react";
import { Module } from "@/components/ui/module";
import { EntryMark, PlayerMark } from "@/components/common/entry-mark";
import { selectLogo } from "@/lib/history-model";
import { buildWaiverImpact, type ImpactPositionFilter, type PickupImpact } from "@/lib/waiver-impact-model";
import type { AggregatedOwner } from "@/lib/owner-utils";
import type { HistoricalMatchup } from "@/types/history";
import { cn } from "@/lib/utils";
import { WaiverBenchValue } from "@/components/history/waiver-bench-value";

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
const impactTone = (value: number) => value < -0.05 ? "text-danger-ink" : "text-ink";

function PickupDetail({ pickup }: { pickup: PickupImpact }) {
  return (
    <div className="space-y-3 border-t border-rule-2 bg-paper-2/60 px-3 py-3 text-xs text-ink-2">
      <dl className="grid grid-cols-3 gap-2">
        <div><dt>Scored</dt><dd className="num mt-1 text-sm text-ink">{pickup.points.toFixed(1)}</dd></div>
        <div><dt>Bench alternatives</dt><dd className="num mt-1 text-sm text-ink">{(pickup.points - pickup.impact).toFixed(1)}</dd></div>
        <div><dt>Per start</dt><dd className={cn("num mt-1 text-sm", impactTone(pickup.impact))}>{signed(pickup.impact / pickup.starts)}</dd></div>
      </dl>
      <p>{pickup.bigStarts} big {pickup.bigStarts === 1 ? "start" : "starts"} · {pickup.swingWins} estimated win {pickup.swingWins === 1 ? "swing" : "swings"}</p>
      <p className="leading-relaxed">
        Best: Week {pickup.bestStart.week} · {pickup.bestStart.score.toFixed(1)} scored − {pickup.bestStart.benchmark.toFixed(1)} from {pickup.bestStart.replacementName} on the bench = <strong className="font-medium text-ink">{signed(pickup.bestStart.impact)}</strong>.
      </p>
      {pickup.inferredStarts > 0 ? <p className="text-ink-3">Pickup attribution is estimated for {pickup.inferredStarts} of {pickup.starts} starts.</p> : null}
    </div>
  );
}

type WaiverImpactProps = {
  matchups: HistoricalMatchup[];
  owners: Map<string, AggregatedOwner>;
  season: number | "all";
  className?: string;
};

export function WaiverImpact({ className, ...props }: WaiverImpactProps) {
  const [metric,setMetric] = useState<"started" | "bench">("started");
  return <div className={cn("min-w-0 space-y-3",className)}>
    <div className="flex border border-rule-2" role="group" aria-label="Waiver value measure">
      {(["started","bench"] as const).map(option => <button key={option} type="button" aria-pressed={metric === option}
        onClick={() => setMetric(option)}
        className={cn("min-h-11 flex-1 px-3 text-sm",metric === option ? "bg-paper-3 font-medium text-ink" : "text-ink-2 hover:bg-paper-2")}>
        {option === "started" ? "Started impact" : "Bench value"}
      </button>)}
    </div>
    {metric === "started" ? <StartedWaiverImpact {...props}/> : <WaiverBenchValue matchups={props.matchups} owners={props.owners}/>}
  </div>;
}

function StartedWaiverImpact({
  matchups,
  owners,
  season,
  className,
}: WaiverImpactProps) {
  const [view, setView] = useState<"pickups" | "managers">("pickups");
  const [position, setPosition] = useState<ImpactPositionFilter>("offense");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const result = useMemo(() => buildWaiverImpact(matchups, position), [matchups, position]);
  const rows = view === "pickups" ? result.pickups : result.managers;
  const ownerName = (key: string, fallback: string) => owners.get(key)?.ownerName ?? fallback;

  return (
    <Module title="Waiver difference-makers" qualifier="Value over your bench" className={className}
      note="Net impact includes every measured start, including poor ones. Only undrafted pickups qualify; starts without an eligible bench alternative are excluded.">
      <div className="space-y-3 border-b border-rule-2 px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-2">
          How many points did this pickup add over an eligible player on your own bench that week?
          <span className="block text-xs">25 points versus 10 from your bench = <strong className="font-medium text-ink">+15 impact</strong>. Bad starts count against it.</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex self-end border border-rule-2" role="group" aria-label="Waiver ranking view">
            {(["pickups", "managers"] as const).map(option => (
              <button key={option} type="button" aria-pressed={view === option}
                onClick={() => { setView(option); setExpanded(null); setLimit(10); }}
                className={cn("min-h-11 flex-1 px-3 text-sm", view === option ? "bg-paper-3 font-medium text-ink" : "text-ink-2 hover:bg-paper-2")}>
                {option === "pickups" ? "Pickups" : "Managers"}
              </button>
            ))}
          </div>
          <label className="text-xs text-ink-2">Positions
            <select value={position} onChange={event => { setPosition(event.target.value as ImpactPositionFilter); setExpanded(null); setLimit(10); }}
              className="mt-1 block h-11 w-full border border-rule-2 bg-paper px-2 text-sm text-ink">
              <option value="offense">Offense</option><option value="QB">Quarterbacks</option>
              <option value="RB">Running backs</option><option value="WR">Receivers</option>
              <option value="TE">Tight ends</option><option value="D/ST">Defense (D/ST)</option>
            </select>
          </label>
        </div>
        {view === "managers" ? <p className="text-xs text-ink-2">All selected pickups, including misses. Longer histories include more starts.</p> : null}
      </div>
      <details className="border-b border-rule-2 px-3 py-3 text-xs text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">{result.inferredStarts > 0 ? "Includes estimates · how impact works" : "How impact works"}</summary>
        <p className="mt-2 leading-relaxed">Impact = pickup points minus the points an eligible bench replacement scored that week. Replacements come from the same manager’s roster and must fit the actual lineup slot, including FLEX. Other starters stay in place. When several pickups started, we fill as many of their slots as the bench allows, then choose the combination with the most points. Each bench player is used once; position filters keep those assignments.</p>
        <p className="mt-2 leading-relaxed">This is a hindsight lineup comparison, not a prediction of whom you would have started. Bench scores may include injured players or bye weeks; historical availability is not fully recorded. IR players are excluded. Zero and negative scores count. Starts without an eligible, recorded bench alternative are excluded rather than compared with an invented zero.</p>
        <p className="mt-2 leading-relaxed">A big start is at least +5 above that benchmark. An estimated win swing is a win that becomes a tie or loss when that pickup scores the benchmark instead. Manager totals replace their selected pickups with their assigned bench alternatives together and count each game once. Player win swings are not additive and do not prove who caused a win.</p>
        <p className="mt-2 leading-relaxed">Each pickup row groups one player, owner, and season. Offense and defense are separate; kickers are excluded. Short samples are flagged, not hidden.</p>
        <p className="mt-2 leading-relaxed">ESPN seasons (2022–2025) have no imported transaction log: pickup attribution is inferred from rosters. Missing roster weeks never establish a new pickup. Sleeper transactions take precedence when available. Trade recipients get no pickup credit; a starter may retain points earned before leaving that week.</p>
      </details>
      {result.skippedStarts > 0 ? <p className="border-b border-rule-2 px-3 py-2 text-xs text-ink-2">{result.skippedStarts} starts excluded because no distinct eligible bench replacement was recorded, or the roster was ambiguous.</p> : null}
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-ink-2">No comparable {position === "offense" ? "offensive " : ""}pickup starts for these filters. Try another position or season.</p>
      ) : (
        <>
          <div className="flex justify-between border-b border-rule-2 px-3 py-2 text-xs text-ink-2"><span>{rows.length} {rows.length === 1 ? (view === "pickups" ? "pickup" : "manager") : view} · ranked by net impact</span><span>Impact pts</span></div>
          <ol className="divide-y divide-rule-2">
            {view === "pickups" ? result.pickups.slice(0,limit).map((pickup, index) => {
              const open = expanded === pickup.key;
              return <li key={pickup.key}>
                <button type="button" aria-expanded={open} aria-controls={`pickup-${pickup.key}`}
                  onClick={() => setExpanded(open ? null : pickup.key)}
                  className="flex min-h-16 w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-paper-2">
                  <span className="num w-5 shrink-0 text-xs text-ink-3">{index+1}</span>
                  <PlayerMark headshotURL={pickup.headshotURL} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-tight [overflow-wrap:anywhere]">{pickup.playerName}</span>
                    <span className="mt-1 block text-xs text-ink-2">{ownerName(pickup.ownerKey,pickup.ownerName)} · {pickup.season}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{pickup.starts} {pickup.starts === 1 ? "start" : "starts"}{pickup.starts < 3 ? " · small sample" : ` · ${pickup.bigStarts} big`}</span>
                  </span>
                  <span className={cn("num shrink-0 text-sm font-medium",impactTone(pickup.impact))}>{signed(pickup.impact)}</span>
                  <span aria-hidden="true" className="text-xs text-ink-3">{open ? "▾" : "▸"}</span>
                </button>
                {open ? <div id={`pickup-${pickup.key}`}><PickupDetail pickup={pickup}/></div> : null}
              </li>;
            }) : result.managers.slice(0,limit).map((manager,index) => {
              const open = expanded === manager.ownerKey;
              return <li key={manager.ownerKey}>
                <button type="button" aria-expanded={open} aria-controls={`manager-impact-${manager.ownerKey}`}
                  onClick={() => setExpanded(open ? null : manager.ownerKey)}
                  className="flex min-h-16 w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-paper-2">
                  <span className="num w-5 shrink-0 text-xs text-ink-3">{index+1}</span>
                  <EntryMark logoURL={selectLogo(owners.get(manager.ownerKey),season)} label={manager.ownerName} size="xs"/>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium [overflow-wrap:anywhere]">{ownerName(manager.ownerKey,manager.ownerName)}</span>
                    <span className="mt-1 block text-xs text-ink-2">{manager.starts} starts · {manager.bigStarts} big{manager.starts < 3 ? " · small sample" : ""}</span></span>
                  <span className={cn("num shrink-0 text-sm font-medium",impactTone(manager.impact))}>{signed(manager.impact)}</span>
                  <span aria-hidden="true" className="text-xs text-ink-3">{open ? "▾" : "▸"}</span>
                </button>
                {open ? <div id={`manager-impact-${manager.ownerKey}`} className="border-t border-rule-2 bg-paper-2/60 px-3 py-3">
                  <p className="mb-2 text-xs text-ink-2">{signed(manager.impact / manager.starts)} per start · {manager.swingWins} estimated win {manager.swingWins === 1 ? "swing" : "swings"}</p>
                  <ul className="divide-y divide-rule-2">{manager.pickups.map(pickup => <li key={pickup.key} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{pickup.playerName}<span className="mt-0.5 block text-ink-3">{pickup.season} · {pickup.starts} starts</span></span>
                    <span className={cn("num shrink-0",impactTone(pickup.impact))}>{signed(pickup.impact)}</span>
                  </li>)}</ul>
                </div> : null}
              </li>;
            })}
          </ol>
          {rows.length > limit ? <button type="button" onClick={() => setLimit(limit+10)} className="min-h-11 w-full border-t border-rule-2 px-3 py-3 text-sm text-ink-2 hover:bg-paper-2">Show {Math.min(10,rows.length-limit)} more {view}</button> : null}
        </>
      )}
    </Module>
  );
}

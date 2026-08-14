"use client";

import { EntryMark } from "@/components/common/entry-mark";
import { Tag } from "@/components/ui/tag";
import type { BracketGame, BracketNode, ResolvedBracket } from "@/lib/playoff-bracket";
import {
  BRACKET_COLUMN,
  BRACKET_GRID,
  BRACKET_STACK,
  Connector,
  RoundLabel,
  Slot,
  Terminal,
} from "@/components/playoffs/bracket-frame";
import { cn } from "@/lib/utils";

const ROUND_NAME = (index: number, total: number) => {
  const fromEnd = total - 1 - index;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Round one";
  return `Round ${index + 1}`;
};

/** The bracket as it was actually played, from the real playoff-week games. */
export function BracketResult({
  bracket,
  championPrize,
}: {
  bracket: ResolvedBracket;
  championPrize: number;
}) {
  const total = bracket.columns.length;
  const canDiagram =
    total === 3 &&
    bracket.columns[0].length === 4 &&
    bracket.columns[1].length === 2 &&
    bracket.columns[2].length === 1;

  return (
    <div className="px-3 py-4">
      {canDiagram ? (
        <>
          <div className="hidden lg:grid lg:grid-cols-[1fr_3rem_1fr_3rem_1fr]">
            {bracket.columns.map((_, index) => (
              <RoundLabelPair
                key={index}
                index={index}
                total={total}
                week={bracket.weeks[index]}
                last={index === total - 1}
              />
            ))}
          </div>

          <div className={cn("mt-2", BRACKET_GRID)}>
            <div className={BRACKET_COLUMN}>
              <RoundLabel className="lg:hidden">
                {ROUND_NAME(0, total)} · Week {bracket.weeks[0]}
              </RoundLabel>
              <div className={BRACKET_STACK}>
                {bracket.columns[0].map((node, index) => (
                  <Slot key={nodeKey(node, index)}>
                    <BracketNodeCard node={node} />
                  </Slot>
                ))}
              </div>
            </div>

            <Connector variant="quarter" />

            <div className={BRACKET_COLUMN}>
              <RoundLabel className="lg:hidden">
                {ROUND_NAME(1, total)} · Week {bracket.weeks[1]}
              </RoundLabel>
              <div className={BRACKET_STACK}>
                {bracket.columns[1].map((node, index) => (
                  <Slot key={nodeKey(node, index)}>
                    <BracketNodeCard node={node} />
                  </Slot>
                ))}
              </div>
            </div>

            <Connector variant="semi" />

            <div className={BRACKET_COLUMN}>
              <RoundLabel className="lg:hidden">
                {ROUND_NAME(2, total)} · Week {bracket.weeks[2]}
              </RoundLabel>
              <div className="mt-2 flex h-full flex-col justify-center gap-3 lg:mt-0">
                <ChampionCard
                  bracket={bracket}
                  championPrize={championPrize}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {bracket.columns.map((column, index) => (
            <div key={index}>
              <RoundLabel>
                {ROUND_NAME(index, total)} · Week {bracket.weeks[index]}
              </RoundLabel>
              <div className="mt-2 space-y-3">
                {column.map((node, nodeIndex) => (
                  <BracketNodeCard key={nodeKey(node, nodeIndex)} node={node} />
                ))}
              </div>
            </div>
          ))}
          <ChampionCard bracket={bracket} championPrize={championPrize} />
        </div>
      )}

      {bracket.thirdPlaceGame ? (
        <div className="mt-5 border-t border-rule pt-4">
          <RoundLabel>
            Third place · Week {bracket.thirdPlaceGame.week}
          </RoundLabel>
          <div className="mt-2 max-w-md">
            <GameCard game={bracket.thirdPlaceGame} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoundLabelPair({
  index,
  total,
  week,
  last,
}: {
  index: number;
  total: number;
  week: number;
  last: boolean;
}) {
  return (
    <>
      <RoundLabel>
        {ROUND_NAME(index, total)} · Week {week}
      </RoundLabel>
      {last ? null : <span />}
    </>
  );
}

const nodeKey = (node: BracketNode, index: number) =>
  node.kind === "game" ? node.game.id : `${node.teamName}-${index}`;

function BracketNodeCard({ node }: { node: BracketNode }) {
  if (node.kind === "bye") {
    return (
      <div className="relative flex items-center gap-2.5 border border-ink bg-paper px-2.5 py-2">
        <Terminal />
        <EntryMark logoURL={node.logoURL} label={node.teamName} size="xs" />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
          {node.teamName}
        </span>
        <Tag variant="neutral">Bye</Tag>
      </div>
    );
  }
  return <GameCard game={node.game} />;
}

function GameCard({ game }: { game: BracketGame }) {
  return (
    <div className="relative border border-ink bg-paper">
      <Terminal />
      <GameRow side={game.home} />
      <div className="border-t border-rule" />
      <GameRow side={game.away} />
    </div>
  );
}

function GameRow({ side }: { side: BracketGame["home"] }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-1.5",
        side.won ? "bg-paper" : "text-ink-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("w-1 self-stretch", side.won ? "bg-ink" : "bg-transparent")}
      />
      <EntryMark
        logoURL={side.logoURL}
        label={side.teamName}
        size="xs"
        className={cn(!side.won && "opacity-60")}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[0.8125rem] leading-tight",
          side.won && "font-medium",
        )}
      >
        {side.teamName}
      </span>
      <span
        className={cn(
          "num shrink-0 text-sm",
          side.won ? "font-medium" : "text-ink-2",
        )}
      >
        {side.score.toFixed(2)}
      </span>
      <span className="sr-only">{side.won ? "won" : "lost"}</span>
    </div>
  );
}

function ChampionCard({
  bracket,
  championPrize,
}: {
  bracket: ResolvedBracket;
  championPrize: number;
}) {
  return (
    <div className="border-2 border-ink bg-paper-2 px-3 py-3">
      <p className="meta text-ink-2">Champion</p>
      <div className="mt-2 flex items-center gap-2.5">
        <EntryMark
          logoURL={bracket.champion.logoURL}
          label={bracket.champion.teamName}
          size="md"
        />
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-medium leading-tight">
            {bracket.champion.teamName}
          </span>
          <span className="meta text-ink-2">
            def. {bracket.runnerUp.teamName}
          </span>
        </span>
      </div>
      <p className="num mt-3 text-[2rem] font-medium leading-none">
        ${championPrize}
      </p>
      <span aria-hidden="true" className="mt-1.5 block h-[3px] w-12 bg-gold" />
      <p className="num mt-2 text-[0.8125rem] text-ink-2">
        {bracket.final.home.score.toFixed(2)} —{" "}
        {bracket.final.away.score.toFixed(2)}
      </p>
    </div>
  );
}

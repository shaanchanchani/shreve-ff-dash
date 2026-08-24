import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared bracket chassis: equal-height slots so hairline connectors land on
 * exact fractions, and a stacked fallback on narrow screens where a diagram
 * costs more than it explains.
 */

export function RoundLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("meta text-ink-3", className)}>{children}</p>;
}

/** One equal-height row of a bracket column. */
export function Slot({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center lg:flex-1">
      <div className="w-full">{children}</div>
    </div>
  );
}

/** The small filled square a connector docks into. */
export function Terminal() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-[3px] top-1/2 hidden h-[5px] w-[5px] -translate-y-1/2 bg-ink lg:block"
    />
  );
}

/**
 * Hairline connectors. Positions are exact because every slot in a column is an
 * equal-height flex child, so centres land on clean fractions: four slots sit at
 * 12.5/37.5/62.5/87.5%, two at 25/75%, one at 50%.
 */
export function Connector({ variant }: { variant: "quarter" | "semi" }) {
  const rail = "absolute border-ink-3";

  if (variant === "quarter") {
    return (
      <div aria-hidden="true" className="relative hidden lg:block">
        <span className={cn(rail, "left-0 top-[12.5%] w-1/2 border-t")} />
        <span className={cn(rail, "left-0 top-[37.5%] w-1/2 border-t")} />
        <span className={cn(rail, "left-1/2 top-[12.5%] h-[25%] border-l")} />
        <span className={cn(rail, "left-1/2 top-[25%] w-1/2 border-t")} />

        <span className={cn(rail, "left-0 top-[62.5%] w-1/2 border-t")} />
        <span className={cn(rail, "left-0 top-[87.5%] w-1/2 border-t")} />
        <span className={cn(rail, "left-1/2 top-[62.5%] h-[25%] border-l")} />
        <span className={cn(rail, "left-1/2 top-[75%] w-1/2 border-t")} />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="relative hidden lg:block">
      <span className={cn(rail, "left-0 top-[25%] w-1/2 border-t")} />
      <span className={cn(rail, "left-0 top-[75%] w-1/2 border-t")} />
      <span className={cn(rail, "left-1/2 top-[25%] h-[50%] border-l")} />
      <span className={cn(rail, "left-1/2 top-[50%] w-1/2 border-t")} />
    </div>
  );
}

export const BRACKET_GRID =
  "grid gap-5 lg:grid-cols-[1fr_3rem_1fr_3rem_1fr] lg:gap-0";
export const BRACKET_COLUMN = "lg:min-h-[26rem]";
export const BRACKET_STACK =
  "mt-2 flex flex-col gap-3 lg:mt-0 lg:h-full lg:gap-0";

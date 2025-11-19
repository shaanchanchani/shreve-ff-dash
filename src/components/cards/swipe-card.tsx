import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export const swipeCardClass =
  "swipe-card snap-center shrink-0 w-[calc(100vw-3rem)] h-[calc(100vh-12rem)] rounded-[30px] border border-white/15 bg-[var(--charcoal)] px-5 py-6 shadow-[0_25px_50px_rgba(0,0,0,0.65)] overflow-y-auto";

type SwipeCardProps = HTMLAttributes<HTMLElement>;

export function SwipeCard({ className, ...props }: SwipeCardProps) {
  return <section className={cn(swipeCardClass, className)} {...props} />;
}

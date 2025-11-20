"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type DockItem = {
  href: string;
  label: string;
  Icon: (props: { active?: boolean }) => JSX.Element;
};

const DOCK_ITEMS: DockItem[] = [
  { href: "/", label: "Prizes", Icon: PrizeIcon },
  { href: "/playoffs", label: "Playoff Picture", Icon: BracketIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
];

export function MobileDock() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xs items-center justify-between rounded-full border border-white/15 bg-black/80 px-4 py-2 shadow-[0_10px_60px_rgba(0,0,0,0.55)] backdrop-blur">
        {DOCK_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border border-transparent text-white/70 transition",
                isActive
                  ? "border-white/40 bg-white/10 text-white"
                  : "hover:border-white/30 hover:text-white",
              )}
            >
              <item.Icon active={isActive} />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PrizeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "transition",
        active ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "",
      )}
    >
      <path
        d="M7 4h12v3.5c0 3.59-2.91 6.5-6.5 6.5S7 11.09 7 7.5V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 3.5v2M16 3.5v2M10.5 18.5h5M9.5 22h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M19 6h2.5a2.5 2.5 0 0 1-2.5 2.5M7 6H4.5A2.5 2.5 0 0 0 7 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 14v4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HistoryIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "transition",
        active ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "",
      )}
    >
      <circle
        cx="13"
        cy="13"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M13 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 5.5 5.5 7M19 5.5 20.5 7M5.5 19 7 20.5M19 20.5 20.5 19"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BracketIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "transition",
        active ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "",
      )}
    >
      <path
        d="M4 7h4.5v12H4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13h5v-3h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 10v6h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

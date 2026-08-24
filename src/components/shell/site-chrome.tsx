"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useRelativeAge, useSystemStatus } from "@/hooks/use-system-status";

const SECTIONS = [
  { href: "/", label: "Prizes" },
  { href: "/weekly", label: "Weekly" },
  { href: "/survivor", label: "Survivor" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/history", label: "History" },
] as const;

const isActive = (pathname: string | null, href: string) =>
  href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useSystemStatus();
  const age = useRelativeAge(status.generatedAt);

  return (
    <>
      <a
        href="#main"
        className="meta sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink bg-paper">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-2 lg:px-8">
          <Link
            href="/"
            className="shrink-0"
            aria-label="Shreve League — prizes"
          >
            <span className="display text-[1.375rem] leading-none lg:text-[1.5rem]">
              Shreve League
            </span>
          </Link>

          <nav aria-label="Sections" className="hidden md:block">
            <ul className="flex items-stretch">
              {SECTIONS.map((section) => {
                const active = isActive(pathname, section.href);
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "meta flex h-8 items-center border-l border-rule px-3 transition-colors first:border-l-0",
                        active
                          ? "bg-ink text-paper"
                          : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                      )}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="meta shrink-0 text-ink-3">
            <span className="num tracking-normal">{status.seasonYear}</span>
            {age ? (
              <span className="hidden sm:inline"> · updated {age} ago</span>
            ) : null}
          </p>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-6"
      >
        {children}
      </main>

      <NavDock pathname={pathname} />
    </>
  );
}

function NavDock({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {SECTIONS.map((section) => {
          const active = isActive(pathname, section.href);
          return (
            <li key={section.href} className="flex-1">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 border-l border-rule transition-colors",
                  active ? "bg-ink text-paper" : "text-ink-2",
                )}
              >
                <DockGlyph href={section.href} />
                <span className="meta text-[0.5rem] tracking-[0.1em]">
                  {section.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DockGlyph({ href }: { href: string }) {
  const shared = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    "aria-hidden": true,
  } as const;

  switch (href) {
    case "/":
      return (
        <svg {...shared}>
          <rect x="1.5" y="2.5" width="13" height="11" />
          <path d="M1.5 6h13M5.5 6v7.5M10.5 6v7.5" />
        </svg>
      );
    case "/weekly":
      return (
        <svg {...shared}>
          <path d="M1.5 13.5V8m4 5.5V4.5m4 9V6.5m4 7V2.5" />
        </svg>
      );
    case "/survivor":
      return (
        <svg {...shared}>
          <path d="M2 3h12M3.5 6.5h9M5 10h6M6.5 13.5h3" />
        </svg>
      );
    case "/playoffs":
      return (
        <svg {...shared}>
          <path d="M1.5 3h4v10h-4M9 8h5.5M5.5 8H9V4.5M9 8v3.5" />
        </svg>
      );
    default:
      return (
        <svg {...shared}>
          <rect x="2" y="2" width="4" height="12" />
          <rect x="7.5" y="2" width="3" height="12" />
          <rect x="12" y="2" width="2.5" height="12" />
        </svg>
      );
  }
}

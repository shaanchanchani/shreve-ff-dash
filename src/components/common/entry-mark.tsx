/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: 18,
  sm: 24,
  md: 30,
  lg: 44,
} as const;

type MarkSize = keyof typeof SIZE;

/**
 * Square document mark for a Season Entry. Logos are league-supplied and live
 * on third-party hosts, so they carry explicit dimensions, lazy loading, and a
 * monogram fallback rather than a broken box.
 */
export function EntryMark({
  logoURL,
  label,
  size = "sm",
  className,
}: {
  logoURL?: string;
  label: string;
  size?: MarkSize;
  className?: string;
}) {
  // Track *which* URL failed, so a new URL is retried instead of inheriting
  // the previous one's failure.
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const failed = Boolean(logoURL) && failedURL === logoURL;
  const px = SIZE[size];
  const shared = cn(
    "shrink-0 border border-rule bg-paper-2 object-cover",
    className,
  );

  if (logoURL && !failed) {
    return (
      <img
        src={logoURL}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{ width: px, height: px }}
        className={shared}
        onError={() => setFailedURL(logoURL ?? null)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: px, height: px }}
      className={cn(
        shared,
        "meta grid place-items-center text-[0.5rem] tracking-normal text-ink-3",
      )}
    >
      {label.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "??"}
    </span>
  );
}

/**
 * Player headshot. ESPN numeric IDs resolve to their CDN; Sleeper-only players
 * legitimately have no ESPN media, so the silhouette is a real state.
 */
export function PlayerMark({
  playerId,
  headshotURL,
  size = 32,
  className,
}: {
  playerId?: string | number;
  headshotURL?: string;
  size?: number;
  className?: string;
}) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const url =
    headshotURL ??
    (typeof playerId === "number"
      ? `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`
      : undefined);

  if (!url || failedURL === url) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(
          "grid shrink-0 place-items-center border border-rule bg-paper-2",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 fill-ink-3/45">
          <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9.6a8 8 0 0 1 16 0 .8.8 0 0 1-.47.74A19 19 0 0 1 12 23a19 19 0 0 1-7.53-1.66.8.8 0 0 1-.47-.74Z" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className={cn(
        "shrink-0 border border-rule bg-paper-2 object-cover object-top",
        className,
      )}
      onError={() => setFailedURL(url)}
    />
  );
}

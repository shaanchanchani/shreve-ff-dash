"use client";

import { useEffect } from "react";
import { Masthead } from "@/components/shell/masthead";
import { Notice } from "@/components/ui/notice";

/**
 * Convex rethrows query errors during render, so without a boundary a single bad
 * query replaces the whole app with the framework's default screen and no way
 * back. This keeps the page in the league's own voice and offers a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Masthead
        title="Something broke"
        standfirst="The page could not be built from the league data."
      />
      <Notice kind="alert" title="Try again">
        This is usually temporary — the data is refreshed on a schedule and the
        next read may succeed.
        <button
          type="button"
          onClick={reset}
          className="meta mt-3 inline-flex items-center gap-1.5 border border-ink px-2 py-2 text-ink transition-colors hover:bg-paper-2"
        >
          Reload this page
          <span aria-hidden="true">→</span>
        </button>
      </Notice>
    </>
  );
}

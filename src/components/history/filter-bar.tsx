"use client";

import { cn } from "@/lib/utils";

export type FilterOption<T extends string | number> = {
  value: T;
  label: string;
};

/**
 * Filter chips are real controls: they carry aria-pressed and keyboard focus,
 * and the pressed state never relies on colour alone.
 */
export function FilterChips<T extends string | number>({
  legend,
  options,
  selected,
  onSelect,
  className,
}: {
  legend: string;
  options: FilterOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="meta w-14 shrink-0 text-ink-3">{legend}</span>
      <div
        role="group"
        aria-label={legend}
        className="flex flex-wrap items-center gap-1"
      >
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={cn(
                "meta min-h-11 border px-2.5 py-1.5 transition-colors",
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-rule text-ink-2 hover:border-ink hover:text-ink",
              )}
            >
              <span aria-hidden="true" className="mr-1">
                {active ? "▪" : "▫"}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

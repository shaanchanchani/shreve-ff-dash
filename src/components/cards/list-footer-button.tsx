import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ListFooterButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function ListFooterButton({
  className,
  children,
  ...props
}: ListFooterButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex w-full items-center justify-center border-t border-white/5 px-3 py-2.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        className,
      )}
    >
      {children}
      <span aria-hidden="true" className="ml-2 text-xs leading-none">
        →
      </span>
    </button>
  );
}

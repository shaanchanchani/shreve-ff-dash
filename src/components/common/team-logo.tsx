/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  logoURL?: string;
  label?: string;
  className?: string;
}

export function TeamLogo({ logoURL, label, className }: TeamLogoProps) {
  const sharedClass = cn(
    "h-7 w-7 rounded-full border border-white/20 bg-white/5 object-cover",
    className,
  );

  if (logoURL) {
    return <img src={logoURL} alt={label ?? "team logo"} className={sharedClass} />;
  }

  if (!label) return null;

  return (
    <span
      className={cn(
        "font-heading grid place-items-center text-[0.55rem] uppercase text-white/70",
        sharedClass,
      )}
    >
      {label.slice(0, 2)}
    </span>
  );
}

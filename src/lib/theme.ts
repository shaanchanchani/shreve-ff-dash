import { JetBrains_Mono, VT323, Black_Ops_One } from "next/font/google";
import type { CSSProperties } from "react";

export const headingFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
});

export const dataFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const sportsFont = VT323({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sports",
});

export const fieldFont = Black_Ops_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-field",
});

export const fontVariableClasses = `${headingFont.variable} ${dataFont.variable} ${sportsFont.variable} ${fieldFont.variable}`;

export const basePalette = {
  "--night": "#0a0615",
  "--mist": "#f4ede3",
  "--ember": "#f5f5f5",
  "--tide": "#f5f5f5",
  "--violet": "#f5f5f5",
  "--charcoal": "rgba(17, 17, 27, 0.95)",
} as CSSProperties;

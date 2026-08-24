import type { Metadata, Viewport } from "next";
import { Anton, Courier_Prime, Geist, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ConvexClientProvider } from "./convex-client-provider";
import { SiteChrome } from "@/components/shell/site-chrome";

/* Four faces, three jobs: a condensed display face for mastheads and records,
   a grotesk for interface copy, a mono for every numeral, and Courier for the
   system metadata voice. */
const display = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const meta = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shreve League",
  description:
    "Prizes, playoff picture, and history for the Shreve fantasy football league.",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f1f0e9",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
      </head>
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} ${meta.variable} antialiased`}
      >
        <ConvexClientProvider>
          <SiteChrome>{children}</SiteChrome>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

'use client';

import type { CSSProperties } from "react";

const fontSamples = [
  { name: "Allerta Stencil", google: "Allerta+Stencil" },
  { name: "Alfa Slab One", google: "Alfa+Slab+One" },
  { name: "Anton", google: "Anton" },
  { name: "Archivo Black", google: "Archivo+Black" },
  { name: "Barlow Condensed", google: "Barlow+Condensed" },
  { name: "Bebas Neue", google: "Bebas+Neue" },
  { name: "Big Shoulders Display", google: "Big+Shoulders+Display" },
  { name: "Big Shoulders Inline Display", google: "Big+Shoulders+Inline+Display" },
  { name: "Big Shoulders Stencil Display", google: "Big+Shoulders+Stencil+Display" },
  { name: "Black Han Sans", google: "Black+Han+Sans" },
  { name: "Black Ops One", google: "Black+Ops+One" },
  { name: "Bowlby One", google: "Bowlby+One" },
  { name: "Bungee", google: "Bungee" },
  { name: "Bungee Inline", google: "Bungee+Inline" },
  { name: "Bungee Shade", google: "Bungee+Shade" },
  { name: "Bungee Spice", google: "Bungee+Spice" },
  { name: "Candal", google: "Candal" },
  { name: "Carter One", google: "Carter+One" },
  { name: "Chakra Petch", google: "Chakra+Petch" },
  { name: "Changa", google: "Changa" },
  { name: "Chonburi", google: "Chonburi" },
  { name: "Cinzel Decorative", google: "Cinzel+Decorative" },
  { name: "Concert One", google: "Concert+One" },
  { name: "Contrail One", google: "Contrail+One" },
  { name: "Dela Gothic One", google: "Dela+Gothic+One" },
  { name: "Diplomata", google: "Diplomata" },
  { name: "Diplomata SC", google: "Diplomata+SC" },
  { name: "Do Hyeon", google: "Do+Hyeon" },
  { name: "Doppio One", google: "Doppio+One" },
  { name: "Eczar", google: "Eczar" },
  { name: "Emblema One", google: "Emblema+One" },
  { name: "Encode Sans SC", google: "Encode+Sans+SC" },
  { name: "Exo 2", google: "Exo+2" },
  { name: "Fascinate Inline", google: "Fascinate+Inline" },
  { name: "Faster One", google: "Faster+One" },
  { name: "Fjalla One", google: "Fjalla+One" },
  { name: "Francois One", google: "Francois+One" },
  { name: "Fugaz One", google: "Fugaz+One" },
  { name: "Germania One", google: "Germania+One" },
  { name: "Gravitas One", google: "Gravitas+One" },
  { name: "Grenze Gotisch", google: "Grenze+Gotisch" },
  { name: "Hanalei", google: "Hanalei" },
  { name: "Hanalei Fill", google: "Hanalei+Fill" },
  { name: "Holtwood One SC", google: "Holtwood+One+SC" },
  { name: "Iceland", google: "Iceland" },
  { name: "Jockey One", google: "Jockey+One" },
  { name: "Jomhuria", google: "Jomhuria" },
  { name: "Jua", google: "Jua" },
  { name: "Kanit", google: "Kanit" },
  { name: "Kdam Thmor Pro", google: "Kdam+Thmor+Pro" },
  { name: "Keania One", google: "Keania+One" },
  { name: "Koulen", google: "Koulen" },
  { name: "Krona One", google: "Krona+One" },
  { name: "Lalezar", google: "Lalezar" },
  { name: "League Spartan", google: "League+Spartan" },
  { name: "Lilita One", google: "Lilita+One" },
  { name: "Limelight", google: "Limelight" },
  { name: "Londrina Outline", google: "Londrina+Outline" },
  { name: "Londrina Solid", google: "Londrina+Solid" },
  { name: "Medula One", google: "Medula+One" },
  { name: "Michroma", google: "Michroma" },
  { name: "Monoton", google: "Monoton" },
  { name: "Montserrat Alternates", google: "Montserrat+Alternates" },
  { name: "Montserrat Subrayada", google: "Montserrat+Subrayada" },
  { name: "Orbitron", google: "Orbitron" },
  { name: "Oswald", google: "Oswald" },
  { name: "Oxanium", google: "Oxanium" },
  { name: "Paytone One", google: "Paytone+One" },
  { name: "Pirata One", google: "Pirata+One" },
  { name: "Quantico", google: "Quantico" },
  { name: "Racing Sans One", google: "Racing+Sans+One" },
  { name: "Ramabhadra", google: "Ramabhadra" },
  { name: "Rammetto One", google: "Rammetto+One" },
  { name: "Ranchers", google: "Ranchers" },
  { name: "Rationale", google: "Rationale" },
  { name: "Roboto Condensed", google: "Roboto+Condensed" },
  { name: "Russo One", google: "Russo+One" },
  { name: "Rye", google: "Rye" },
  { name: "Saira Condensed", google: "Saira+Condensed" },
  { name: "Saira Stencil One", google: "Saira+Stencil+One" },
  { name: "Sarpanch", google: "Sarpanch" },
  { name: "Secular One", google: "Secular+One" },
  { name: "Sigmar One", google: "Sigmar+One" },
  { name: "Six Caps", google: "Six+Caps" },
  { name: "Skranji", google: "Skranji" },
  { name: "Sonsie One", google: "Sonsie+One" },
  { name: "Squada One", google: "Squada+One" },
  { name: "Staatliches", google: "Staatliches" },
  { name: "Stardos Stencil", google: "Stardos+Stencil" },
  { name: "Stint Ultra Expanded", google: "Stint+Ultra+Expanded" },
  { name: "Syncopate", google: "Syncopate" },
  { name: "Teko", google: "Teko" },
  { name: "Tourney", google: "Tourney" },
  { name: "Trade Winds", google: "Trade+Winds" },
  { name: "Turret Road", google: "Turret+Road" },
  { name: "Unica One", google: "Unica+One" },
  { name: "Unlock", google: "Unlock" },
  { name: "Viga", google: "Viga" },
  { name: "Wallpoet", google: "Wallpoet" },
  { name: "Yanone Kaffeesatz", google: "Yanone+Kaffeesatz" },
];

const imports = fontSamples
  .map((font) => `@import url('https://fonts.googleapis.com/css2?family=${font.google}&display=swap');`)
  .join("\n");

const ember = "#ff7b39";

const badge: CSSProperties = {
  display: "inline-flex",
  borderRadius: "999px",
  padding: "0.25rem 0.75rem",
  background: "rgba(255,123,57,0.12)",
  border: "1px solid rgba(255,123,57,0.4)",
  fontSize: "0.75rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: ember,
};

export default function FontLab() {
  return (
    <div className="px-6 py-12 text-white" style={{ background: "radial-gradient(circle at top, #1a1525, #05040b 75%)" }}>
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-4 text-center">
          <div style={badge}>Longest TD Font Lab</div>
          <h1
            className="text-4xl font-semibold uppercase tracking-[0.2em]"
            style={{ color: ember }}
          >
            Dusty Numeral Field Guide
          </h1>
          <p className="text-sm" style={{ color: ember, opacity: 0.75 }}>
            Scroll these 100 display faces to find the vintage jersey vibe. Each swatch renders the same sample so you can screenshot favorites.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {fontSamples.map((font) => (
            <div
              key={font.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            >
              <p
                className="text-[2.2rem] uppercase tracking-[0.25em] drop-shadow-[0_10px_25px_rgba(0,0,0,0.55)]"
                style={{ fontFamily: `'${font.name}', sans-serif`, color: ember }}
              >
                73 yds
              </p>
              <p
                className="mt-4 text-xs uppercase tracking-[0.3em]"
                style={{ color: ember, opacity: 0.75 }}
              >
                {font.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        ${imports}
        body {
          background-color: #05040b;
        }
      `}</style>
    </div>
  );
}

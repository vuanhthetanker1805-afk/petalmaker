"use client";

/**
 * Canvas 2D takes CSS colour strings, not custom properties, so the chrome
 * drawn onto a canvas cannot reference var(--...) directly. Rather than
 * hardcoding hexes (which would drift from tokens.css the first time the theme
 * changes), read the resolved token values once and cache them.
 */
const CHROME_TOKENS = [
  "--color-sunken", "--color-paper", "--color-paper-1", "--color-paper-2",
  "--color-paper-3", "--color-rule", "--color-rule-soft",
  "--color-accent", "--color-focus", "--color-warn", "--color-ink-4",
] as const;

export type ChromeToken = (typeof CHROME_TOKENS)[number];

let cache: Record<string, string> | null = null;

export function chrome(token: ChromeToken, fallback = "#101318"): string {
  if (typeof window === "undefined") return fallback;
  if (!cache) {
    cache = {};
    const cs = getComputedStyle(document.documentElement);
    for (const t of CHROME_TOKENS) cache[t] = cs.getPropertyValue(t).trim();
  }
  return cache[token] || fallback;
}

/** Same colour with an alpha applied. Works for the oklch() values in tokens.css. */
export function chromeAlpha(token: ChromeToken, alpha: number, fallback = "#101318"): string {
  const base = chrome(token, fallback);
  if (base.startsWith("oklch(")) return base.replace(/\)$/, ` / ${alpha})`);
  return base;
}

/** Invalidate after a theme switch. */
export function resetChromeCache() { cache = null; }

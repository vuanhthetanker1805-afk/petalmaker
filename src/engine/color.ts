/**
 * gardn packs colors as 0xAARRGGBB (Client/Render/Renderer.cc:107-119).
 * Everything here keeps that convention so exported literals paste straight
 * into Petal.cc.
 */

export const A = (c: number) => (c >>> 24) & 255;
export const R = (c: number) => (c >>> 16) & 255;
export const G = (c: number) => (c >>> 8) & 255;
export const B = (c: number) => c & 255;

export const argb = (a: number, r: number, g: number, b: number) =>
  (((a & 255) << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)) >>> 0;

export const toCss = (c: number) => `rgba(${R(c)},${G(c)},${B(c)},${A(c) / 255})`;

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

/** `#rrggbb`, for <input type="color"> which cannot represent alpha. */
export const toHex6 = (c: number) => `#${hex2(R(c))}${hex2(G(c))}${hex2(B(c))}`;

export const fromHex6 = (hex: string, alpha = 255) => {
  const h = hex.replace("#", "");
  return argb(alpha, parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
};

/** `0xaarrggbb`, the literal form used throughout Petal.cc. */
export const toCppHex = (c: number) => `0x${(c >>> 0).toString(16).padStart(8, "0")}`;

/**
 * Port of Renderer::MIX (Renderer.cc:76-82): per-channel lerp base->mix by v,
 * clamped, with alpha taken unmodified from `base`.
 */
export const mix = (base: number, m: number, v: number) => {
  const ch = (x: number, y: number) => Math.max(0, Math.min(255, Math.round(y * v + x * (1 - v))));
  return argb(A(base), ch(R(base), R(m)), ch(G(base), G(m)), ch(B(base), B(m)));
};

/**
 * Port of Renderer::HSV (Renderer.cc:72-74). Despite the name this is not HSV:
 * it mixes toward black, i.e. a plain brightness multiplier. v<1 darkens.
 * The codebase's universal outline idiom is stroke = HSV(fill, 0.8).
 */
export const hsv = (c: number, v: number) => mix(((c >>> 24) << 24) >>> 0, c, v);

/** The 0.8 shade used for nearly every petal outline in Petal.cc. */
export const deriveStroke = (fill: number) => hsv(fill, 0.8);

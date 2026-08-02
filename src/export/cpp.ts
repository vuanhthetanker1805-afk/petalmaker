import { toCppHex, deriveStroke } from "@/src/engine/color";
import type { Cmd, Doc, Shape } from "@/src/engine/types";

export interface CppOptions {
  /**
   * Express coordinates as multiples of `r` (`r * 0.866`) instead of literals.
   * Both conventions appear in Petal.cc -- r-parametric art auto-scales with
   * PETAL_DATA[id].radius, literal art does not.
   */
  useRadius: boolean;
  /** Wrap in `case PetalID::kName: { ... break; }` */
  wrapCase: boolean;
  /** Emit `ctx.set_stroke(Renderer::HSV(fill, 0.8))` when stroke matches that shade. */
  useHsvIdiom: boolean;
  decimals: number;
}

export const defaultCppOptions: CppOptions = {
  useRadius: true,
  wrapCase: true,
  useHsvIdiom: true,
  decimals: 3,
};

const trimNum = (n: number, decimals: number) => {
  if (!isFinite(n)) return "0";
  const s = n.toFixed(decimals);
  return s.replace(/\.?0+$/, "") || "0";
};

/** A coordinate, either literal or as a multiple of `r`. */
function coord(v: number, o: CppOptions, radius: number): string {
  if (!o.useRadius || radius === 0) return trimNum(v, o.decimals);
  if (Math.abs(v) < 1e-9) return "0";
  const k = v / radius;
  if (Math.abs(k - 1) < 1e-9) return "r";
  if (Math.abs(k + 1) < 1e-9) return "-r";
  // Petal.cc writes `-r * 0.5`, never `r * -0.5`
  return `${k < 0 ? "-" : ""}r * ${trimNum(Math.abs(k), o.decimals)}`;
}

/** Angles stay literal, but snap to the M_PI forms Petal.cc actually uses. */
function angle(v: number, o: CppOptions): string {
  const named: [number, string][] = [
    [0, "0"],
    [Math.PI / 2, "M_PI / 2"],
    [Math.PI, "M_PI"],
    [(3 * Math.PI) / 2, "3 * M_PI / 2"],
    [2 * Math.PI, "2 * M_PI"],
    [-Math.PI / 2, "-M_PI / 2"],
    [-Math.PI, "-M_PI"],
  ];
  for (const [val, txt] of named) if (Math.abs(v - val) < 1e-6) return txt;
  return trimNum(v, o.decimals);
}

function cmdToCpp(c: Cmd, o: CppOptions, radius: number): string {
  const p = (v: number) => coord(v, o, radius);
  switch (c.t) {
    case "move": return `ctx.move_to(${p(c.x)}, ${p(c.y)});`;
    case "line": return `ctx.line_to(${p(c.x)}, ${p(c.y)});`;
    case "quad": return `ctx.qcurve_to(${p(c.cx)}, ${p(c.cy)}, ${p(c.x)}, ${p(c.y)});`;
    case "cubic":
      return `ctx.bcurve_to(${p(c.c1x)}, ${p(c.c1y)}, ${p(c.c2x)}, ${p(c.c2y)}, ${p(c.x)}, ${p(c.y)});`;
    case "arc": return `ctx.arc(${p(c.x)}, ${p(c.y)}, ${p(c.r)});`;
    case "parc":
      return `ctx.partial_arc(${p(c.x)}, ${p(c.y)}, ${p(c.r)}, ${angle(c.sa, o)}, ${angle(c.ea, o)}, ${c.ccw ? 1 : 0});`;
    case "ellipse":
      return c.a === 0
        ? `ctx.ellipse(${p(c.x)}, ${p(c.y)}, ${p(c.rx)}, ${p(c.ry)});`
        : `ctx.ellipse(${p(c.x)}, ${p(c.y)}, ${p(c.rx)}, ${p(c.ry)}, ${angle(c.a, o)});`;
    case "rect": return `ctx.rect(${p(c.x)}, ${p(c.y)}, ${p(c.w)}, ${p(c.h)});`;
    case "roundRect":
      return `ctx.round_rect(${p(c.x)}, ${p(c.y)}, ${p(c.w)}, ${p(c.h)}, ${p(c.r)});`;
    case "close": return `ctx.close_path();`;
  }
}

function shapeToCpp(s: Shape, o: CppOptions, radius: number): string[] {
  if (!s.visible || s.cmds.length === 0) return [];
  const out: string[] = [];
  if (s.fill !== null) out.push(`ctx.set_fill(${toCppHex(s.fill)});`);
  if (s.stroke !== null) {
    const isShade = s.fill !== null && deriveStroke(s.fill) === s.stroke;
    out.push(
      o.useHsvIdiom && isShade
        ? `ctx.set_stroke(Renderer::HSV(${toCppHex(s.fill!)}, 0.8));`
        : `ctx.set_stroke(${toCppHex(s.stroke)});`
    );
    out.push(`ctx.set_line_width(${trimNum(s.lineWidth, o.decimals)});`);
  }
  if (s.roundCap) out.push("ctx.round_line_cap();");
  if (s.roundJoin) out.push("ctx.round_line_join();");
  out.push("ctx.begin_path();");
  for (const c of s.cmds) out.push(cmdToCpp(c, o, radius));
  // fill() is even-odd in gardn; fill(1) is the nonzero opt-in
  if (s.fill !== null) out.push(s.fillRule === "nonzero" ? "ctx.fill(1);" : "ctx.fill();");
  if (s.stroke !== null && s.lineWidth > 0) out.push("ctx.stroke();");
  return out;
}

const pascal = (s: string) =>
  (s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""))
    .replace(/^[a-z]/, (c) => c.toUpperCase()) || "MyPetal");

export function exportCpp(doc: Doc, opts: Partial<CppOptions> = {}): string {
  const o = { ...defaultCppOptions, ...opts };
  const body: string[] = [];
  for (const s of doc.shapes) body.push(...shapeToCpp(s, o, doc.radius));

  if (!o.wrapCase) return body.join("\n");

  const id = `k${pascal(doc.name)}`;
  const lines = [
    `// paste into draw_static_petal_single (Client/Assets/Petal.cc)`,
    `// requires PetalID::${id} with .radius = ${trimNum(doc.radius, 2)}`,
    `case PetalID::${id}: {`,
    ...body.map((l) => `    ${l}`),
    `    break;`,
    `}`,
  ];
  return lines.join("\n");
}

/** The PETAL_DATA table entry to go alongside the draw case. */
export function exportPetalData(doc: Doc): string {
  const rarityNames = [
    "kCommon", "kUnusual", "kRare", "kEpic", "kLegendary",
    "kMythic", "kUltra", "kSuper", "kOmega", "kUnique",
  ];
  return [
    `{`,
    `    .name = "${doc.name}",`,
    `    .description = "Made with flrrpetalmaker",`,
    `    .health = 10.0,`,
    `    .damage = 10.0,`,
    `    .radius = ${trimNum(doc.radius, 2)},`,
    `    .reload = 2.5,`,
    `    .count = ${Math.max(1, doc.count)},`,
    `    .rarity = RarityID::${rarityNames[doc.rarity] ?? "kCommon"},`,
    `    .attributes = {${doc.iconAngle ? `\n        .icon_angle = ${trimNum(doc.iconAngle, 3)}\n    ` : ""}}`,
    `},`,
  ].join("\n");
}

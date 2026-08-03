import { toCppHex, deriveStroke } from "@/src/engine/color";
import {
  ATTRIBUTE_ORDER, EQUIPMENT_ENUM, MOB_ENUM, RARITY_ENUM, ROTATION_ENUM, STAT_FIELDS,
} from "@/src/engine/stats";
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

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** float literals keep a decimal point, matching the style of the real table */
const fl = (n: number) => {
  const s = trimNum(n, 4);
  return s.includes(".") ? s : `${s}.0`;
};

/**
 * The full PETAL_DATA table entry.
 *
 * Only non-default attributes are emitted, which is what keeps the real table
 * readable, and they are emitted in ATTRIBUTE_ORDER because C++ designated
 * initializers must follow declaration order.
 */
export function exportPetalData(doc: Doc): string {
  const st = doc.stats as unknown as Record<string, number>;
  const defs = new Map(STAT_FIELDS.map((f) => [f.key, f.def]));
  const isDefault = (k: string) => {
    const d = defs.get(k);
    return d === undefined || Math.abs((st[k] ?? 0) - d) < 1e-9;
  };

  const attrs: string[] = [];
  for (const key of ATTRIBUTE_ORDER) {
    if (key === "poison_damage") {
      const dmg = st.poison_damage_damage ?? 0;
      const time = st.poison_damage_time ?? 0;
      if (dmg === 0 && time === 0) continue;
      attrs.push(
        `.poison_damage = {\n            .damage = ${fl(dmg)},\n            .time = ${fl(time)}\n        }`
      );
      continue;
    }
    // icon_angle lives on the Doc as well, since the artwork previews use it
    const v = key === "icon_angle" ? doc.iconAngle : st[key];
    if (key === "icon_angle" ? Math.abs(doc.iconAngle) < 1e-9 : isDefault(key)) continue;

    if (key === "rotation_style")
      attrs.push(`.rotation_style = PetalAttributes::${ROTATION_ENUM[v] ?? "kPassiveRot"}`);
    else if (key === "spawns")
      attrs.push(`.spawns = MobID::${MOB_ENUM[v] ?? "kNumMobs"}`);
    else if (key === "equipment")
      attrs.push(`.equipment = EquipmentFlags::${EQUIPMENT_ENUM[v] ?? "kNone"}`);
    else if (key === "defend_only" || key === "split_projectile" || key === "spawn_count")
      attrs.push(`.${key} = ${Math.round(v)}`);
    else attrs.push(`.${key} = ${fl(v)}`);
  }

  const attrBlock = attrs.length
    ? `{\n        ${attrs.join(",\n        ")}\n    }`
    : `{}`;

  return [
    `{`,
    `    .name = "${esc(doc.name)}",`,
    `    .description = "${esc(doc.description || "")}",`,
    `    .health = ${fl(doc.stats.health)},`,
    `    .damage = ${fl(doc.stats.damage)},`,
    `    .radius = ${fl(doc.radius)},`,
    `    .reload = ${fl(doc.stats.reload)},`,
    `    .count = ${Math.max(0, Math.round(doc.count))},`,
    `    .rarity = RarityID::${RARITY_ENUM[doc.rarity] ?? "kCommon"},`,
    `    .attributes = ${attrBlock}`,
    `},`,
  ].join("\n");
}

/** Everything needed to add the petal to the game, in paste order. */
export function exportAll(doc: Doc, opts: Partial<CppOptions> = {}): string {
  const id = `k${pascal(doc.name)}`;
  return [
    `// ---------------------------------------------------------------------`,
    `// 1. Shared/StaticDefinitions.hh -- append to the PetalID enum.`,
    `//    APPEND ONLY: ids are persisted to localStorage by index.`,
    `// ---------------------------------------------------------------------`,
    `        ${id},`,
    ``,
    `// ---------------------------------------------------------------------`,
    `// 2. Shared/StaticData.cc -- append to PETAL_DATA, same position as the`,
    `//    enum entry (the table is positionally initialised).`,
    `// ---------------------------------------------------------------------`,
    exportPetalData(doc),
    ``,
    `// ---------------------------------------------------------------------`,
    `// 3. Client/Assets/Petal.cc -- add to draw_static_petal_single.`,
    `// ---------------------------------------------------------------------`,
    exportCpp(doc, opts),
  ].join("\n");
}

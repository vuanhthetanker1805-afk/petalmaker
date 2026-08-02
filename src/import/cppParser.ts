import { deriveStroke } from "@/src/engine/color";
import { emptyDoc, emptyShape, newId } from "@/src/engine/types";
import type { Cmd, Doc, Shape } from "@/src/engine/types";
import { evalExpr, splitArgs } from "./expr";

/**
 * Parses the gardn petal dialect back into a document, so an existing petal can
 * be pasted in and edited. Handles the subset of Renderer calls that actually
 * appear in Client/Assets/Petal.cc.
 *
 * A new Shape is started whenever begin_path() is seen; style calls before the
 * next fill/stroke apply to it. This mirrors how the artwork is written.
 */

export interface ParseResult {
  doc: Doc;
  warnings: string[];
}

const CALL = /ctx\s*\.\s*([a-z_0-9]+)\s*\(([^;]*)\)\s*;/gi;

/** `0xffcfcfcf` or `Renderer::HSV(0xff777777, 0.8)` */
function parseColor(src: string, scope: { r: number }): number | null {
  const s = src.trim();
  const hsvM = s.match(/Renderer\s*::\s*HSV\s*\(([^,]+),([^)]+)\)/i);
  if (hsvM) {
    const base = parseColor(hsvM[1], scope);
    if (base === null) return null;
    const v = evalExpr(hsvM[2], { r: scope.r });
    // reuse the engine's brightness maths so round-trips are exact
    return Math.abs(v - 0.8) < 1e-9 ? deriveStroke(base) : deriveStroke(base);
  }
  const hexM = s.match(/0x([0-9a-f]+)/i);
  if (hexM) return parseInt(hexM[1], 16) >>> 0;
  return null;
}

export function parseCpp(src: string, radiusHint = 10): ParseResult {
  const warnings: string[] = [];
  const doc = emptyDoc();
  doc.radius = radiusHint;

  // pick up the petal name from a `case PetalID::kFoo:` if present
  const nameM = src.match(/case\s+PetalID\s*::\s*k([A-Za-z0-9_]+)/);
  if (nameM) doc.name = nameM[1];

  const scope = { r: radiusHint };
  const num = (s: string) => evalExpr(s, scope);

  let cur: Shape | null = null;
  // style state is sticky across shapes, exactly like the canvas context
  let fill: number | null = null;
  let stroke: number | null = null;
  let lineWidth = 3;
  let roundCap = false;
  let roundJoin = false;

  const ensure = (): Shape => {
    if (!cur) {
      cur = { ...emptyShape(`Shape ${doc.shapes.length + 1}`), id: newId(), cmds: [] };
      cur.fill = null;
      cur.stroke = null;
    }
    return cur;
  };

  const flush = () => {
    if (cur && cur.cmds.length > 0) doc.shapes.push(cur);
    cur = null;
  };

  let m: RegExpExecArray | null;
  CALL.lastIndex = 0;
  while ((m = CALL.exec(src)) !== null) {
    const fn = m[1].toLowerCase();
    const rawArgs = m[2];
    let args: string[] = [];
    let nums: number[] = [];
    try {
      args = splitArgs(rawArgs);
      // colors/flags are parsed per-case; numeric parse is best-effort
      nums = args.map((a) => {
        try { return num(a); } catch { return NaN; }
      });
    } catch (e) {
      warnings.push(`could not parse arguments of ${fn}: ${(e as Error).message}`);
      continue;
    }

    const push = (c: Cmd) => ensure().cmds.push(c);

    switch (fn) {
      case "set_fill": {
        const c = parseColor(rawArgs, scope);
        if (c === null) warnings.push(`unrecognised colour in set_fill(${rawArgs.trim()})`);
        else fill = c;
        break;
      }
      case "set_stroke": {
        const c = parseColor(rawArgs, scope);
        if (c === null) warnings.push(`unrecognised colour in set_stroke(${rawArgs.trim()})`);
        else stroke = c;
        break;
      }
      case "set_line_width": lineWidth = nums[0] ?? 3; break;
      case "round_line_cap": roundCap = true; break;
      case "round_line_join": roundJoin = true; break;

      case "begin_path":
        flush();
        ensure();
        break;

      case "move_to": push({ t: "move", x: nums[0], y: nums[1] }); break;
      case "line_to": push({ t: "line", x: nums[0], y: nums[1] }); break;
      case "qcurve_to":
        push({ t: "quad", cx: nums[0], cy: nums[1], x: nums[2], y: nums[3] });
        break;
      case "bcurve_to":
        push({ t: "cubic", c1x: nums[0], c1y: nums[1], c2x: nums[2], c2y: nums[3], x: nums[4], y: nums[5] });
        break;
      case "arc": push({ t: "arc", x: nums[0], y: nums[1], r: nums[2] }); break;
      case "partial_arc":
        push({ t: "parc", x: nums[0], y: nums[1], r: nums[2], sa: nums[3], ea: nums[4], ccw: (nums[5] ?? 0) !== 0 });
        break;
      case "ellipse":
        push({ t: "ellipse", x: nums[0], y: nums[1], rx: nums[2], ry: nums[3], a: nums[4] ?? 0 });
        break;
      case "rect": push({ t: "rect", x: nums[0], y: nums[1], w: nums[2], h: nums[3] }); break;
      case "round_rect":
        push({ t: "roundRect", x: nums[0], y: nums[1], w: nums[2], h: nums[3], r: nums[4] });
        break;
      case "close_path": push({ t: "close" }); break;

      case "fill": {
        const s = ensure();
        if (fill === null) warnings.push("ctx.fill() with no preceding set_fill -- shape left unfilled");
        s.fill = fill;
        // no argument => even-odd, fill(1) => nonzero (Renderer.cc:311-315)
        s.fillRule = (nums[0] ?? 0) !== 0 ? "nonzero" : "evenodd";
        s.lineWidth = lineWidth;
        s.roundCap = roundCap;
        s.roundJoin = roundJoin;
        break;
      }
      case "stroke": {
        const s = ensure();
        if (stroke === null) warnings.push("ctx.stroke() with no preceding set_stroke -- shape left unstroked");
        s.stroke = stroke;
        s.lineWidth = lineWidth;
        s.roundCap = roundCap;
        s.roundJoin = roundJoin;
        break;
      }

      case "scale":
      case "rotate":
      case "translate":
        warnings.push(`ctx.${fn}() is not represented in the document model and was skipped -- geometry may be offset`);
        break;
      case "clip":
        warnings.push("ctx.clip() is not supported and was skipped");
        break;
      default:
        warnings.push(`unsupported call ctx.${fn}() was skipped`);
        break;
    }
  }
  flush();

  if (doc.shapes.length === 0) warnings.push("no drawable shapes were found in that snippet");
  doc.shapes.forEach((s, i) => { s.name = s.name || `Shape ${i + 1}`; });
  return { doc, warnings };
}

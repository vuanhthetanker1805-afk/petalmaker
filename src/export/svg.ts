import { A, toHex6 } from "@/src/engine/color";
import { docBounds } from "@/src/engine/render";
import type { Cmd, Doc, Shape } from "@/src/engine/types";

const n = (v: number) => {
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
};

/** Sample a full ellipse as two SVG arc halves (A cannot express 360 degrees). */
function ellipsePath(x: number, y: number, rx: number, ry: number, a: number) {
  const cos = Math.cos(a), sin = Math.sin(a);
  const px = (dx: number, dy: number) => `${n(x + dx * cos - dy * sin)} ${n(y + dx * sin + dy * cos)}`;
  const deg = (a * 180) / Math.PI;
  return `M ${px(-rx, 0)} A ${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${px(rx, 0)} A ${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${px(-rx, 0)} Z`;
}

function arcSegment(x: number, y: number, r: number, sa: number, ea: number, ccw: boolean) {
  // normalise sweep the same way canvas does
  let delta = ea - sa;
  if (!ccw) { while (delta < 0) delta += Math.PI * 2; if (delta > Math.PI * 2) delta = Math.PI * 2; }
  else { while (delta > 0) delta -= Math.PI * 2; if (delta < -Math.PI * 2) delta = -Math.PI * 2; }
  const full = Math.abs(Math.abs(delta) - Math.PI * 2) < 1e-6;
  const sx = x + r * Math.cos(sa), sy = y + r * Math.sin(sa);
  if (full) return ellipsePath(x, y, r, r, 0);
  const ex = x + r * Math.cos(sa + delta), ey = y + r * Math.sin(sa + delta);
  const large = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweep = delta > 0 ? 1 : 0;
  return `L ${n(sx)} ${n(sy)} A ${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(ex)} ${n(ey)}`;
}

function cmdsToPath(cmds: Cmd[]): string {
  const parts: string[] = [];
  for (const c of cmds) {
    switch (c.t) {
      case "move": parts.push(`M ${n(c.x)} ${n(c.y)}`); break;
      case "line": parts.push(`L ${n(c.x)} ${n(c.y)}`); break;
      case "quad": parts.push(`Q ${n(c.cx)} ${n(c.cy)} ${n(c.x)} ${n(c.y)}`); break;
      case "cubic":
        parts.push(`C ${n(c.c1x)} ${n(c.c1y)} ${n(c.c2x)} ${n(c.c2y)} ${n(c.x)} ${n(c.y)}`);
        break;
      case "arc": parts.push(ellipsePath(c.x, c.y, c.r, c.r, 0)); break;
      case "parc": parts.push(arcSegment(c.x, c.y, c.r, c.sa, c.ea, c.ccw)); break;
      case "ellipse": parts.push(ellipsePath(c.x, c.y, c.rx, c.ry, c.a)); break;
      case "rect":
        parts.push(`M ${n(c.x)} ${n(c.y)} h ${n(c.w)} v ${n(c.h)} h ${n(-c.w)} Z`);
        break;
      case "roundRect": {
        const { x, y, w, h, r } = c;
        parts.push(
          `M ${n(x + r)} ${n(y)} L ${n(x + w - r)} ${n(y)} Q ${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}` +
          ` L ${n(x + w)} ${n(y + h - r)} Q ${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}` +
          ` L ${n(x + r)} ${n(y + h)} Q ${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}` +
          ` L ${n(x)} ${n(y + r)} Q ${n(x)} ${n(y)} ${n(x + r)} ${n(y)}`
        );
        break;
      }
      case "close": parts.push("Z"); break;
    }
  }
  return parts.join(" ");
}

function shapeToSvg(s: Shape): string {
  if (!s.visible || s.cmds.length === 0) return "";
  const attrs: string[] = [`d="${cmdsToPath(s.cmds)}"`];
  if (s.fill !== null) {
    attrs.push(`fill="${toHex6(s.fill)}"`);
    if (A(s.fill) < 255) attrs.push(`fill-opacity="${n(A(s.fill) / 255)}"`);
    // gardn's default fill is even-odd, so carry that through faithfully
    attrs.push(`fill-rule="${s.fillRule}"`);
  } else {
    attrs.push(`fill="none"`);
  }
  if (s.stroke !== null && s.lineWidth > 0) {
    attrs.push(`stroke="${toHex6(s.stroke)}"`);
    if (A(s.stroke) < 255) attrs.push(`stroke-opacity="${n(A(s.stroke) / 255)}"`);
    attrs.push(`stroke-width="${n(s.lineWidth)}"`);
    attrs.push(`stroke-linecap="${s.roundCap ? "round" : "butt"}"`);
    attrs.push(`stroke-linejoin="${s.roundJoin ? "round" : "miter"}"`);
  }
  return `  <path ${attrs.join(" ")} />`;
}

export function exportSvg(doc: Doc, pad = 4): string {
  const b = docBounds(doc);
  const half = b
    ? Math.max(Math.abs(b.minX), Math.abs(b.maxX), Math.abs(b.minY), Math.abs(b.maxY)) + pad
    : doc.radius + pad;
  const size = half * 2;
  const body = doc.shapes.map(shapeToSvg).filter(Boolean).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-half)} ${n(-half)} ${n(size)} ${n(size)}" width="${Math.round(size * 4)}" height="${Math.round(size * 4)}">`,
    `  <title>${doc.name}</title>`,
    body,
    `</svg>`,
  ].join("\n");
}

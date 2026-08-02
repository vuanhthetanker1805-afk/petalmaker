import { GardnCtx } from "./gardnCanvas";
import { hsv } from "./color";
import { RARITY_COLORS } from "@/src/data/rarity";
import type { Cmd, Doc, Shape } from "./types";

/** Replay one shape's command list onto the context's current path. */
export function pathShape(g: GardnCtx, cmds: Cmd[]) {
  for (const c of cmds) {
    switch (c.t) {
      case "move": g.moveTo(c.x, c.y); break;
      case "line": g.lineTo(c.x, c.y); break;
      case "quad": g.qcurveTo(c.cx, c.cy, c.x, c.y); break;
      case "cubic": g.bcurveTo(c.c1x, c.c1y, c.c2x, c.c2y, c.x, c.y); break;
      case "arc": g.arc(c.x, c.y, c.r); break;
      case "parc": g.partialArc(c.x, c.y, c.r, c.sa, c.ea, c.ccw); break;
      case "ellipse": g.ellipse(c.x, c.y, c.rx, c.ry, c.a); break;
      case "rect": g.rect(c.x, c.y, c.w, c.h); break;
      case "roundRect": g.roundRect(c.x, c.y, c.w, c.h, c.r); break;
      case "close": g.closePath(); break;
    }
  }
}

export function drawShape(g: GardnCtx, s: Shape) {
  if (!s.visible || s.cmds.length === 0) return;
  if (s.roundCap) g.roundLineCap(); else g.buttLineCap();
  if (s.roundJoin) g.roundLineJoin(); else g.miterLineJoin();
  g.beginPath();
  pathShape(g, s.cmds);
  if (s.fill !== null) {
    g.setFill(s.fill);
    g.fill(s.fillRule === "nonzero");
  }
  if (s.stroke !== null && s.lineWidth > 0) {
    g.setStroke(s.stroke);
    g.setLineWidth(s.lineWidth);
    g.stroke();
  }
}

/** One petal, centred on the current origin -- draw_static_petal_single. */
export function drawDoc(g: GardnCtx, doc: Doc) {
  for (const s of doc.shapes) drawShape(g, s);
}

/**
 * The clump form -- port of draw_static_petal (Petal.cc:1267-1280): `count`
 * copies rotated evenly and pushed out by clump radius.
 */
export function drawDocClump(g: GardnCtx, doc: Doc, clumpRadius = 10) {
  const count = Math.max(1, doc.count);
  for (let i = 0; i < count; i++) {
    g.save();
    g.rotate((i * 2 * Math.PI) / count);
    if (count > 1) g.translate(clumpRadius, 0);
    g.rotate(doc.iconAngle);
    drawDoc(g, doc);
    g.restore();
  }
}

/**
 * The inventory tile -- port of draw_loadout_background (Petal.cc:1282-1311):
 * a HSV(rarity, 0.8) rounded border, flat rarity square, then the petal scaled
 * to 0.833 and clamped when radius > 20.
 */
export function drawLoadoutTile(g: GardnCtx, doc: Doc, size = 60) {
  const col = RARITY_COLORS[doc.rarity] ?? RARITY_COLORS[0];
  const k = size / 60;
  g.save();
  g.scale(k);
  g.setFill(hsv(col, 0.8));
  g.beginPath();
  g.roundRect(-30, -30, 60, 60, 3);
  g.fill();
  g.setFill(col);
  g.beginPath();
  g.roundRect(-25, -25, 50, 50, 2);
  g.fill();
  g.save();
  g.scale(0.833);
  if (doc.radius > 20) g.scale(20 / doc.radius);
  drawDocClump(g, doc);
  g.restore();
  g.restore();
}

/** Axis-aligned bounds of a shape, sampling curves coarsely. Editor-only. */
export function shapeBounds(s: Shape) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const c of s.cmds) {
    switch (c.t) {
      case "move": case "line": add(c.x, c.y); break;
      case "quad": add(c.cx, c.cy); add(c.x, c.y); break;
      case "cubic": add(c.c1x, c.c1y); add(c.c2x, c.c2y); add(c.x, c.y); break;
      case "arc": add(c.x - c.r, c.y - c.r); add(c.x + c.r, c.y + c.r); break;
      case "parc": add(c.x - c.r, c.y - c.r); add(c.x + c.r, c.y + c.r); break;
      case "ellipse": add(c.x - c.rx, c.y - c.ry); add(c.x + c.rx, c.y + c.ry); break;
      case "rect": case "roundRect": add(c.x, c.y); add(c.x + c.w, c.y + c.h); break;
      case "close": break;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

export function docBounds(doc: Doc) {
  let b: ReturnType<typeof shapeBounds> = null;
  for (const s of doc.shapes) {
    const sb = shapeBounds(s);
    if (!sb) continue;
    b = b
      ? {
          minX: Math.min(b.minX, sb.minX), minY: Math.min(b.minY, sb.minY),
          maxX: Math.max(b.maxX, sb.maxX), maxY: Math.max(b.maxY, sb.maxY),
        }
      : sb;
  }
  return b;
}

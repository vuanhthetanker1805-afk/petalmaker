import { toCss } from "./color";

/**
 * A faithful port of the gardn Renderer's drawing surface
 * (Client/Render/Renderer.cc). Using this instead of raw Canvas2D is what makes
 * the editor preview match the game, because two defaults differ from the
 * browser's:
 *
 *   - fill() is EVEN-ODD unless you pass nonzero (Renderer.cc:311-315)
 *   - colors are 0xAARRGGBB integers, not CSS strings
 *
 * round_rect is reproduced exactly as gardn implements it (Renderer.cc:293-303)
 * -- as line/quad segments, and notably without begin_path or close_path.
 */
export class GardnCtx {
  constructor(readonly c: CanvasRenderingContext2D) {}

  save() { this.c.save(); }
  restore() { this.c.restore(); }
  translate(x: number, y: number) { this.c.translate(x, y); }
  rotate(a: number) { this.c.rotate(a); }
  scale(x: number, y = x) { this.c.scale(x, y); }
  setGlobalAlpha(v: number) { this.c.globalAlpha = v; }

  setFill(argb: number) { this.c.fillStyle = toCss(argb); }
  setStroke(argb: number) { this.c.strokeStyle = toCss(argb); }
  setLineWidth(w: number) { this.c.lineWidth = w; }
  roundLineCap() { this.c.lineCap = "round"; }
  roundLineJoin() { this.c.lineJoin = "round"; }
  buttLineCap() { this.c.lineCap = "butt"; }
  miterLineJoin() { this.c.lineJoin = "miter"; }

  beginPath() { this.c.beginPath(); }
  moveTo(x: number, y: number) { this.c.moveTo(x, y); }
  lineTo(x: number, y: number) { this.c.lineTo(x, y); }
  qcurveTo(cx: number, cy: number, x: number, y: number) { this.c.quadraticCurveTo(cx, cy, x, y); }
  bcurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.c.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
  }
  partialArc(x: number, y: number, r: number, sa: number, ea: number, ccw: boolean) {
    this.c.arc(x, y, Math.abs(r), sa, ea, ccw);
  }
  arc(x: number, y: number, r: number) { this.partialArc(x, y, r, 0, Math.PI * 2, false); }
  ellipse(x: number, y: number, rx: number, ry: number, a = 0) {
    this.c.ellipse(x, y, Math.abs(rx), Math.abs(ry), a, 0, Math.PI * 2, false);
  }
  rect(x: number, y: number, w: number, h: number) { this.c.rect(x, y, w, h); }

  /** Renderer.cc:293-303 verbatim -- emits no begin_path/close_path of its own. */
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.qcurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.qcurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.qcurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.qcurveTo(x, y, x + r, y);
  }

  closePath() { this.c.closePath(); }
  /** Default is even-odd, matching gardn -- NOT the Canvas2D default. */
  fill(nonzero = false) { this.c.fill(nonzero ? "nonzero" : "evenodd"); }
  stroke() { this.c.stroke(); }
  clip() { this.c.clip(); }
}

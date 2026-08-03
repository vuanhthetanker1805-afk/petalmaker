"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GardnCtx } from "@/src/engine/gardnCanvas";
import { drawShape } from "@/src/engine/render";
import { moveNode, shapeNodes } from "@/src/engine/types";
import type { Cmd, Shape } from "@/src/engine/types";
import { chrome, chromeAlpha } from "./canvasTheme";
import type { Editor } from "./useEditor";

interface Props { ed: Editor; }

type Drag =
  | { kind: "none" }
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "node"; shapeId: string; cmdIndex: number; slot: "p" | "c1" | "c2" }
  | { kind: "shape"; shapeId: string; lastX: number; lastY: number }
  | { kind: "create"; cx: number; cy: number; shapeId: string }
  | { kind: "penHandle"; shapeId: string; cmdIndex: number };

const GRID = 5;

export default function EditorCanvas({ ed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const drag = useRef<Drag>({ kind: "none" });
  const [penOpen, setPenOpen] = useState<string | null>(null);

  const { doc, beginStroke, sel, setSel, tool, setTool, addShape, updateShape } = ed;

  // ---- coordinate transforms -------------------------------------------
  const toWorld = useCallback(
    (px: number, py: number) => {
      const c = canvasRef.current!;
      const r = c.getBoundingClientRect();
      return {
        x: (px - r.left - r.width / 2 - pan.x) / zoom,
        y: (py - r.top - r.height / 2 - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );
  const snapV = useCallback((v: number) => (snap ? Math.round(v * 2) / 2 : v), [snap]);

  // ---- rendering --------------------------------------------------------
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = `${w}px`; c.style.height = `${h}px`;

    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = chrome("--color-sunken");
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);

    // grid + axes, drawn in screen space so line weights stay crisp
    if (showGrid) {
      const step = GRID * zoom;
      const nx = Math.ceil(w / 2 / step) + 1, ny = Math.ceil(h / 2 / step) + 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = chrome("--color-rule-soft");
      ctx.beginPath();
      for (let i = -nx; i <= nx; i++) { ctx.moveTo(i * step, -h); ctx.lineTo(i * step, h); }
      for (let j = -ny; j <= ny; j++) { ctx.moveTo(-w, j * step); ctx.lineTo(w, j * step); }
      ctx.stroke();
    }
    ctx.strokeStyle = chrome("--color-rule");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
    ctx.moveTo(0, -h); ctx.lineTo(0, h);
    ctx.stroke();

    // the radius guide -- artwork is authored at PETAL_DATA[id].radius
    ctx.strokeStyle = chromeAlpha("--color-accent", 0.45);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, doc.radius * zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // the artwork itself, through the gardn-faithful renderer
    ctx.save();
    ctx.scale(zoom, zoom);
    const g = new GardnCtx(ctx);
    for (const s of doc.shapes) drawShape(g, s);
    ctx.restore();

    // selection overlay
    const selShape = doc.shapes.find((s) => s.id === sel.shapeId);
    if (selShape) {
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = chrome("--color-accent");
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.beginPath();
      const gg = new GardnCtx(ctx);
      for (const cmd of selShape.cmds) {
        switch (cmd.t) {
          case "move": gg.moveTo(cmd.x, cmd.y); break;
          case "line": gg.lineTo(cmd.x, cmd.y); break;
          case "quad": gg.qcurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y); break;
          case "cubic": gg.bcurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y); break;
          case "arc": gg.arc(cmd.x, cmd.y, cmd.r); break;
          case "parc": gg.partialArc(cmd.x, cmd.y, cmd.r, cmd.sa, cmd.ea, cmd.ccw); break;
          case "ellipse": gg.ellipse(cmd.x, cmd.y, cmd.rx, cmd.ry, cmd.a); break;
          case "rect": gg.rect(cmd.x, cmd.y, cmd.w, cmd.h); break;
          case "roundRect": gg.roundRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.r); break;
          case "close": gg.closePath(); break;
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // control handles (screen space so they stay a constant size)
      for (const n of shapeNodes(selShape)) {
        const sx = n.x * zoom, sy = n.y * zoom;
        const isSel =
          sel.node?.shapeId === n.shapeId &&
          sel.node.cmdIndex === n.cmdIndex &&
          sel.node.slot === n.slot;
        const ctrl = n.slot !== "p";
        ctx.beginPath();
        if (ctrl) ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        else ctx.rect(sx - 4, sy - 4, 8, 8);
        ctx.fillStyle = isSel ? chrome("--color-warn") : ctrl ? chromeAlpha("--color-accent", 0.7) : chrome("--color-accent");
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = chrome("--color-sunken");
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [doc, sel, zoom, pan, showGrid]);

  // redraw on resize
  useEffect(() => {
    const on = () => setPan((p) => ({ ...p }));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // ---- hit testing ------------------------------------------------------
  const hitNode = (wx: number, wy: number) => {
    const s = doc.shapes.find((x) => x.id === sel.shapeId);
    if (!s) return null;
    const tol = 7 / zoom;
    for (const n of shapeNodes(s)) {
      if (Math.abs(n.x - wx) <= tol && Math.abs(n.y - wy) <= tol) return n;
    }
    return null;
  };

  const hitShape = (wx: number, wy: number): Shape | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d")!;
    // topmost first
    for (let i = doc.shapes.length - 1; i >= 0; i--) {
      const s = doc.shapes[i];
      if (!s.visible || s.locked) continue;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = new GardnCtx(ctx);
      ctx.beginPath();
      for (const cmd of s.cmds) {
        switch (cmd.t) {
          case "move": g.moveTo(cmd.x, cmd.y); break;
          case "line": g.lineTo(cmd.x, cmd.y); break;
          case "quad": g.qcurveTo(cmd.cx, cmd.cy, cmd.x, cmd.y); break;
          case "cubic": g.bcurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y); break;
          case "arc": g.arc(cmd.x, cmd.y, cmd.r); break;
          case "parc": g.partialArc(cmd.x, cmd.y, cmd.r, cmd.sa, cmd.ea, cmd.ccw); break;
          case "ellipse": g.ellipse(cmd.x, cmd.y, cmd.rx, cmd.ry, cmd.a); break;
          case "rect": g.rect(cmd.x, cmd.y, cmd.w, cmd.h); break;
          case "roundRect": g.roundRect(cmd.x, cmd.y, cmd.w, cmd.h, cmd.r); break;
          case "close": g.closePath(); break;
        }
      }
      const inFill = s.fill !== null && ctx.isPointInPath(wx, wy, s.fillRule);
      ctx.lineWidth = Math.max(s.lineWidth, 6 / zoom);
      const inStroke = s.stroke !== null && ctx.isPointInStroke(wx, wy);
      ctx.restore();
      if (inFill || inStroke) return s;
    }
    return null;
  };

  // ---- pointer handling -------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = toWorld(e.clientX, e.clientY);

    if (e.button === 1 || e.altKey) {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }

    if (tool === "select") {
      const n = hitNode(x, y);
      if (n) {
        setSel((s) => ({ ...s, node: { shapeId: n.shapeId, cmdIndex: n.cmdIndex, slot: n.slot } }));
        beginStroke();
        drag.current = { kind: "node", shapeId: n.shapeId, cmdIndex: n.cmdIndex, slot: n.slot };
        return;
      }
      const s = hitShape(x, y);
      setSel({ shapeId: s?.id ?? null, node: null });
      if (s) {
        beginStroke();
        drag.current = { kind: "shape", shapeId: s.id, lastX: x, lastY: y };
      }
      return;
    }

    if (tool === "pen") {
      const sx = snapV(x), sy = snapV(y);
      if (penOpen) {
        const shape = doc.shapes.find((v) => v.id === penOpen);
        if (shape) {
          updateShape(penOpen, (v) => ({ cmds: [...v.cmds, { t: "line", x: sx, y: sy } as Cmd] }));
          drag.current = { kind: "penHandle", shapeId: penOpen, cmdIndex: shape.cmds.length };
        }
      } else {
        const s = addShape([{ t: "move", x: sx, y: sy }], `Path ${doc.shapes.length + 1}`);
        setPenOpen(s.id);
      }
      return;
    }

    // shape tools: drag from centre
    const cx = snapV(x), cy = snapV(y);
    let cmds: Cmd[] = [];
    if (tool === "circle") cmds = [{ t: "arc", x: cx, y: cy, r: 0.5 }];
    else if (tool === "ellipse") cmds = [{ t: "ellipse", x: cx, y: cy, rx: 0.5, ry: 0.5, a: 0 }];
    else if (tool === "rect") cmds = [{ t: "rect", x: cx - 0.5, y: cy - 0.5, w: 1, h: 1 }];
    else if (tool === "roundRect") cmds = [{ t: "roundRect", x: cx - 0.5, y: cy - 0.5, w: 1, h: 1, r: 0.3 }];
    else if (tool === "polygon") cmds = polygonCmds(cx, cy, 0.5, 6);
    const s = addShape(cmds, `${tool} ${doc.shapes.length + 1}`);
    drag.current = { kind: "create", cx, cy, shapeId: s.id };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.kind === "none") return;
    const { x, y } = toWorld(e.clientX, e.clientY);

    if (d.kind === "pan") {
      setPan({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
      return;
    }
    if (d.kind === "node") {
      const sx = snapV(x), sy = snapV(y);
      updateShape(d.shapeId, (s) => ({
        cmds: s.cmds.map((c, i) => (i === d.cmdIndex ? moveNode(c, d.slot, sx, sy) : c)),
      }), false);
      return;
    }
    if (d.kind === "shape") {
      const dx = x - d.lastX, dy = y - d.lastY;
      drag.current = { ...d, lastX: x, lastY: y };
      updateShape(d.shapeId, (s) => ({ cmds: s.cmds.map((c) => translateCmd(c, dx, dy)) }), false);
      return;
    }
    if (d.kind === "penHandle") {
      // dragging just after placing a point converts it into a cubic
      const sx = snapV(x), sy = snapV(y);
      updateShape(d.shapeId, (s) => {
        const cmds = [...s.cmds];
        const prev = cmds[d.cmdIndex - 1];
        const px = prev && "x" in prev ? prev.x : 0;
        const py = prev && "y" in prev ? prev.y : 0;
        const cur = cmds[d.cmdIndex];
        const ex = "x" in cur ? cur.x : sx, ey = "y" in cur ? cur.y : sy;
        const dx = sx - ex, dy = sy - ey;
        cmds[d.cmdIndex] = {
          t: "cubic",
          c1x: px + (ex - px) / 3, c1y: py + (ey - py) / 3,
          c2x: ex - dx, c2y: ey - dy,
          x: ex, y: ey,
        };
        return { cmds };
      }, false);
      return;
    }
    if (d.kind === "create") {
      const rx = Math.max(0.25, Math.abs(snapV(x) - d.cx));
      const ry = Math.max(0.25, Math.abs(snapV(y) - d.cy));
      const r = Math.max(0.25, Math.hypot(x - d.cx, y - d.cy));
      updateShape(d.shapeId, (s) => {
        const c = s.cmds[0];
        if (!c) return {};
        if (c.t === "arc") return { cmds: [{ ...c, r: snapV(r) }] };
        if (c.t === "ellipse") return { cmds: [{ ...c, rx, ry }] };
        if (c.t === "rect") return { cmds: [{ t: "rect", x: d.cx - rx, y: d.cy - ry, w: rx * 2, h: ry * 2 }] };
        if (c.t === "roundRect")
          return { cmds: [{ t: "roundRect", x: d.cx - rx, y: d.cy - ry, w: rx * 2, h: ry * 2, r: Math.min(rx, ry) * 0.3 }] };
        if (c.t === "move") return { cmds: polygonCmds(d.cx, d.cy, r, 6) };
        return {};
      }, false);
    }
  };

  const onPointerUp = () => {
    if (drag.current.kind === "create") setTool("select");
    drag.current = { kind: "none" };
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((z) => Math.max(1.5, Math.min(120, z * factor)));
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo(); else ed.undo();
        return;
      }
      if (e.key === "Escape") { setPenOpen(null); setTool("select"); return; }
      if (e.key === "Enter" && penOpen) { setPenOpen(null); setTool("select"); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.shapeId) {
        e.preventDefault();
        ed.removeShape(sel.shapeId);
        return;
      }
      const map: Record<string, string> = { v: "select", p: "pen", c: "circle", e: "ellipse", r: "rect", g: "polygon" };
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()] as never);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ed, sel.shapeId, penOpen, setTool]);

  return (
    <div className="relative h-full w-full" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2 text-[11px] text-[var(--color-ink-3)]">
        <span>zoom {zoom.toFixed(1)}x</span>
        <span>alt+drag pans</span>
        {penOpen && <span className="text-[var(--color-warn)]">pen open &mdash; Enter to finish</span>}
      </div>
      <div className="absolute right-2 top-2 flex gap-1">
        <button
          onClick={() => setShowGrid((v) => !v)}
          className={`rounded px-2 py-1 text-[11px] ${showGrid ? "bg-[var(--color-paper-3)] text-[var(--color-ink)]" : "bg-[var(--color-paper-2)] text-[var(--color-ink-3)]"}`}
        >grid</button>
        <button
          onClick={() => setSnap((v) => !v)}
          className={`rounded px-2 py-1 text-[11px] ${snap ? "bg-[var(--color-paper-3)] text-[var(--color-ink)]" : "bg-[var(--color-paper-2)] text-[var(--color-ink-3)]"}`}
        >snap</button>
        <button
          onClick={() => { setZoom(9); setPan({ x: 0, y: 0 }); }}
          className="rounded bg-[var(--color-paper-2)] px-2 py-1 text-[11px] text-[var(--color-ink-3)]"
        >reset view</button>
      </div>
    </div>
  );
}

function polygonCmds(cx: number, cy: number, r: number, n: number): Cmd[] {
  const out: Cmd[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    out.push(i === 0 ? { t: "move", x, y } : { t: "line", x, y });
  }
  out.push({ t: "close" });
  return out;
}

function translateCmd(c: Cmd, dx: number, dy: number): Cmd {
  switch (c.t) {
    case "close": return c;
    case "quad": return { ...c, cx: c.cx + dx, cy: c.cy + dy, x: c.x + dx, y: c.y + dy };
    case "cubic":
      return { ...c, c1x: c.c1x + dx, c1y: c.c1y + dy, c2x: c.c2x + dx, c2y: c.c2y + dy, x: c.x + dx, y: c.y + dy };
    default: return { ...c, x: c.x + dx, y: c.y + dy };
  }
}

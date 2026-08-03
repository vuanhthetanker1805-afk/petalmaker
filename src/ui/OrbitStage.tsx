"use client";
import { useEffect, useRef, useState } from "react";
import { GardnCtx } from "@/src/engine/gardnCanvas";
import { drawDoc } from "@/src/engine/render";
import {
  BASE_FLOWER_RADIUS, MAX_PETALS_IN_CLUMP, MAX_SLOT_COUNT, OrbitSim, TPS, orbitRadius,
} from "@/src/sim/orbit";
import type { Pose, SimSlot } from "@/src/sim/orbit";
import { FLOWER_COLORS } from "@/src/data/rarity";
import { hsv as hsvMul, toHex6 } from "@/src/engine/color";
import { chrome, chromeAlpha } from "./canvasTheme";
import type { Doc } from "@/src/engine/types";

/** the flower outline is the standard HSV(fill, 0.8) shade */
const hsvDim = (c: number) => hsvMul(c, 0.8);

const POSES: Pose[] = ["idle", "attack", "defend"];
const SPEEDS = [0.25, 0.5, 1, 2];

/** Build the simulated loadout: N copies of the petal being designed. */
function slotsFor(doc: Doc, copies: number): SimSlot[] {
  const st = doc.stats;
  const split = st.split_projectile !== 0;
  const size = split ? 1 : Math.min(Math.max(1, doc.count), MAX_PETALS_IN_CLUMP);
  const one: SimSlot = {
    size,
    count: Math.max(1, doc.count),
    clumpRadius: st.clump_radius,
    defendOnly: st.defend_only !== 0,
    rotationStyle: st.rotation_style,
    radius: doc.radius,
    isSubject: true,
  };
  return Array.from({ length: copies }, () => ({ ...one }));
}

export default function OrbitStage({ doc }: { doc: Doc }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<OrbitSim | null>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const [pose, setPose] = useState<Pose>("idle");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [copies, setCopies] = useState(5);
  const [yinYang, setYinYang] = useState(0);
  const [trails, setTrails] = useState(false);
  const [readout, setReadout] = useState({ ring: 0, target: 0, count: 0 });

  // rebuild when the shape of the loadout changes
  useEffect(() => {
    simRef.current = new OrbitSim({
      slots: slotsFor(doc, copies),
      pose,
      extraRange: doc.stats.extra_range,
      extraRotationSpeed: doc.stats.extra_rotation_speed,
      yinYangCount: yinYang,
      playerX: 0, playerY: 0,
    });
    simRef.current.settle(60);
  }, [copies, doc.count, doc.radius, doc.stats.split_projectile, doc.stats.clump_radius, doc.stats.rotation_style]); // eslint-disable-line react-hooks/exhaustive-deps

  // push cheap config changes without rebuilding (keeps the ring spinning)
  useEffect(() => {
    simRef.current?.setConfig({
      slots: slotsFor(doc, copies),
      pose,
      extraRange: doc.stats.extra_range,
      extraRotationSpeed: doc.stats.extra_rotation_speed,
      yinYangCount: yinYang,
      playerX: 0, playerY: 0,
    });
  }, [doc, copies, pose, yinYang]);

  useEffect(() => {
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const sim = simRef.current;
      const c = canvasRef.current;
      const wrap = wrapRef.current;
      if (!sim || !c || !wrap) return;

      const dtMs = lastRef.current ? t - lastRef.current : 16;
      lastRef.current = t;
      if (playing) sim.advance(dtMs / 1000, speed);

      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr; c.height = h * dpr;
        c.style.width = `${w}px`; c.style.height = `${h}px`;
      }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (trails) {
        ctx.fillStyle = chromeAlpha("--color-sunken", 0.1);
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = chrome("--color-sunken");
        ctx.fillRect(0, 0, w, h);
      }

      // fit the widest possible orbit into the box
      const target = sim.targetRange(0) || 65;
      const zoom = Math.min(w, h) / (Math.max(target, 60) * 2.6);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoom, zoom);

      if (!trails) {
        // target ring guide
        ctx.strokeStyle = chromeAlpha("--color-accent", 0.3);
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.arc(0, 0, target, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // the flower
        ctx.fillStyle = toHex6(FLOWER_COLORS[0]);
        ctx.strokeStyle = toHex6(hsvDim(FLOWER_COLORS[0]));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, BASE_FLOWER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      const g = new GardnCtx(ctx);
      for (const p of sim.petals) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (doc.shapes.length > 0) drawDoc(g, doc);
        else {
          ctx.fillStyle = "#ffffff"; // Basic petal fill, Petal.cc:25
          ctx.strokeStyle = "#cfcfcf"; // Basic petal stroke, Petal.cc:26
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, doc.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();

      const first = sim.petals[0];
      setReadout({
        ring: first ? orbitRadius(sim, first) : 0,
        target,
        count: sim.rotationCount(),
      });
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, trails, doc]);

  const btn = (active: boolean) =>
    `ctl h-6 px-2 text-[11px] ${active ? "accent" : ""}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex flex-wrap items-center gap-1 px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--color-rule)" }}
      >
        {POSES.map((p) => (
          <button key={p} onClick={() => setPose(p)} className={btn(pose === p)}>
            {p}
          </button>
        ))}
        <span className="mx-1 h-4 w-px" style={{ background: "var(--color-rule)" }} />
        <button onClick={() => setPlaying((v) => !v)} className={btn(false)}>
          {playing ? "pause" : "play"}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`ctl num h-6 px-1.5 text-[11px] ${speed === s ? "accent" : ""}`}>
            {s}x
          </button>
        ))}
        <button onClick={() => setTrails((v) => !v)} className={btn(trails)}>
          trails
        </button>

        <span className="mx-1 h-4 w-px" style={{ background: "var(--color-rule)" }} />
        <label className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-ink-3)" }}>
          slots
          <input
            type="number" min={1} max={MAX_SLOT_COUNT} value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(MAX_SLOT_COUNT, Number(e.target.value) || 1)))}
            className="ctl num h-6 w-12 px-1 text-right text-[11px]"
          />
        </label>
        <label
          className="flex items-center gap-1 text-[11px]"
          style={{ color: "var(--color-ink-3)" }}
          title="0 forward · 1 reversed · 2 frozen · 15 spins 10x"
        >
          yin yang
          <input
            type="number" min={0} max={MAX_SLOT_COUNT} value={yinYang}
            onChange={(e) => setYinYang(Math.max(0, Math.min(MAX_SLOT_COUNT, Number(e.target.value) || 0)))}
            className="ctl num h-6 w-12 px-1 text-right text-[11px]"
          />
        </label>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <div
          className="num pointer-events-none absolute bottom-2 left-2 flex gap-3 text-[10px]"
          style={{ color: "var(--color-ink-4)" }}
        >
          <span>ring {readout.count}</span>
          <span>target {readout.target.toFixed(1)}</span>
          <span>actual {readout.ring.toFixed(1)}</span>
          <span>{TPS} tick/s</span>
        </div>
        {yinYang % 3 === 2 && yinYang !== MAX_SLOT_COUNT && (
          <div
            className="pointer-events-none absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--color-warn-dim)", color: "var(--color-warn)" }}
          >
            ring frozen — 2 Yin Yangs stop rotation entirely
          </div>
        )}
      </div>
    </div>
  );
}

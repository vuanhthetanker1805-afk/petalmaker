"use client";
import { useEffect, useRef } from "react";
import { GardnCtx } from "@/src/engine/gardnCanvas";
import { drawDoc, drawDocClump, drawLoadoutTile } from "@/src/engine/render";
import type { Doc } from "@/src/engine/types";

type Mode = "single" | "clump" | "tile";

/**
 * Renders through the same GardnCtx the editor uses, so what you see here is
 * what the game will draw -- including even-odd fill.
 */
export function PetalPreview({
  doc, mode, size = 90, scale, bg = "#141920",
}: { doc: Doc; mode: Mode; size?: number; scale?: number; bg?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (bg !== "transparent") { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    const g = new GardnCtx(ctx);
    if (mode === "tile") {
      drawLoadoutTile(g, doc, size * 0.86);
    } else {
      // fit the artwork to the box unless an explicit scale is given
      const k = scale ?? (size * 0.4) / Math.max(4, doc.radius * (mode === "clump" ? 2.4 : 1.15));
      ctx.scale(k, k);
      if (mode === "clump") drawDocClump(g, doc);
      else drawDoc(g, doc);
    }
    ctx.restore();
  }, [doc, mode, size, scale, bg]);

  return <canvas ref={ref} style={{ width: size, height: size }} className="rounded" />;
}

export default function PreviewStrip({ doc }: { doc: Doc }) {
  return (
    <div className="flex items-start gap-3 p-3">
      {([
        ["single", "petal"],
        ["clump", `clump x${Math.max(1, doc.count)}`],
        ["tile", "loadout"],
      ] as [Mode, string][]).map(([mode, label]) => (
        <div key={mode} className="flex flex-col items-center gap-1">
          <PetalPreview doc={doc} mode={mode} size={84} />
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-ink-3)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

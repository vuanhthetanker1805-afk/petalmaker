"use client";
import { A, deriveStroke, fromHex6, toCppHex, toHex6 } from "@/src/engine/color";
import { PALETTE, RARITY_COLORS, RARITY_NAMES } from "@/src/data/rarity";
import type { Editor } from "./useEditor";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </label>
  );
}

function ColorField({
  value, onChange, onClear,
}: { value: number | null; onChange: (c: number) => void; onClear: () => void }) {
  return (
    <>
      <input
        type="color"
        value={toHex6(value ?? 0xff000000)}
        onChange={(e) => onChange(fromHex6(e.target.value, value === null ? 255 : A(value)))}
        className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-transparent p-0"
      />
      <input
        type="range" min={0} max={255}
        value={value === null ? 255 : A(value)}
        onChange={(e) => onChange(fromHex6(toHex6(value ?? 0xffffffff), Number(e.target.value)))}
        className="w-14 accent-sky-500"
        title="alpha"
      />
      <button
        onClick={onClear}
        className={`rounded px-1.5 py-0.5 text-[10px] ${value === null ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}
        title="none"
      >none</button>
    </>
  );
}

export default function Inspector({ ed }: { ed: Editor }) {
  const { doc, setDoc, selectedShape: s, updateShape } = ed;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Petal</h3>
        <Row label="name">
          <input
            value={doc.name}
            onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))}
            className="w-32 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </Row>
        <Row label="radius">
          <input
            type="number" step={0.5} min={1} max={500} value={doc.radius}
            onChange={(e) => setDoc((d) => ({ ...d, radius: Number(e.target.value) || 1 }))}
            className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none"
          />
        </Row>
        <Row label="count">
          <input
            type="number" step={1} min={1} max={8} value={doc.count}
            onChange={(e) => setDoc((d) => ({ ...d, count: Math.max(1, Number(e.target.value) || 1) }))}
            className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none"
          />
        </Row>
        <Row label="icon angle">
          <input
            type="number" step={0.1} value={doc.iconAngle}
            onChange={(e) => setDoc((d) => ({ ...d, iconAngle: Number(e.target.value) || 0 }))}
            className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none"
          />
        </Row>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rarity</h3>
        <div className="grid grid-cols-5 gap-1">
          {RARITY_COLORS.map((c, i) => (
            <button
              key={i}
              title={RARITY_NAMES[i]}
              onClick={() => setDoc((d) => ({ ...d, rarity: i }))}
              className={`h-7 rounded border text-[9px] font-medium ${doc.rarity === i ? "border-white" : "border-transparent"}`}
              style={{ background: toHex6(c), color: "#00000099" }}
            >
              {RARITY_NAMES[i].slice(0, 3)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {RARITY_NAMES[doc.rarity]} &middot; {toCppHex(RARITY_COLORS[doc.rarity])}
        </p>
      </section>

      <section className="border-t border-slate-800 pt-2">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Shape {s ? "" : <span className="normal-case text-slate-600">&mdash; none selected</span>}
        </h3>
        {s && (
          <>
            <Row label="fill">
              <ColorField
                value={s.fill}
                onChange={(c) => updateShape(s.id, { fill: c })}
                onClear={() => updateShape(s.id, { fill: s.fill === null ? 0xffffffff : null })}
              />
            </Row>
            <Row label="stroke">
              <ColorField
                value={s.stroke}
                onChange={(c) => updateShape(s.id, { stroke: c })}
                onClear={() => updateShape(s.id, { stroke: s.stroke === null ? 0xff000000 : null })}
              />
            </Row>
            <button
              onClick={() => s.fill !== null && updateShape(s.id, { stroke: deriveStroke(s.fill) })}
              disabled={s.fill === null}
              className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              title="stroke = Renderer::HSV(fill, 0.8), the gardn outline idiom"
            >
              derive stroke from fill (HSV 0.8)
            </button>
            <Row label="line width">
              <input
                type="number" step={0.5} min={0} value={s.lineWidth}
                onChange={(e) => updateShape(s.id, { lineWidth: Number(e.target.value) || 0 })}
                className="w-20 rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none"
              />
            </Row>
            <Row label="fill rule">
              <button
                onClick={() => updateShape(s.id, { fillRule: s.fillRule === "evenodd" ? "nonzero" : "evenodd" })}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
                title="gardn's ctx.fill() is even-odd; fill(1) is nonzero"
              >
                {s.fillRule}
              </button>
            </Row>
            <Row label="caps / joins">
              <button
                onClick={() => updateShape(s.id, { roundCap: !s.roundCap })}
                className={`rounded px-2 py-0.5 text-[10px] ${s.roundCap ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}
              >cap</button>
              <button
                onClick={() => updateShape(s.id, { roundJoin: !s.roundJoin })}
                className={`rounded px-2 py-0.5 text-[10px] ${s.roundJoin ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}
              >join</button>
            </Row>
            <div className="mt-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">palette</p>
              <div className="grid grid-cols-6 gap-1">
                {PALETTE.map((p) => (
                  <button
                    key={p.name} title={p.name}
                    onClick={() => updateShape(s.id, { fill: p.c, stroke: deriveStroke(p.c) })}
                    className="h-5 rounded border border-slate-700"
                    style={{ background: toHex6(p.c) }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

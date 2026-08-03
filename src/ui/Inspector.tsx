"use client";
import { A, deriveStroke, fromHex6, toCppHex, toHex6 } from "@/src/engine/color";
import { PALETTE, RARITY_COLORS, RARITY_NAMES } from "@/src/data/rarity";
import type { Editor } from "./useEditor";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-ink-4)" }}>
        {label}
      </span>
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
        className="ctl h-6 w-8 cursor-pointer p-0"
      />
      <input
        type="range" min={0} max={255}
        value={value === null ? 255 : A(value)}
        onChange={(e) => onChange(fromHex6(toHex6(value ?? 0xffffffff), Number(e.target.value)))}
        className="w-14"
        style={{ accentColor: "var(--color-accent)" }}
        title="alpha"
      />
      <button
        onClick={onClear}
        className={`ctl h-5 px-1.5 text-[10px] ${value === null ? "accent" : ""}`}
        title="no fill / no stroke"
      >none</button>
    </>
  );
}

export default function Inspector({ ed }: { ed: Editor }) {
  const { doc, setDoc, selectedShape: s, updateShape } = ed;

  return (
    <div className="flex flex-col gap-3 p-2.5 text-[12px]">
      <section>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2)" }}>
          Petal
        </h3>
        <Row label="name">
          <input
            value={doc.name}
            onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))}
            className="ctl h-6 w-32 px-1.5 text-[11px]"
          />
        </Row>
        <label className="block py-1">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--color-ink-4)" }}>
            description
          </span>
          <textarea
            value={doc.description}
            onChange={(e) => setDoc((d) => ({ ...d, description: e.target.value }))}
            rows={2}
            placeholder="shown in the in-game tooltip"
            className="ctl mt-1 w-full resize-none px-1.5 py-1 text-[11px] leading-snug"
          />
        </label>
        <Row label="radius">
          <input
            type="number" step={0.5} min={1} max={500} value={doc.radius}
            onChange={(e) => setDoc((d) => ({ ...d, radius: Number(e.target.value) || 1 }))}
            className="ctl num h-6 w-20 px-1.5 text-right text-[11px]"
          />
        </Row>
        <Row label="count">
          <input
            type="number" step={1} min={0} max={4} value={doc.count}
            onChange={(e) => setDoc((d) => ({ ...d, count: Math.max(0, Number(e.target.value) || 0) }))}
            className="ctl num h-6 w-20 px-1.5 text-right text-[11px]"
          />
        </Row>
        <p className="text-[10px]" style={{ color: "var(--color-ink-4)" }}>
          count 0 makes it an equipment-only petal that never spawns
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2)" }}>
          Rarity
        </h3>
        <div className="grid grid-cols-5 gap-1">
          {RARITY_COLORS.map((c, i) => (
            <button
              key={i}
              title={RARITY_NAMES[i]}
              onClick={() => setDoc((d) => ({ ...d, rarity: i }))}
              className="h-7 rounded-[3px] text-[9px] font-semibold"
              style={{
                background: toHex6(c),
                color: "#00000099",
                outline: doc.rarity === i ? "2px solid var(--color-ink)" : "none",
                outlineOffset: "1px",
              }}
            >
              {RARITY_NAMES[i].slice(0, 3)}
            </button>
          ))}
        </div>
        <p className="num mt-1 text-[10px]" style={{ color: "var(--color-ink-4)" }}>
          {RARITY_NAMES[doc.rarity]} · {toCppHex(RARITY_COLORS[doc.rarity])}
        </p>
      </section>

      <section style={{ borderTop: "1px solid var(--color-rule)", paddingTop: "0.5rem" }}>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2)" }}>
          Shape{" "}
          {!s && <span className="normal-case" style={{ color: "var(--color-ink-4)" }}>— none selected</span>}
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
              className="ctl mt-1 w-full px-2 py-1 text-[11px]"
              title="stroke = Renderer::HSV(fill, 0.8), the gardn outline idiom"
            >
              derive stroke from fill (HSV 0.8)
            </button>
            <Row label="line width">
              <input
                type="number" step={0.5} min={0} value={s.lineWidth}
                onChange={(e) => updateShape(s.id, { lineWidth: Number(e.target.value) || 0 })}
                className="ctl num h-6 w-20 px-1.5 text-right text-[11px]"
              />
            </Row>
            <Row label="fill rule">
              <button
                onClick={() => updateShape(s.id, { fillRule: s.fillRule === "evenodd" ? "nonzero" : "evenodd" })}
                className="ctl num h-6 px-2 text-[10px]"
                title="gardn's ctx.fill() is even-odd; fill(1) is nonzero"
              >
                {s.fillRule}
              </button>
            </Row>
            <Row label="caps / joins">
              <button
                onClick={() => updateShape(s.id, { roundCap: !s.roundCap })}
                className={`ctl h-5 px-2 text-[10px] ${s.roundCap ? "accent" : ""}`}
              >cap</button>
              <button
                onClick={() => updateShape(s.id, { roundJoin: !s.roundJoin })}
                className={`ctl h-5 px-2 text-[10px] ${s.roundJoin ? "accent" : ""}`}
              >join</button>
            </Row>
            <div className="mt-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--color-ink-4)" }}>
                palette
              </p>
              <div className="grid grid-cols-6 gap-1">
                {PALETTE.map((p) => (
                  <button
                    key={p.name} title={p.name}
                    onClick={() => updateShape(s.id, { fill: p.c, stroke: deriveStroke(p.c) })}
                    className="h-5 rounded-[3px]"
                    style={{ background: toHex6(p.c), border: "1px solid var(--color-rule)" }}
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

"use client";
import { toHex6 } from "@/src/engine/color";
import type { Editor } from "./useEditor";

export default function Layers({ ed }: { ed: Editor }) {
  const { doc, sel, setSel, updateShape, removeShape, duplicateShape, reorderShape } = ed;

  return (
    <div className="flex flex-col p-3 text-sm">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
        Layers <span className="text-[var(--color-ink-4)]">({doc.shapes.length})</span>
      </h3>
      {doc.shapes.length === 0 && (
        <p className="py-2 text-[11px] text-[var(--color-ink-4)]">
          Nothing yet. Pick a tool and drag on the canvas, or paste petal code via Import.
        </p>
      )}
      <ul className="flex flex-col-reverse gap-0.5">
        {doc.shapes.map((s) => (
          <li
            key={s.id}
            onClick={() => setSel({ shapeId: s.id, node: null })}
            className={`group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 ${
              sel.shapeId === s.id ? "bg-[var(--color-paper-2)] ring-1 ring-[var(--color-accent)]" : "hover:bg-[var(--color-paper-2)]"
            }`}
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-[var(--color-rule)]"
              style={{ background: s.fill !== null ? toHex6(s.fill) : "transparent" }}
            />
            <input
              value={s.name}
              onChange={(e) => updateShape(s.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-xs text-[var(--color-ink)] outline-none"
            />
            <span className="text-[10px] text-[var(--color-ink-4)]">{s.cmds.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); updateShape(s.id, { visible: !s.visible }); }}
              className="px-1 text-[10px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
              title="visibility"
            >{s.visible ? "◉" : "○"}</button>
            <button
              onClick={(e) => { e.stopPropagation(); reorderShape(s.id, 1); }}
              className="px-0.5 text-[10px] text-[var(--color-ink-4)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-ink)]"
              title="bring forward"
            >▲</button>
            <button
              onClick={(e) => { e.stopPropagation(); reorderShape(s.id, -1); }}
              className="px-0.5 text-[10px] text-[var(--color-ink-4)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-ink)]"
              title="send back"
            >▼</button>
            <button
              onClick={(e) => { e.stopPropagation(); duplicateShape(s.id); }}
              className="px-0.5 text-[10px] text-[var(--color-ink-4)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-ink)]"
              title="duplicate"
            >⧉</button>
            <button
              onClick={(e) => { e.stopPropagation(); removeShape(s.id); }}
              className="px-0.5 text-[10px] text-[var(--color-ink-4)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)]"
              title="delete"
            >✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";
import { toHex6 } from "@/src/engine/color";
import type { Editor } from "./useEditor";

export default function Layers({ ed }: { ed: Editor }) {
  const { doc, sel, setSel, updateShape, removeShape, duplicateShape, reorderShape } = ed;

  return (
    <div className="flex flex-col p-3 text-sm">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Layers <span className="text-slate-600">({doc.shapes.length})</span>
      </h3>
      {doc.shapes.length === 0 && (
        <p className="py-2 text-[11px] text-slate-600">
          Nothing yet. Pick a tool and drag on the canvas, or paste petal code via Import.
        </p>
      )}
      <ul className="flex flex-col-reverse gap-0.5">
        {doc.shapes.map((s) => (
          <li
            key={s.id}
            onClick={() => setSel({ shapeId: s.id, node: null })}
            className={`group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 ${
              sel.shapeId === s.id ? "bg-sky-950 ring-1 ring-sky-700" : "hover:bg-slate-800"
            }`}
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-600"
              style={{ background: s.fill !== null ? toHex6(s.fill) : "transparent" }}
            />
            <input
              value={s.name}
              onChange={(e) => updateShape(s.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none"
            />
            <span className="text-[10px] text-slate-600">{s.cmds.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); updateShape(s.id, { visible: !s.visible }); }}
              className="px-1 text-[10px] text-slate-500 hover:text-slate-200"
              title="visibility"
            >{s.visible ? "◉" : "○"}</button>
            <button
              onClick={(e) => { e.stopPropagation(); reorderShape(s.id, 1); }}
              className="px-0.5 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-200"
              title="bring forward"
            >▲</button>
            <button
              onClick={(e) => { e.stopPropagation(); reorderShape(s.id, -1); }}
              className="px-0.5 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-200"
              title="send back"
            >▼</button>
            <button
              onClick={(e) => { e.stopPropagation(); duplicateShape(s.id); }}
              className="px-0.5 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-200"
              title="duplicate"
            >⧉</button>
            <button
              onClick={(e) => { e.stopPropagation(); removeShape(s.id); }}
              className="px-0.5 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 hover:text-rose-400"
              title="delete"
            >✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

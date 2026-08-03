"use client";
import type { ToolId } from "@/src/engine/types";
import type { Editor } from "./useEditor";

const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "pen", label: "Pen", key: "P" },
  { id: "circle", label: "Circle", key: "C" },
  { id: "ellipse", label: "Ellipse", key: "E" },
  { id: "rect", label: "Rect", key: "R" },
  { id: "roundRect", label: "Round", key: "" },
  { id: "polygon", label: "Polygon", key: "G" },
];

export default function Toolbar({ ed }: { ed: Editor }) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--color-rule)] bg-[var(--color-paper-1)] px-2 py-1.5">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => ed.setTool(t.id)}
          title={t.key ? `${t.label} (${t.key})` : t.label}
          className={`rounded px-2.5 py-1 text-xs font-medium ${
            ed.tool === t.id ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-[var(--color-paper-2)]" />
      <button
        onClick={ed.undo}
        className="rounded px-2 py-1 text-xs text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
        title="Undo (Ctrl+Z)"
      >Undo</button>
      <button
        onClick={ed.redo}
        className="rounded px-2 py-1 text-xs text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
        title="Redo (Ctrl+Shift+Z)"
      >Redo</button>
    </div>
  );
}

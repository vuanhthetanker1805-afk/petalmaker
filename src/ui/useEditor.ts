"use client";
import { useCallback, useMemo, useState } from "react";
import { emptyDoc, emptyShape, newId } from "@/src/engine/types";
import type { Cmd, Doc, Shape, ToolId } from "@/src/engine/types";

export interface Selection {
  shapeId: string | null;
  node: { shapeId: string; cmdIndex: number; slot: "p" | "c1" | "c2" } | null;
}

const HISTORY_LIMIT = 100;

/**
 * doc + undo stacks live in a single state object so history is never read from
 * a ref during render (which would not trigger re-renders for canUndo/canRedo).
 */
interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
}

export function useEditor(initial?: Doc) {
  const [st, setSt] = useState<State>(() => ({
    doc: initial ?? emptyDoc(),
    past: [],
    future: [],
  }));
  const [sel, setSel] = useState<Selection>({ shapeId: null, node: null });
  const [tool, setTool] = useState<ToolId>("select");

  const push = (past: Doc[], d: Doc) => [...past, d].slice(-HISTORY_LIMIT);

  /** commit=false coalesces a drag into whatever history entry is already open */
  const setDoc = useCallback((next: Doc | ((d: Doc) => Doc), commit = true) => {
    setSt((s) => {
      const value = typeof next === "function" ? (next as (d: Doc) => Doc)(s.doc) : next;
      if (value === s.doc) return s;
      return commit
        ? { doc: value, past: push(s.past, s.doc), future: [] }
        : { ...s, doc: value };
    });
  }, []);

  /** Snapshot before a drag starts so the whole drag undoes as one step. */
  const beginStroke = useCallback(() => {
    setSt((s) => ({ ...s, past: push(s.past, s.doc), future: [] }));
  }, []);

  const undo = useCallback(() => {
    setSt((s) =>
      s.past.length === 0
        ? s
        : {
            doc: s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [...s.future, s.doc],
          }
    );
  }, []);

  const redo = useCallback(() => {
    setSt((s) =>
      s.future.length === 0
        ? s
        : {
            doc: s.future[s.future.length - 1],
            past: [...s.past, s.doc],
            future: s.future.slice(0, -1),
          }
    );
  }, []);

  const doc = st.doc;

  const selectedShape = useMemo(
    () => doc.shapes.find((s) => s.id === sel.shapeId) ?? null,
    [doc, sel.shapeId]
  );

  const updateShape = useCallback(
    (id: string, patch: Partial<Shape> | ((s: Shape) => Partial<Shape>), commit = true) => {
      setDoc(
        (d) => ({
          ...d,
          shapes: d.shapes.map((s) =>
            s.id === id ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s
          ),
        }),
        commit
      );
    },
    [setDoc]
  );

  const addShape = useCallback(
    (cmds: Cmd[], name?: string, style?: Partial<Shape>) => {
      const s: Shape = {
        ...emptyShape(name ?? `Shape ${Date.now() % 1000}`),
        id: newId(),
        cmds,
        ...style,
      };
      setDoc((d) => ({ ...d, shapes: [...d.shapes, s] }));
      setSel({ shapeId: s.id, node: null });
      return s;
    },
    [setDoc]
  );

  const removeShape = useCallback(
    (id: string) => {
      setDoc((d) => ({ ...d, shapes: d.shapes.filter((s) => s.id !== id) }));
      setSel((s) => (s.shapeId === id ? { shapeId: null, node: null } : s));
    },
    [setDoc]
  );

  const duplicateShape = useCallback(
    (id: string) => {
      setDoc((d) => {
        const i = d.shapes.findIndex((s) => s.id === id);
        if (i < 0) return d;
        const copy: Shape = {
          ...structuredClone(d.shapes[i]),
          id: newId(),
          name: `${d.shapes[i].name} copy`,
        };
        const shapes = [...d.shapes];
        shapes.splice(i + 1, 0, copy);
        return { ...d, shapes };
      });
    },
    [setDoc]
  );

  const reorderShape = useCallback(
    (id: string, dir: -1 | 1) => {
      setDoc((d) => {
        const i = d.shapes.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.shapes.length) return d;
        const shapes = [...d.shapes];
        [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
        return { ...d, shapes };
      });
    },
    [setDoc]
  );

  return {
    doc, setDoc, beginStroke,
    sel, setSel, selectedShape,
    tool, setTool,
    undo, redo,
    canUndo: st.past.length > 0,
    canRedo: st.future.length > 0,
    updateShape, addShape, removeShape, duplicateShape, reorderShape,
  };
}

export type Editor = ReturnType<typeof useEditor>;

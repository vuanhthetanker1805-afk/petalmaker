"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EditorCanvas from "@/src/ui/EditorCanvas";
import ExportPanel from "@/src/ui/ExportPanel";
import Inspector from "@/src/ui/Inspector";
import Layers from "@/src/ui/Layers";
import PreviewStrip from "@/src/ui/Preview";
import Toolbar from "@/src/ui/Toolbar";
import { useEditor } from "@/src/ui/useEditor";
import { STARTERS } from "@/src/data/starters";
import type { Doc } from "@/src/engine/types";

const LS_KEY = "flrrpetalmaker.doc";

export default function EditorPage() {
  const ed = useEditor();
  const { doc, setDoc } = ed;
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  // a ref, not state: nothing renders from it, and it must not cause a re-render
  const restored = useRef(false);

  // restore the last session (localStorage is unavailable during SSR)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setDoc(JSON.parse(raw) as Doc, false);
    } catch { /* corrupt or unavailable storage -- start fresh */ }
    restored.current = true;
  }, [setDoc]);

  useEffect(() => {
    if (!restored.current) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch { /* quota */ }
  }, [doc]);

  const publish = useCallback(async () => {
    setSaving(true);
    setSavedId(null);
    try {
      const res = await fetch("/api/petals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(doc),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      setSavedId(json.petal.id);
    } catch (e) {
      alert(`Could not publish: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [doc]);

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight">
          flrr<span className="text-sky-400">petal</span>maker
        </h1>
        <span className="hidden text-[11px] text-slate-500 sm:inline">
          vector petal editor for gardn
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            onChange={(e) => {
              const s = STARTERS.find((x) => x.name === e.target.value);
              if (s) setDoc(structuredClone(s.doc));
              e.target.selectedIndex = 0;
            }}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 outline-none"
            defaultValue=""
          >
            <option value="" disabled>load example…</option>
            {STARTERS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <button
            onClick={() => { if (confirm("Clear the canvas?")) setDoc((d) => ({ ...d, shapes: [] })); }}
            className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >Clear</button>
          <button
            onClick={publish}
            disabled={saving || doc.shapes.length === 0}
            className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >{saving ? "publishing…" : "Publish"}</button>
          <Link href="/gallery" className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700">
            Gallery
          </Link>
        </div>
      </header>

      {savedId && (
        <div className="flex items-center gap-2 border-b border-emerald-900 bg-emerald-950 px-4 py-1.5 text-xs">
          <span className="text-emerald-300">Published.</span>
          <Link href={`/p/${savedId}`} className="text-emerald-200 underline">/p/{savedId}</Link>
          <button
            onClick={() => navigator.clipboard?.writeText(`${location.origin}/p/${savedId}`)}
            className="rounded bg-emerald-800 px-2 py-0.5 text-[11px]"
          >copy link</button>
          <button onClick={() => setSavedId(null)} className="ml-auto text-emerald-500">dismiss</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900">
          <Inspector ed={ed} />
          <div className="border-t border-slate-800"><Layers ed={ed} /></div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar ed={ed} />
          <div className="min-h-0 flex-1"><EditorCanvas ed={ed} /></div>
          <div className="border-t border-slate-800 bg-slate-900"><PreviewStrip doc={doc} /></div>
        </main>

        <aside className="flex w-[26rem] shrink-0 flex-col border-l border-slate-800 bg-slate-900">
          <ExportPanel doc={doc} onImport={(d) => setDoc({ ...d, rarity: doc.rarity })} />
        </aside>
      </div>
    </div>
  );
}

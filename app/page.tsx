"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EditorCanvas from "@/src/ui/EditorCanvas";
import ExportPanel from "@/src/ui/ExportPanel";
import Inspector from "@/src/ui/Inspector";
import Layers from "@/src/ui/Layers";
import OrbitStage from "@/src/ui/OrbitStage";
import PreviewStrip from "@/src/ui/Preview";
import StatsPanel from "@/src/ui/StatsPanel";
import Toolbar from "@/src/ui/Toolbar";
import { useEditor } from "@/src/ui/useEditor";
import { STARTERS } from "@/src/data/starters";
import { migrateDoc } from "@/src/engine/types";

const LS_KEY = "flrrpetalmaker.doc";

type Stage = "draw" | "orbit";
type Rail = "shape" | "stats";

export default function EditorPage() {
  const ed = useEditor();
  const { doc, setDoc } = ed;
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("draw");
  const [rail, setRail] = useState<Rail>("shape");
  const [exportOpen, setExportOpen] = useState(true);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setDoc(migrateDoc(JSON.parse(raw)), false);
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

  const tab = (active: boolean) =>
    `ctl h-7 px-3 text-[11px] font-medium ${active ? "accent" : ""}`;

  return (
    <div
      className="flex h-dvh flex-col"
      style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
    >
      {/* ---- app bar ---- */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2"
        style={{ background: "var(--color-paper-1)", borderBottom: "1px solid var(--color-rule)" }}
      >
        <h1 className="text-[13px] font-semibold tracking-tight">
          flrr<span style={{ color: "var(--color-accent)" }}>petal</span>maker
        </h1>
        <span className="hidden text-[11px] sm:inline" style={{ color: "var(--color-ink-4)" }}>
          petal designer for gardn
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            onChange={(e) => {
              const s = STARTERS.find((x) => x.name === e.target.value);
              if (s) setDoc(migrateDoc(structuredClone(s.doc)));
              e.target.selectedIndex = 0;
            }}
            className="ctl h-7 px-1.5 text-[11px]"
            defaultValue=""
          >
            <option value="" disabled>load example…</option>
            {STARTERS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <button
            onClick={() => { if (confirm("Clear the artwork? Stats are kept.")) setDoc((d) => ({ ...d, shapes: [] })); }}
            className="ctl h-7 px-2.5 text-[11px]"
          >Clear</button>
          <button
            onClick={publish}
            disabled={saving || doc.shapes.length === 0}
            className="ctl h-7 px-3 text-[11px] font-medium"
            data-state={saving ? "loading" : undefined}
            style={saving ? undefined : { background: "var(--color-ok)", color: "#08140c", borderColor: "var(--color-ok)" }}
          >{saving ? "publishing…" : "Publish"}</button>
          <Link href="/gallery" className="ctl flex h-7 items-center px-2.5 text-[11px]">
            Gallery
          </Link>
        </div>
      </header>

      {savedId && (
        <div
          className="flex shrink-0 items-center gap-2 px-3 py-1.5 text-[11px]"
          style={{ background: "var(--color-paper-2)", borderBottom: "1px solid var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ok)" }}>Published.</span>
          <Link href={`/p/${savedId}`} className="underline">/p/{savedId}</Link>
          <button
            onClick={() => navigator.clipboard?.writeText(`${location.origin}/p/${savedId}`)}
            className="ctl h-5 px-1.5 text-[10px]"
          >copy link</button>
          <button onClick={() => setSavedId(null)} className="ml-auto" style={{ color: "var(--color-ink-4)" }}>
            dismiss
          </button>
        </div>
      )}

      {/* ---- workbench: rail | stage | inspector ---- */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* left rail */}
        <aside
          className="flex w-full shrink-0 flex-col lg:w-[17rem] lg:max-w-[17rem]"
          style={{ background: "var(--color-paper-1)", borderRight: "1px solid var(--color-rule)" }}
        >
          <div className="flex shrink-0 gap-1 p-1.5" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <button onClick={() => setRail("shape")} className={`${tab(rail === "shape")} flex-1`}>
              Shape
            </button>
            <button onClick={() => setRail("stats")} className={`${tab(rail === "stats")} flex-1`}>
              Stats
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-none max-h-[40vh]">
            {rail === "shape" ? (
              <>
                <Inspector ed={ed} />
                <div style={{ borderTop: "1px solid var(--color-rule)" }}><Layers ed={ed} /></div>
              </>
            ) : (
              <StatsPanel ed={ed} />
            )}
          </div>
        </aside>

        {/* centre stage */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="flex shrink-0 items-center gap-1 px-2 py-1.5"
            style={{ background: "var(--color-paper-1)", borderBottom: "1px solid var(--color-rule)" }}
          >
            <button onClick={() => setStage("draw")} className={tab(stage === "draw")}>Draw</button>
            <button onClick={() => setStage("orbit")} className={tab(stage === "orbit")}>Orbit</button>
            <span className="ml-auto text-[10px]" style={{ color: "var(--color-ink-4)" }}>
              {stage === "draw" ? "V select · P pen · C circle · alt+drag pans" : "live simulation of the in-game orbit"}
            </span>
          </div>

          {stage === "draw" ? (
            <>
              <Toolbar ed={ed} />
              <div className="min-h-0 flex-1"><EditorCanvas ed={ed} /></div>
              <div className="shrink-0" style={{ background: "var(--color-paper-1)", borderTop: "1px solid var(--color-rule)" }}>
                <PreviewStrip doc={doc} />
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1"><OrbitStage doc={doc} /></div>
          )}
        </main>

        {/* right inspector: export drawer */}
        <aside
          className="flex shrink-0 flex-col lg:w-[25rem] lg:max-w-[25rem]"
          style={{ background: "var(--color-paper-1)", borderLeft: "1px solid var(--color-rule)" }}
        >
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="flex shrink-0 items-center gap-2 px-2 py-1.5 text-left lg:hidden"
            style={{ borderBottom: "1px solid var(--color-rule)" }}
            aria-expanded={exportOpen}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2)" }}>
              Export
            </span>
            <span className="ml-auto text-[10px]" style={{ color: "var(--color-ink-3)" }}>
              {exportOpen ? "hide" : "show"}
            </span>
          </button>
          <div className={`min-h-0 flex-1 ${exportOpen ? "flex" : "hidden"} flex-col lg:flex`}>
            <ExportPanel doc={doc} onImport={(d) => setDoc(migrateDoc({ ...d, rarity: doc.rarity }))} />
          </div>
        </aside>
      </div>
    </div>
  );
}

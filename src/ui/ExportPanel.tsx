"use client";
import { useMemo, useState } from "react";
import { defaultCppOptions, exportCpp, exportPetalData } from "@/src/export/cpp";
import { exportSvg } from "@/src/export/svg";
import { parseCpp } from "@/src/import/cppParser";
import type { Doc } from "@/src/engine/types";

type Tab = "cpp" | "data" | "svg" | "json" | "import";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch { /* clipboard blocked -- the textarea is still selectable */ }
      }}
      className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600"
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({
  doc, onImport,
}: { doc: Doc; onImport: (d: Doc) => void }) {
  const [tab, setTab] = useState<Tab>("cpp");
  const [useRadius, setUseRadius] = useState(defaultCppOptions.useRadius);
  const [wrapCase, setWrapCase] = useState(defaultCppOptions.wrapCase);
  const [pasted, setPasted] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const cpp = useMemo(() => exportCpp(doc, { useRadius, wrapCase }), [doc, useRadius, wrapCase]);
  const data = useMemo(() => exportPetalData(doc), [doc]);
  const svg = useMemo(() => exportSvg(doc), [doc]);
  const json = useMemo(() => JSON.stringify(doc, null, 2), [doc]);

  const body = tab === "cpp" ? cpp : tab === "data" ? data : tab === "svg" ? svg : json;

  const doImport = () => {
    const res = parseCpp(pasted, doc.radius);
    setWarnings(res.warnings);
    if (res.doc.shapes.length > 0) onImport(res.doc);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-slate-800 px-2 py-1.5">
        {(["cpp", "data", "svg", "json", "import"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              tab === t ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "cpp" ? "petal code" : t === "data" ? "PETAL_DATA" : t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {tab === "cpp" && (
            <>
              <button
                onClick={() => setUseRadius((v) => !v)}
                className={`rounded px-2 py-1 text-[10px] ${useRadius ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-500"}`}
                title="emit coordinates as multiples of r instead of literals"
              >r-scaled</button>
              <button
                onClick={() => setWrapCase((v) => !v)}
                className={`rounded px-2 py-1 text-[10px] ${wrapCase ? "bg-slate-700 text-slate-200" : "bg-slate-800 text-slate-500"}`}
              >case block</button>
            </>
          )}
          {tab === "svg" && (
            <button
              onClick={() => download(`${doc.name || "petal"}.svg`, svg, "image/svg+xml")}
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300"
            >download</button>
          )}
          {tab === "json" && (
            <button
              onClick={() => download(`${doc.name || "petal"}.json`, json, "application/json")}
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300"
            >download</button>
          )}
          {tab !== "import" && <CopyButton text={body} />}
          {tab === "import" && (
            <button onClick={doImport} className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600">
              parse
            </button>
          )}
        </div>
      </div>

      {tab === "import" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="px-3 pt-2 text-[11px] text-slate-500">
            Paste a <code className="text-slate-400">draw_static_petal_single</code> case from
            Petal.cc (or any ctx.* calls) to load it for editing.
          </p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            spellCheck={false}
            placeholder={"case PetalID::kBasic:\n    ctx.set_fill(0xffffffff);\n    ctx.begin_path();\n    ctx.arc(0,0,r);\n    ctx.fill();\n    break;"}
            className="m-3 min-h-0 flex-1 resize-none rounded bg-slate-950 p-3 font-mono text-[11px] text-slate-200 outline-none ring-1 ring-slate-800 focus:ring-sky-700"
          />
          {warnings.length > 0 && (
            <ul className="max-h-24 overflow-auto border-t border-slate-800 px-3 py-2 text-[11px] text-amber-400">
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <textarea
          readOnly
          value={body}
          spellCheck={false}
          className="m-3 min-h-0 flex-1 resize-none rounded bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200 outline-none ring-1 ring-slate-800"
        />
      )}
    </div>
  );
}

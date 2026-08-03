"use client";
import { useMemo, useState } from "react";
import { defaultCppOptions, exportAll, exportCpp, exportPetalData } from "@/src/export/cpp";
import { exportSvg } from "@/src/export/svg";
import { parseCpp } from "@/src/import/cppParser";
import type { Doc } from "@/src/engine/types";

type Tab = "all" | "cpp" | "data" | "svg" | "json" | "import";

const TABS: { id: Tab; label: string; title: string }[] = [
  { id: "all", label: "everything", title: "enum line + PETAL_DATA entry + draw case" },
  { id: "cpp", label: "draw code", title: "the draw_static_petal_single case" },
  { id: "data", label: "PETAL_DATA", title: "the stats table entry" },
  { id: "svg", label: "svg", title: "vector export" },
  { id: "json", label: "json", title: "project file" },
  { id: "import", label: "import", title: "paste gardn C++ back in" },
];

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("success");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1400);
      }}
      data-state={state === "idle" ? undefined : state}
      className="ctl accent h-6 px-3 text-[11px] font-medium"
    >
      {state === "success" ? "copied" : state === "error" ? "blocked" : "copy"}
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
  const [tab, setTab] = useState<Tab>("all");
  const [useRadius, setUseRadius] = useState(defaultCppOptions.useRadius);
  const [wrapCase, setWrapCase] = useState(defaultCppOptions.wrapCase);
  const [pasted, setPasted] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [imported, setImported] = useState<number | null>(null);

  const body = useMemo(() => {
    switch (tab) {
      case "all": return exportAll(doc, { useRadius });
      case "cpp": return exportCpp(doc, { useRadius, wrapCase });
      case "data": return exportPetalData(doc);
      case "svg": return exportSvg(doc);
      case "json": return JSON.stringify(doc, null, 2);
      default: return "";
    }
  }, [tab, doc, useRadius, wrapCase]);

  const doImport = () => {
    const res = parseCpp(pasted, doc.radius);
    setWarnings(res.warnings);
    setImported(res.doc.shapes.length);
    // a PETAL_DATA-only paste has no shapes but still carries every stat
    if (res.doc.shapes.length > 0 || /\.rarity\s*=|\.attributes\s*=/.test(pasted)) {
      onImport(res.doc);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 flex-wrap items-center gap-1 px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--color-rule)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setTab(t.id)}
            className={`ctl h-6 px-2 text-[11px] ${tab === t.id ? "accent" : ""}`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {(tab === "cpp" || tab === "all") && (
            <button
              onClick={() => setUseRadius((v) => !v)}
              className={`ctl h-6 px-1.5 text-[10px] ${useRadius ? "accent" : ""}`}
              title="emit coordinates as multiples of r instead of literals"
            >r-scaled</button>
          )}
          {tab === "cpp" && (
            <button
              onClick={() => setWrapCase((v) => !v)}
              className={`ctl h-6 px-1.5 text-[10px] ${wrapCase ? "accent" : ""}`}
            >case block</button>
          )}
          {tab === "svg" && (
            <button onClick={() => download(`${doc.name || "petal"}.svg`, body, "image/svg+xml")} className="ctl h-6 px-1.5 text-[10px]">
              download
            </button>
          )}
          {tab === "json" && (
            <button onClick={() => download(`${doc.name || "petal"}.json`, body, "application/json")} className="ctl h-6 px-1.5 text-[10px]">
              download
            </button>
          )}
          {tab !== "import" ? (
            <CopyButton text={body} />
          ) : (
            <button onClick={doImport} disabled={!pasted.trim()} className="ctl accent h-6 px-3 text-[11px] font-medium">
              parse
            </button>
          )}
        </div>
      </div>

      {tab === "import" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="px-3 pt-2 text-[11px]" style={{ color: "var(--color-ink-3)" }}>
            Paste a <code className="num">PETAL_DATA</code> entry, a{" "}
            <code className="num">draw_static_petal_single</code> case, or both.
            Stats and artwork are read independently.
          </p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            spellCheck={false}
            placeholder={"{\n    .name = \"Basic\",\n    .health = 10.0,\n    ...\n},\n\ncase PetalID::kBasic:\n    ctx.arc(0,0,r);\n    ctx.fill();\n    break;"}
            className="ctl num m-3 min-h-0 flex-1 resize-none p-3 text-[11px] leading-relaxed"
            style={{ background: "var(--color-sunken)" }}
          />
          {imported !== null && (
            <p className="px-3 pb-1 text-[11px]" style={{ color: "var(--color-ok)" }}>
              imported · {imported} shape{imported === 1 ? "" : "s"}
            </p>
          )}
          {warnings.length > 0 && (
            <ul
              className="max-h-28 shrink-0 overflow-auto px-3 py-2 text-[10px]"
              style={{ borderTop: "1px solid var(--color-rule)", color: "var(--color-warn)" }}
            >
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <textarea
          readOnly
          value={body}
          spellCheck={false}
          className="ctl num m-3 min-h-0 flex-1 resize-none p-3 text-[11px] leading-relaxed"
          style={{ background: "var(--color-sunken)" }}
        />
      )}
    </div>
  );
}

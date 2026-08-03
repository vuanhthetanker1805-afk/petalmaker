"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PetalPreview } from "@/src/ui/Preview";
import { exportCpp } from "@/src/export/cpp";
import { exportSvg } from "@/src/export/svg";
import { RARITY_COLORS, RARITY_NAMES } from "@/src/data/rarity";
import { toHex6 } from "@/src/engine/color";
import type { Doc } from "@/src/engine/types";

interface Rec { id: string; name: string; rarity: number; doc: Doc; createdAt: string; views: number }

export default function PetalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rec, setRec] = useState<Rec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"cpp" | "svg">("cpp");

  useEffect(() => {
    fetch(`/api/petals/${id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "not found");
        return j;
      })
      .then((j) => setRec(j.petal))
      .catch((e) => setErr((e as Error).message));
  }, [id]);

  const code = rec ? (tab === "cpp" ? exportCpp(rec.doc) : exportSvg(rec.doc)) : "";

  return (
    <div className="min-h-dvh bg-[var(--color-sunken)] text-[var(--color-ink)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-rule)] bg-[var(--color-paper-1)] px-4 py-2">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          flrr<span className="text-[var(--color-accent)]">petal</span>maker
        </Link>
        <Link href="/gallery" className="ml-auto rounded bg-[var(--color-paper-2)] px-2.5 py-1 text-xs text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]">
          Gallery
        </Link>
        <Link href="/" className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-xs text-white hover:bg-[var(--color-accent-dim)]">
          Open editor
        </Link>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        {err && <p className="rounded bg-[var(--color-paper-2)] p-3 text-sm text-[var(--color-danger)]">{err}</p>}
        {!rec && !err && <p className="text-sm text-[var(--color-ink-3)]">Loading…</p>}
        {rec && (
          <>
            <div className="flex items-center gap-5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-1)] p-5">
              <PetalPreview doc={rec.doc} mode="tile" size={110} bg="transparent" />
              <PetalPreview doc={rec.doc} mode="clump" size={110} bg="transparent" />
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold">{rec.name}</h1>
                <span
                  className="w-fit rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: toHex6(RARITY_COLORS[rec.rarity] ?? RARITY_COLORS[0]), color: "#0b0e12" }}
                >
                  {RARITY_NAMES[rec.rarity] ?? "Common"}
                </span>
                <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                  radius {rec.doc.radius} · {rec.doc.shapes.length} shapes · {rec.views} views
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1">
              {(["cpp", "svg"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-2.5 py-1 text-xs ${tab === t ? "bg-[var(--color-paper-3)] text-[var(--color-ink)]" : "text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]"}`}
                >
                  {t === "cpp" ? "petal code" : "svg"}
                </button>
              ))}
              <button
                onClick={() => navigator.clipboard?.writeText(code)}
                className="ml-auto rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-accent-dim)]"
              >copy</button>
            </div>
            <pre className="mt-2 max-h-[26rem] overflow-auto rounded bg-[var(--color-sunken)] p-4 font-mono text-[11px] leading-relaxed text-[var(--color-ink)] ring-1 ring-[var(--color-rule)]">
              {code}
            </pre>
          </>
        )}
      </main>
    </div>
  );
}

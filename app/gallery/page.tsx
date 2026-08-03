"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PetalPreview } from "@/src/ui/Preview";
import { RARITY_COLORS, RARITY_NAMES } from "@/src/data/rarity";
import { toHex6 } from "@/src/engine/color";
import type { Doc } from "@/src/engine/types";

interface Rec { id: string; name: string; rarity: number; doc: Doc; createdAt: string; views: number }

export default function GalleryPage() {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/petals")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "failed to load");
        return j;
      })
      .then((j) => setRows(j.petals))
      .catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--color-sunken)] text-[var(--color-ink)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-rule)] bg-[var(--color-paper-1)] px-4 py-2">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          flrr<span className="text-[var(--color-accent)]">petal</span>maker
        </Link>
        <span className="text-[11px] text-[var(--color-ink-3)]">gallery</span>
        <Link href="/" className="ml-auto rounded bg-[var(--color-paper-2)] px-2.5 py-1 text-xs text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]">
          ← Editor
        </Link>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {err && <p className="rounded bg-[var(--color-paper-2)] p-3 text-sm text-[var(--color-danger)]">{err}</p>}
        {!rows && !err && <p className="text-sm text-[var(--color-ink-3)]">Loading…</p>}
        {rows?.length === 0 && (
          <p className="text-sm text-[var(--color-ink-3)]">
            Nothing published yet. Draw something in the editor and hit Publish.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows?.map((r) => (
            <Link
              key={r.id}
              href={`/p/${r.id}`}
              className="group flex flex-col items-center gap-2 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-1)] p-3 hover:border-[var(--color-rule)]"
            >
              <PetalPreview doc={r.doc} mode="tile" size={88} bg="transparent" />
              <span className="max-w-full truncate text-xs font-medium text-[var(--color-ink)]">{r.name}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: toHex6(RARITY_COLORS[r.rarity] ?? RARITY_COLORS[0]), color: "#0b0e12" }}
              >
                {RARITY_NAMES[r.rarity] ?? "Common"}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

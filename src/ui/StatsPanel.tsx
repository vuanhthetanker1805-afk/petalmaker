"use client";
import { useState } from "react";
import {
  GROUP_LABELS, GROUP_ORDER, STACK_LABELS, UNIT_LABELS,
  activeWarnings, fieldsInGroup,
} from "@/src/engine/stats";
import type { StatField, StatGroup, PetalStats } from "@/src/engine/stats";
import type { Editor } from "./useEditor";

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="num shrink-0 rounded-[3px] px-1 text-[10px] leading-[1.4]"
      style={{ background: "var(--color-paper-3)", color: "var(--color-ink-3)" }}
    >
      {children}
    </span>
  );
}

function FieldRow({
  fld, value, onChange, stats,
}: {
  fld: StatField;
  value: number;
  onChange: (v: number) => void;
  stats: PetalStats;
}) {
  const warn = fld.warn?.(value, stats) ?? null;
  const unit = UNIT_LABELS[fld.unit];
  const atDefault = Math.abs(value - fld.def) < 1e-9;

  return (
    <div className="px-2 py-1.5" style={{ borderTop: "1px solid var(--color-rule-soft)" }}>
      <div className="flex items-center gap-2">
        <label
          className="flex-1 truncate text-[12px]"
          style={{ color: atDefault ? "var(--color-ink-3)" : "var(--color-ink)" }}
          title={fld.help}
        >
          {fld.label}
        </label>

        {fld.stacking !== "none" && fld.stacking !== "perPetal" && (
          <Chip title={`Across your whole loadout the server takes the ${fld.stacking}`}>
            {STACK_LABELS[fld.stacking]}
          </Chip>
        )}
        {unit && <Chip title="unit">{unit}</Chip>}

        {fld.unit === "bool" ? (
          <button
            role="switch"
            aria-checked={value !== 0}
            onClick={() => onChange(value !== 0 ? 0 : 1)}
            className="ctl num h-6 w-14 text-[11px]"
          >
            {value !== 0 ? "on" : "off"}
          </button>
        ) : fld.unit === "enum" ? (
          <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="ctl h-6 w-32 px-1 text-[11px]"
          >
            {fld.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            value={value}
            min={fld.min}
            max={fld.max}
            step={fld.step ?? 0.1}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange(isFinite(v) ? v : fld.def);
            }}
            className="ctl num h-6 w-20 px-1.5 text-right text-[11px]"
          />
        )}
      </div>

      {fld.observed && (
        <p className="num mt-0.5 pl-0.5 text-[10px]" style={{ color: "var(--color-ink-4)" }}>
          real petals: {fld.observed.min}&ndash;{fld.observed.max}
          {fld.observed.note ? ` · ${fld.observed.note}` : ""}
        </p>
      )}

      {warn && (
        <p
          className="mt-1 rounded-[3px] px-1.5 py-1 text-[10px] leading-snug"
          style={{ background: "var(--color-warn-dim)", color: "var(--color-warn)" }}
        >
          {warn}
        </p>
      )}
    </div>
  );
}

function Group({
  g, stats, setStat, open, toggle,
}: {
  g: StatGroup;
  stats: PetalStats;
  setStat: (k: string, v: number) => void;
  open: boolean;
  toggle: () => void;
}) {
  const fields = fieldsInGroup(g);
  const changed = fields.filter(
    (f) => Math.abs((stats as unknown as Record<string, number>)[f.key] - f.def) > 1e-9
  ).length;

  return (
    <section>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
        style={{ background: "var(--color-paper-1)", borderTop: "1px solid var(--color-rule)" }}
      >
        <span
          className="text-[10px] transition-transform"
          style={{ color: "var(--color-ink-3)", transform: open ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
        <span
          className="flex-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-ink-2)" }}
        >
          {GROUP_LABELS[g]}
        </span>
        {changed > 0 && (
          <span
            className="num rounded-[3px] px-1 text-[10px]"
            style={{ background: "var(--color-accent-dim)", color: "var(--color-accent-ink)" }}
          >
            {changed}
          </span>
        )}
      </button>
      {open &&
        fields.map((f) => (
          <FieldRow
            key={f.key}
            fld={f}
            stats={stats}
            value={(stats as unknown as Record<string, number>)[f.key]}
            onChange={(v) => setStat(f.key, v)}
          />
        ))}
    </section>
  );
}

export default function StatsPanel({ ed }: { ed: Editor }) {
  const { doc, setDoc } = ed;
  const [open, setOpen] = useState<Record<string, boolean>>({ core: true });

  const setStat = (k: string, v: number) =>
    setDoc((d) => {
      const stats = { ...d.stats, [k]: v };
      // icon_angle is mirrored on the Doc because the artwork previews rotate by it
      return k === "icon_angle" ? { ...d, stats, iconAngle: v } : { ...d, stats };
    });

  const warnings = activeWarnings(doc.stats);

  return (
    <div className="flex flex-col">
      {warnings.length > 0 && (
        <div
          className="px-2 py-1.5 text-[10px]"
          style={{ background: "var(--color-warn-dim)", color: "var(--color-warn)" }}
        >
          {warnings.length} stat{warnings.length > 1 ? "s" : ""} may not behave as
          you expect &mdash; expand the groups to see why.
        </div>
      )}
      {GROUP_ORDER.map((g) => (
        <Group
          key={g}
          g={g}
          stats={doc.stats}
          setStat={setStat}
          open={!!open[g]}
          toggle={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
        />
      ))}
    </div>
  );
}

import { describe, expect, it } from "vitest";
import { exportAll, exportPetalData } from "@/src/export/cpp";
import { parseCpp } from "@/src/import/cppParser";
import { emptyDoc, migrateDoc } from "@/src/engine/types";
import {
  ATTRIBUTE_ORDER, STAT_FIELDS, activeWarnings, defaultStats, withStatDefaults,
} from "@/src/engine/stats";
import type { Doc } from "@/src/engine/types";
import type { PetalStats } from "@/src/engine/stats";

/** A doc with every single stat pushed off its default. */
function loadedDoc(): Doc {
  const d = emptyDoc();
  d.name = "Testerino";
  d.description = 'A "quoted" test petal';
  d.radius = 13;
  d.rarity = 7;
  d.count = 3;
  d.iconAngle = 0.7;
  const s = d.stats as unknown as Record<string, number>;
  s.health = 42; s.damage = 17; s.reload = 2.75;
  s.clump_radius = 11; s.secondary_reload = 1.5; s.constant_heal = 2;
  s.burst_heal = 9; s.mass = 3.5; s.armor = 6; s.poison_armor = 4;
  s.dandelion_inflict_seconds = 8; s.slow_inflict_seconds = 2.5;
  s.lifesteal = 0.3; s.crit_chance = 0.25; s.crit_multiplier = 2.5;
  s.armor_pierce = 0.6; s.vision_factor = 0.45; s.extra_body_damage = 12;
  s.extra_rotation_speed = 3.5; s.extra_range = 55; s.extra_health = 140;
  s.damage_reflection = 0.35; s.extra_damage_factor = 1.25;
  s.extra_reload_factor = 0.85;
  s.poison_damage_damage = 19; s.poison_damage_time = 3.5;
  s.defend_only = 1; s.icon_angle = 0.7; s.split_projectile = 1;
  s.rotation_style = 2; s.spawns = 16; s.spawn_count = 2; s.equipment = 1;
  return d;
}

describe("field registry", () => {
  it("covers every PetalAttributes field in the struct", () => {
    const keys = new Set(STAT_FIELDS.map((f) => f.key));
    for (const k of ATTRIBUTE_ORDER) {
      if (k === "poison_damage") {
        expect(keys.has("poison_damage_damage")).toBe(true);
        expect(keys.has("poison_damage_time")).toBe(true);
      } else {
        expect(keys, `missing field ${k}`).toContain(k);
      }
    }
  });

  it("has no duplicate keys", () => {
    const keys = STAT_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("defaults match the C++ struct defaults", () => {
    const d = defaultStats() as unknown as Record<string, number>;
    // StaticDefinitions.hh:227-255
    expect(d.mass).toBe(0.1);
    expect(d.crit_multiplier).toBe(1);
    expect(d.vision_factor).toBe(1);
    expect(d.extra_damage_factor).toBe(1);
    expect(d.extra_reload_factor).toBe(1);
    expect(d.spawns).toBe(24);      // MobID::kNumMobs
    expect(d.equipment).toBe(4);    // EquipmentFlags::kNone
    expect(d.rotation_style).toBe(0); // kPassiveRot
    expect(d.armor).toBe(0);
    expect(d.clump_radius).toBe(0);
  });
});

describe("PETAL_DATA emitter", () => {
  it("emits attributes in struct declaration order", () => {
    const out = exportPetalData(loadedDoc());
    const seen = ATTRIBUTE_ORDER
      .map((k) => ({ k, i: out.indexOf(`.${k} =`) }))
      .filter((x) => x.i >= 0);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].i, `${seen[i].k} must follow ${seen[i - 1].k}`)
        .toBeGreaterThan(seen[i - 1].i);
    }
  });

  it("omits fields still at their default", () => {
    const out = exportPetalData(emptyDoc());
    expect(out).toContain(".attributes = {}");
    expect(out).not.toContain("crit_multiplier");
    expect(out).not.toContain(".mass");
  });

  it("uses the real enum names", () => {
    const out = exportPetalData(loadedDoc());
    expect(out).toContain("RarityID::kSuper");
    expect(out).toContain("PetalAttributes::kFollowRot");
    expect(out).toContain("MobID::kSandstorm");
    expect(out).toContain("EquipmentFlags::kAntennae");
  });

  it("nests poison_damage as a struct", () => {
    const out = exportPetalData(loadedDoc());
    expect(out).toMatch(/\.poison_damage = \{[\s\S]*\.damage = 19\.0,[\s\S]*\.time = 3\.5[\s\S]*\}/);
  });

  it("escapes quotes in name and description", () => {
    const out = exportPetalData(loadedDoc());
    expect(out).toContain('.description = "A \\"quoted\\" test petal"');
  });

  it("emits integer-typed fields without a decimal point", () => {
    const out = exportPetalData(loadedDoc());
    expect(out).toContain(".defend_only = 1");
    expect(out).toContain(".split_projectile = 1");
    expect(out).toContain(".spawn_count = 2");
  });
});

describe("stats round-trip", () => {
  it("every field survives emit -> parse", () => {
    const src = loadedDoc();
    const { doc, warnings } = parseCpp(exportPetalData(src), src.radius);
    expect(warnings.filter((w) => !w.includes("no drawable shapes"))).toEqual([]);

    expect(doc.name).toBe(src.name);
    expect(doc.description).toBe(src.description);
    expect(doc.rarity).toBe(src.rarity);
    expect(doc.radius).toBeCloseTo(src.radius, 6);
    expect(doc.count).toBe(src.count);

    const a = src.stats as unknown as Record<string, number>;
    const b = doc.stats as unknown as Record<string, number>;
    for (const f of STAT_FIELDS) {
      expect(b[f.key], `field ${f.key} did not survive the round trip`)
        .toBeCloseTo(a[f.key], 4);
    }
  });

  it("is idempotent -- emit, parse, emit produces identical text", () => {
    const first = exportPetalData(loadedDoc());
    const reparsed = parseCpp(first, 13).doc;
    expect(exportPetalData(reparsed)).toBe(first);
  });

  it("a defaults-only petal round-trips to defaults", () => {
    const { doc } = parseCpp(exportPetalData(emptyDoc()), 10);
    const got = doc.stats as unknown as Record<string, number>;
    const def = defaultStats() as unknown as Record<string, number>;
    for (const f of STAT_FIELDS) expect(got[f.key], f.key).toBeCloseTo(def[f.key], 6);
  });

  it("the nested poison damage is not confused with the top-level damage", () => {
    const d = emptyDoc();
    (d.stats as unknown as Record<string, number>).damage = 11;
    (d.stats as unknown as Record<string, number>).poison_damage_damage = 33;
    (d.stats as unknown as Record<string, number>).poison_damage_time = 2;
    const { doc } = parseCpp(exportPetalData(d), 10);
    expect(doc.stats.damage).toBe(11);
    expect(doc.stats.poison_damage_damage).toBe(33);
  });
});

describe("combined export", () => {
  it("carries the enum line, the table entry and the draw case", () => {
    const d = loadedDoc();
    d.shapes = [{
      id: "a", name: "s", visible: true, locked: false,
      fill: 0xffffffff, stroke: 0xffcfcfcf, lineWidth: 3,
      roundCap: true, roundJoin: true, fillRule: "evenodd",
      cmds: [{ t: "arc", x: 0, y: 0, r: 13 }],
    }];
    const out = exportAll(d);
    expect(out).toContain("kTesterino,");
    expect(out).toContain(".rarity = RarityID::kSuper");
    expect(out).toContain("case PetalID::kTesterino:");
    expect(out).toContain("ctx.arc(");
    expect(out).toContain("APPEND ONLY");
  });
});

describe("warnings", () => {
  const withStats = (o: Partial<PetalStats>): PetalStats =>
    withStatDefaults({ ...defaultStats(), ...o } as Partial<PetalStats>);

  it("flags constant_heal as dead", () => {
    const w = activeWarnings(withStats({ constant_heal: 3 }));
    expect(w.some((x) => x.key === "constant_heal")).toBe(true);
  });

  it("flags reload factor above 1 as a slowdown", () => {
    const w = activeWarnings(withStats({ extra_reload_factor: 1.2 }));
    expect(w.find((x) => x.key === "extra_reload_factor")?.text).toMatch(/SLOWER/);
    // below 1 is a genuine speed-up, so no warning
    expect(activeWarnings(withStats({ extra_reload_factor: 0.8 })).some((x) => x.key === "extra_reload_factor")).toBe(false);
  });

  it("flags a crit multiplier with no crit chance", () => {
    expect(activeWarnings(withStats({ crit_multiplier: 3 })).some((x) => x.key === "crit_multiplier")).toBe(true);
    expect(activeWarnings(withStats({ crit_multiplier: 3, crit_chance: 0.2 })).some((x) => x.key === "crit_multiplier")).toBe(false);
  });

  it("flags a burst heal with no ability charge", () => {
    expect(activeWarnings(withStats({ burst_heal: 10 })).some((x) => x.key === "burst_heal")).toBe(true);
    expect(activeWarnings(withStats({ burst_heal: 10, secondary_reload: 1 })).some((x) => x.key === "burst_heal")).toBe(false);
  });

  it("flags a summon with no ability charge", () => {
    expect(activeWarnings(withStats({ spawns: 2 })).some((x) => x.key === "spawns")).toBe(true);
  });

  it("flags armor as petal-only and equipment as cosmetic", () => {
    expect(activeWarnings(withStats({ armor: 5 })).some((x) => x.key === "armor")).toBe(true);
    expect(activeWarnings(withStats({ equipment: 0 })).some((x) => x.key === "equipment")).toBe(true);
  });

  it("a default petal has no warnings at all", () => {
    expect(activeWarnings(defaultStats())).toEqual([]);
  });
});

describe("document migration", () => {
  it("fills in stats for a document saved before they existed", () => {
    const old = { name: "Legacy", radius: 9, rarity: 2, count: 1, iconAngle: 0, shapes: [] };
    const d = migrateDoc(old);
    expect(d.name).toBe("Legacy");
    expect(d.radius).toBe(9);
    expect(d.stats.mass).toBe(0.1);
    expect(d.stats.vision_factor).toBe(1);
    expect(d.description).toBeTypeOf("string");
  });

  it("survives total garbage", () => {
    expect(() => migrateDoc(null)).not.toThrow();
    expect(() => migrateDoc({ radius: -5, shapes: "nope" })).not.toThrow();
    expect(migrateDoc({ radius: -5 }).radius).toBeGreaterThan(0);
  });

  it("keeps stats that are already present", () => {
    const d = migrateDoc({ ...emptyDoc(), stats: { ...defaultStats(), armor: 7 } });
    expect(d.stats.armor).toBe(7);
  });
});

describe("tile SVG for the Discord embed", () => {
  const tileDoc = () => {
    const d = emptyDoc();
    d.name = "Frostbite";
    d.rarity = 5; // Mythic -> 0xff1fdbde
    d.radius = 9;
    d.shapes = [{
      id: "a", name: "body", visible: true, locked: false,
      fill: 0xffe8f0f5, stroke: 0xffb8c4cc, lineWidth: 3,
      roundCap: true, roundJoin: true, fillRule: "evenodd",
      cmds: [{ t: "arc", x: 0, y: 0, r: 9 }],
    }];
    return d;
  };

  it("draws the rarity plate and inner square", async () => {
    const { exportTileSvg } = await import("@/src/export/svg");
    const { RARITY_COLORS } = await import("@/src/data/rarity");
    const { hsv, toHex6 } = await import("@/src/engine/color");

    const svg = exportTileSvg(tileDoc());
    expect(svg).toContain('viewBox="-30 -30 60 60"');
    // inner square is the flat rarity colour, plate is the HSV(_, 0.8) shade,
    // derived rather than hardcoded so the assertion cannot drift from the maths
    expect(svg).toContain(toHex6(RARITY_COLORS[5]));
    expect(svg).toContain(toHex6(hsv(RARITY_COLORS[5], 0.8)));
    expect(svg).toContain("#e8f0f5"); // the petal itself
  });

  it("clamps oversized artwork so it stays on the tile", async () => {
    const { exportTileSvg } = await import("@/src/export/svg");
    const d = tileDoc();
    d.radius = 50; // Moon-sized
    const svg = exportTileSvg(d);
    // 0.833 * 20/50 = 0.333
    expect(svg).toMatch(/scale\(0\.33/);
  });

  it("repeats the artwork for a clump", async () => {
    const { exportTileSvg } = await import("@/src/export/svg");
    const d = tileDoc();
    d.count = 3;
    const svg = exportTileSvg(d);
    expect((svg.match(/<g transform="translate/g) ?? []).length).toBe(3);
  });

  it("a single petal is not offset", async () => {
    const { exportTileSvg } = await import("@/src/export/svg");
    const svg = exportTileSvg(tileDoc());
    expect(svg).toContain('translate(0 0)');
  });

  it("survives a petal with no artwork", async () => {
    const { exportTileSvg } = await import("@/src/export/svg");
    expect(() => exportTileSvg(emptyDoc())).not.toThrow();
  });
});

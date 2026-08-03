/**
 * The gameplay-stat registry.
 *
 * One entry per field of PetalData / PetalAttributes
 * (Shared/StaticDefinitions.hh:221-268), in struct declaration order so the C++
 * emitter can walk this array directly.
 *
 * Each entry carries more than a default: the UNIT (per-second vs flat vs
 * multiplier is not guessable from the name), the STACKING rule the server uses
 * when several petals are equipped (Flower.cc:31-64 uses min / max / sum /
 * product depending on the field), and a WARNING predicate for the fields that
 * are inert or behave opposite to how they read.
 */

export type StatUnit =
  | "flat"      // absolute HP / world units
  | "perSec"    // authored per second, divided by TPS server-side
  | "sec"       // seconds, multiplied by TPS server-side
  | "mult"      // multiplier, 1 = no change
  | "frac"      // 0..1 fraction
  | "rad"       // radians
  | "radPerSec" // radians per second
  | "count"     // integer
  | "enum"
  | "bool"
  | "text";

/** How the server combines this field across every equipped petal. */
export type Stacking = "min" | "max" | "sum" | "product" | "perPetal" | "none";

export type StatGroup =
  | "identity"
  | "core"
  | "defence"
  | "offence"
  | "status"
  | "orbit"
  | "utility"
  | "summon";

export interface StatField {
  /** C++ field name, used verbatim by the emitter */
  key: string;
  label: string;
  group: StatGroup;
  unit: StatUnit;
  /** value the C++ struct defaults to -- emitter skips fields still at default */
  def: number;
  stacking: Stacking;
  /** true when the field lives on PetalData rather than PetalAttributes */
  onData?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** observed across the 72 shipped petals, for the compare sidebar */
  observed?: { min: number; max: number; mode?: number; note?: string };
  help: string;
  options?: { value: number; label: string }[];
  /** returns a warning when the current value is inert or counter-intuitive */
  warn?: (v: number, all: PetalStats) => string | null;
}

/** All 33 gameplay fields. `name` and `description` live on Doc, not here. */
export interface PetalStats {
  // --- PetalData ---
  health: number;
  damage: number;
  reload: number;
  // radius / count / rarity live on Doc (they drive the artwork too)

  // --- PetalAttributes, struct order ---
  clump_radius: number;
  secondary_reload: number;
  constant_heal: number;
  burst_heal: number;
  mass: number;
  armor: number;
  poison_armor: number;
  dandelion_inflict_seconds: number;
  slow_inflict_seconds: number;
  lifesteal: number;
  crit_chance: number;
  crit_multiplier: number;
  armor_pierce: number;
  vision_factor: number;
  extra_body_damage: number;
  extra_rotation_speed: number;
  extra_range: number;
  extra_health: number;
  damage_reflection: number;
  extra_damage_factor: number;
  extra_reload_factor: number;
  poison_damage_damage: number;
  poison_damage_time: number;
  defend_only: number;
  icon_angle: number;
  split_projectile: number;
  rotation_style: number;
  spawns: number;
  spawn_count: number;
  equipment: number;
}

export const ROTATION_STYLES = [
  { value: 0, label: "Passive spin" },
  { value: 1, label: "No rotation" },
  { value: 2, label: "Face outward" },
];

/** MobID order from Shared/StaticDefinitions.hh. 24 = kNumMobs = "no summon". */
export const MOB_NAMES = [
  "Baby Ant", "Worker Ant", "Soldier Ant", "Bee", "Ladybug", "Beetle",
  "Massive Ladybug", "Massive Beetle", "Dark Ladybug", "Hornet", "Cactus",
  "Rock", "Boulder", "Centipede", "Evil Centipede", "Desert Centipede",
  "Sandstorm", "Scorpion", "Spider", "Ant Hole", "Queen Ant", "Shiny Ladybug",
  "Square", "Digger",
];
export const NO_SUMMON = MOB_NAMES.length; // 24

export const EQUIPMENT = [
  { value: 0, label: "Third Eye" },
  { value: 1, label: "Antennae" },
  { value: 2, label: "Observer" },
  { value: 3, label: "Cutter" },
  { value: 4, label: "None" },
];
export const NO_EQUIPMENT = 4;

const f = (n: number) => Math.abs(n) < 1e-9;

export const STAT_FIELDS: StatField[] = [
  // ---------------------------------------------------------------- core
  {
    key: "health", label: "Health", group: "core", unit: "flat", def: 0,
    stacking: "perPetal", onData: true, min: 0, step: 1,
    observed: { min: 0, max: 1000, mode: 10, note: "Moon is 1000; most are 5-20" },
    help: "HP of the petal entity itself. Petals cannot be poisoned (Health.cc:11).",
  },
  {
    key: "damage", label: "Damage", group: "core", unit: "flat", def: 0,
    stacking: "perPetal", onData: true, min: 0, step: 1,
    observed: { min: 0, max: 75, mode: 5 },
    help: "Dealt on every tick of contact (~20/sec while overlapping). Multiplied once at spawn by the loadout's damage factor.",
  },
  {
    key: "reload", label: "Reload", group: "core", unit: "sec", def: 0,
    stacking: "perPetal", onData: true, min: 0, step: 0.1,
    observed: { min: 0.05, max: 15, mode: 1 },
    help: "Seconds before a destroyed petal respawns. First spawn after equipping costs an extra 1s.",
  },

  // ------------------------------------------------------------- defence
  {
    key: "armor", label: "Armor", group: "defence", unit: "flat", def: 0,
    stacking: "perPetal", min: 0, step: 1,
    observed: { min: 0, max: 14, note: "Aegis 14, Genesis 12, Bulwark 10" },
    help: "Flat reduction per contact-damage event, applied after crits.",
    warn: (v) => (f(v) ? null :
      "Protects only THIS petal, never your flower - the server never assigns armor to flowers or mobs."),
  },
  {
    key: "poison_armor", label: "Poison armor", group: "defence", unit: "perSec", def: 0,
    stacking: "max", min: 0, step: 0.5,
    observed: { min: 0, max: 12, note: "only Lotus 5, Amber 6, Aegis 12" },
    help: "Poison damage negated per second, on your flower. Fully cancels poison when >= the incoming DPS.",
  },
  {
    key: "extra_health", label: "Extra max HP", group: "defence", unit: "flat", def: 0,
    stacking: "sum", min: 0, step: 5,
    observed: { min: 0, max: 300, note: "Genesis 300, Eternity 120, Cactus 20" },
    help: "Added to your flower's max HP. Current HP scales proportionally, so it is not a free heal.",
  },
  {
    key: "damage_reflection", label: "Damage reflect", group: "defence", unit: "frac", def: 0,
    stacking: "max", min: 0, max: 1, step: 0.05,
    observed: { min: 0, max: 0.45, note: "Aegis 0.45, Salt 0.25" },
    help: "Fraction of damage taken sent back to the attacker's owner. Reflected damage ignores armor and cannot re-reflect.",
  },

  // ------------------------------------------------------------- offence
  {
    key: "crit_chance", label: "Crit chance", group: "offence", unit: "frac", def: 0,
    stacking: "perPetal", min: 0, max: 1, step: 0.05,
    observed: { min: 0, max: 0.4, note: "Ragnarok 0.4, Eclipse 0.35" },
    help: "Rolled per damage event, so roughly 20 rolls per second of contact. Applied before armor.",
  },
  {
    key: "crit_multiplier", label: "Crit multiplier", group: "offence", unit: "mult", def: 1,
    stacking: "perPetal", min: 1, step: 0.1,
    observed: { min: 1, max: 3.5, note: "Ragnarok 3.5, Eclipse 3.0" },
    help: "Damage multiplier when a crit lands.",
    warn: (v, all) =>
      v > 1 && f(all.crit_chance)
        ? "Inert: crit chance is 0, so this never applies."
        : null,
  },
  {
    key: "armor_pierce", label: "Armor pierce", group: "offence", unit: "frac", def: 0,
    stacking: "perPetal", min: 0, max: 1, step: 0.05,
    observed: { min: 0, max: 1, note: "Singularity 1.0, Venom 0.7" },
    help: "Fraction of the target's armor ignored.",
    warn: (v) => (f(v) ? null :
      "Only matters in PvP - nothing but a petal ever has armor, so this is a no-op against mobs."),
  },
  {
    key: "lifesteal", label: "Lifesteal", group: "offence", unit: "frac", def: 0,
    stacking: "perPetal", min: 0, max: 1, step: 0.05,
    observed: { min: 0, max: 0.4, note: "Wraith 0.4, Leech 0.35" },
    help: "Fraction of damage dealt healed back to your flower. Overkill does not count, and reflect damage never feeds it.",
  },
  {
    key: "extra_body_damage", label: "Body damage", group: "offence", unit: "flat", def: 0,
    stacking: "max", min: 0, step: 1,
    observed: { min: 0, max: 20, note: "Ragnarok 20, Cutter 15" },
    help: "Added to your flower's own contact damage (base 25).",
  },
  {
    key: "extra_damage_factor", label: "Damage factor", group: "offence", unit: "mult", def: 1,
    stacking: "product", min: 0.1, step: 0.05,
    observed: { min: 1, max: 1.35, note: "Ragnarok 1.35, Eternity 1.25" },
    help: "Multiplies the damage of EVERY petal you have, including itself. Stacks multiplicatively.",
  },

  // -------------------------------------------------------------- status
  {
    key: "poison_damage_damage", label: "Poison damage", group: "status", unit: "perSec", def: 0,
    stacking: "perPetal", min: 0, step: 1,
    observed: { min: 0, max: 28, note: "Ember 28, Venom 22" },
    help: "Poison damage per second inflicted on contact. Total dealt is damage x time.",
  },
  {
    key: "poison_damage_time", label: "Poison duration", group: "status", unit: "sec", def: 0,
    stacking: "perPetal", min: 0, step: 0.5,
    observed: { min: 0, max: 6, note: "Iris 6s, Venom 4s" },
    help: "Poison does not stack - a fresh hit replaces the whole effect only if its duration is longer.",
    warn: (v, all) =>
      v > 0 && f(all.poison_damage_damage)
        ? "Inert: poison damage is 0, so nothing is applied."
        : !f(all.poison_damage_damage) && f(v)
        ? "Inert: duration is 0, so the poison expires instantly."
        : null,
  },
  {
    key: "slow_inflict_seconds", label: "Slow", group: "status", unit: "sec", def: 0,
    stacking: "perPetal", min: 0, step: 0.5,
    observed: { min: 0, max: 3, note: "Frost 3s, Pincer/Amber 2s" },
    help: "Halves the target's speed for this long. The 50% figure is hardcoded, not data-driven. Longest application wins.",
  },
  {
    key: "dandelion_inflict_seconds", label: "Heal block", group: "status", unit: "sec", def: 0,
    stacking: "perPetal", min: 0, step: 1,
    observed: { min: 0, max: 10, note: "only Dandelion, at 10s" },
    help: "Blocks ALL healing on the target for this long. Refreshes to full on re-hit rather than stacking.",
  },

  // --------------------------------------------------------------- orbit
  {
    key: "clump_radius", label: "Clump radius", group: "orbit", unit: "flat", def: 0,
    stacking: "perPetal", min: 0, step: 1,
    observed: { min: 0, max: 12, note: "0 on 61 of 72; 8-12 otherwise" },
    help: "Above 0, the whole slot occupies ONE ring position and its petals arrange in a mini-ring of this radius, counter-rotating at 0.2x.",
  },
  {
    key: "extra_range", label: "Extra range", group: "orbit", unit: "flat", def: 0,
    stacking: "max", min: 0, step: 5,
    observed: { min: 0, max: 80, note: "Singularity 80, Third Eye 75" },
    help: "Extends the orbit radius, but only while attacking and only for petals that are not defend-only.",
  },
  {
    key: "extra_rotation_speed", label: "Rotation speed", group: "orbit", unit: "radPerSec", def: 0,
    stacking: "sum", min: 0, step: 0.5,
    observed: { min: 0, max: 5, note: "Eternity 5, Tempest 4" },
    help: "Added to the base orbit speed of 2.5 rad/s. Sums across every equipped petal.",
  },
  {
    key: "defend_only", label: "Defend only", group: "orbit", unit: "bool", def: 0,
    stacking: "perPetal",
    help: "When set, the petal does not swing outward on attack - it holds the idle radius. Does not gate its ability.",
  },
  {
    key: "rotation_style", label: "Self rotation", group: "orbit", unit: "enum", def: 0,
    stacking: "perPetal", options: ROTATION_STYLES,
    help: "Passive spins at 1 rad/s in a direction set by entity id parity. Face-outward points away from the flower and freezes when thrown.",
  },
  {
    key: "split_projectile", label: "Split projectile", group: "orbit", unit: "bool", def: 0,
    stacking: "perPetal",
    help: "One entity holds the whole clump until you attack, then it splits into `count` separate petals. Only Peas and Poison Peas use this.",
  },
  {
    key: "icon_angle", label: "Icon angle", group: "orbit", unit: "rad", def: 0,
    stacking: "none", step: 0.1,
    observed: { min: -1, max: 3.14159, note: "0 on 53 of 72" },
    help: "Rotates the artwork in inventory tiles and galleries.",
    warn: (v) => (f(v) ? null : "Cosmetic only - the server never reads this."),
  },

  // ------------------------------------------------------------- utility
  {
    key: "secondary_reload", label: "Ability charge", group: "utility", unit: "sec", def: 0,
    stacking: "perPetal", min: 0, step: 0.5,
    observed: { min: 0, max: 4, note: "0 on 59 of 72" },
    help: "Gates EVERY special ability. At 0 the petal has no ability at all - burst heal, summons and thrown behaviours all require this.",
  },
  {
    key: "burst_heal", label: "Burst heal", group: "utility", unit: "flat", def: 0,
    stacking: "perPetal", min: 0, step: 1,
    observed: { min: 0, max: 22, note: "Azalea 22, Rose 10" },
    help: "Once charged, the petal flies into your flower and is consumed, healing this much. Only fires when you are damaged and not heal-blocked.",
    warn: (v, all) =>
      v > 0 && f(all.secondary_reload)
        ? "Inert: ability charge is 0, so the petal never activates. Set a charge time."
        : null,
  },
  {
    key: "constant_heal", label: "Constant heal", group: "utility", unit: "perSec", def: 0,
    stacking: "sum", min: 0, step: 0.5,
    observed: { min: 0, max: 6, note: "Genesis 6, Yucca/Nectar 1.5, Leaf 1" },
    help: "Passive healing per second while equipped.",
    warn: (v) => (f(v) ? null :
      "Almost certainly dead: the server hardcodes constant heal to Leaf and Yucca only (Flower.cc:52-55). Nectar and Genesis set this and heal nothing."),
  },
  {
    key: "vision_factor", label: "Vision factor", group: "utility", unit: "mult", def: 1,
    stacking: "min", min: 0.05, max: 1, step: 0.05,
    observed: { min: 0.25, max: 1, note: "Observer 0.25, Prism 0.55" },
    help: "LOWER means you see MORE - it multiplies field of view. Best single petal wins; it does not stack.",
  },
  {
    key: "extra_reload_factor", label: "Reload factor", group: "utility", unit: "mult", def: 1,
    stacking: "product", min: 0.1, step: 0.05,
    observed: { min: 1, max: 1.4, note: "Eternity 1.4, Golden Leaf 1.2" },
    help: "Multiplies reload TIME for every petal you have.",
    warn: (v) =>
      v > 1
        ? "Above 1 is SLOWER, not faster - this multiplies reload time. Use below 1 to speed reloads up."
        : null,
  },
  {
    key: "mass", label: "Mass", group: "utility", unit: "flat", def: 0.1, stacking: "perPetal",
    min: 0.01, step: 0.1,
    observed: { min: 0.1, max: 200, note: "0.1 on 71 of 72; only Moon is 200" },
    help: "Collision push weight. A player is 1, a typical mob about 3.",
  },

  // -------------------------------------------------------------- summon
  {
    key: "spawns", label: "Summons", group: "summon", unit: "enum", def: NO_SUMMON,
    stacking: "perPetal",
    options: [...MOB_NAMES.map((label, value) => ({ value, label })), { value: NO_SUMMON, label: "Nothing" }],
    help: "Egg mode (count 0): the petal hatches into a permanent mob and is consumed. Turret mode (count > 0): it stays and emits minions.",
    warn: (v, all) =>
      v !== NO_SUMMON && f(all.secondary_reload)
        ? "Inert: summoning requires an ability charge above 0."
        : null,
  },
  {
    key: "spawn_count", label: "Summon count", group: "summon", unit: "count", def: 0,
    stacking: "perPetal", min: 0, max: 8, step: 1,
    observed: { min: 0, max: 2, note: "only Stick, at 2" },
    help: "0 = egg mode (hatches once, petal consumed). Above 0 = turret mode, keeping this many minions alive at once.",
  },
  {
    key: "equipment", label: "Equipment look", group: "summon", unit: "enum", def: NO_EQUIPMENT,
    stacking: "none", options: EQUIPMENT,
    help: "Adds a cosmetic attachment to your flower.",
    warn: (v) => (v === NO_EQUIPMENT ? null :
      "Cosmetic only. The real effect of each equipment petal comes from its other stats (extra range, vision factor, body damage)."),
  },
];

/**
 * PetalAttributes fields in DECLARATION order (StaticDefinitions.hh:227-255).
 * C++ designated initializers must appear in declaration order or the code will
 * not compile, and STAT_FIELDS above is ordered for the UI, not the struct --
 * so the emitter walks this list instead.
 *
 * `poison_damage` is the nested struct; its two halves are stored flat on
 * PetalStats as poison_damage_damage / poison_damage_time.
 */
export const ATTRIBUTE_ORDER: string[] = [
  "clump_radius",
  "secondary_reload",
  "constant_heal",
  "burst_heal",
  "mass",
  "armor",
  "poison_armor",
  "dandelion_inflict_seconds",
  "slow_inflict_seconds",
  "lifesteal",
  "crit_chance",
  "crit_multiplier",
  "armor_pierce",
  "vision_factor",
  "extra_body_damage",
  "extra_rotation_speed",
  "extra_range",
  "extra_health",
  "damage_reflection",
  "extra_damage_factor",
  "extra_reload_factor",
  "poison_damage",
  "defend_only",
  "icon_angle",
  "split_projectile",
  "rotation_style",
  "spawns",
  "spawn_count",
  "equipment",
];

export const RARITY_ENUM = [
  "kCommon", "kUnusual", "kRare", "kEpic", "kLegendary",
  "kMythic", "kUltra", "kSuper", "kOmega", "kUnique",
];

export const MOB_ENUM = [
  "kBabyAnt", "kWorkerAnt", "kSoldierAnt", "kBee", "kLadybug", "kBeetle",
  "kMassiveLadybug", "kMassiveBeetle", "kDarkLadybug", "kHornet", "kCactus",
  "kRock", "kBoulder", "kCentipede", "kEvilCentipede", "kDesertCentipede",
  "kSandstorm", "kScorpion", "kSpider", "kAntHole", "kQueenAnt",
  "kShinyLadybug", "kSquare", "kDigger",
];

export const ROTATION_ENUM = ["kPassiveRot", "kNoRot", "kFollowRot"];
export const EQUIPMENT_ENUM = ["kThirdEye", "kAntennae", "kObserver", "kCutter", "kNone"];

export const GROUP_LABELS: Record<StatGroup, string> = {
  identity: "Identity",
  core: "Core",
  defence: "Defence",
  offence: "Offence",
  status: "Status effects",
  orbit: "Orbit & form",
  utility: "Utility",
  summon: "Summon & equipment",
};

export const GROUP_ORDER: StatGroup[] = [
  "core", "offence", "defence", "status", "orbit", "utility", "summon",
];

export const UNIT_LABELS: Record<StatUnit, string> = {
  flat: "flat", perSec: "/s", sec: "sec", mult: "x", frac: "0-1",
  rad: "rad", radPerSec: "rad/s", count: "n", enum: "", bool: "", text: "",
};

export const STACK_LABELS: Record<Stacking, string> = {
  min: "best wins", max: "best wins", sum: "adds up",
  product: "multiplies", perPetal: "per petal", none: "n/a",
};

export function defaultStats(): PetalStats {
  const s = {} as Record<string, number>;
  for (const fld of STAT_FIELDS) s[fld.key] = fld.def;
  return s as unknown as PetalStats;
}

/** Fill in any field missing from an older saved document. */
export function withStatDefaults(partial: Partial<PetalStats> | undefined): PetalStats {
  const base = defaultStats() as unknown as Record<string, number>;
  if (partial) {
    for (const fld of STAT_FIELDS) {
      const v = (partial as Record<string, unknown>)[fld.key];
      if (typeof v === "number" && isFinite(v)) base[fld.key] = v;
    }
  }
  return base as unknown as PetalStats;
}

export function fieldsInGroup(g: StatGroup): StatField[] {
  return STAT_FIELDS.filter((s) => s.group === g);
}

/** Every active warning, for the summary strip. */
export function activeWarnings(stats: PetalStats): { key: string; label: string; text: string }[] {
  const out: { key: string; label: string; text: string }[] = [];
  for (const fld of STAT_FIELDS) {
    if (!fld.warn) continue;
    const v = (stats as unknown as Record<string, number>)[fld.key];
    const w = fld.warn(v, stats);
    if (w) out.push({ key: fld.key, label: fld.label, text: w });
  }
  return out;
}

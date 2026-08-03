import { describe, expect, it } from "vitest";
import {
  BASE_FLOWER_RADIUS, MAX_SLOT_COUNT, OrbitSim, PETAL_FRICTION, RANGE_ATTACK,
  RANGE_DEFEND, RANGE_IDLE, TPS, orbitRadius,
} from "@/src/sim/orbit";
import type { SimConfig, SimSlot } from "@/src/sim/orbit";

const slot = (o: Partial<SimSlot> = {}): SimSlot => ({
  size: 1, count: 1, clumpRadius: 0, defendOnly: false,
  rotationStyle: 0, radius: 10, ...o,
});

const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({
  slots: [slot()], pose: "idle", extraRange: 0, extraRotationSpeed: 0,
  yinYangCount: 0, playerX: 0, playerY: 0, ...o,
});

/**
 * Two Yin Yangs freeze the ring (Flower.cc:256-264). With a stationary target
 * the spring settles EXACTLY on it, which lets the range ladder be asserted to
 * full precision. With the ring rotating, a spring-follower necessarily lags
 * and orbits slightly wide -- that is real in-game behaviour, not error, so
 * those cases are asserted with a tolerance instead.
 */
const FROZEN = 2;

describe("ring division count (Flower.cc:66-83)", () => {
  it("counts one division per petal for normal slots", () => {
    const s = new OrbitSim(cfg({ slots: [slot(), slot(), slot({ size: 2, count: 2 })] }));
    expect(s.rotationCount()).toBe(4);
  });

  it("a clump slot takes ONE division no matter how many petals it holds", () => {
    const s = new OrbitSim(cfg({ slots: [slot({ size: 4, count: 4, clumpRadius: 10 })] }));
    expect(s.rotationCount()).toBe(1);
    expect(s.petals).toHaveLength(4);
  });

  it("a detached Moon reserves no division", () => {
    const s = new OrbitSim(cfg({ slots: [slot(), slot({ isMoon: true })] }));
    expect(s.rotationCount()).toBe(1);
  });
});

describe("range ladder is exact (Flower.cc:185-196)", () => {
  const target = (pose: SimConfig["pose"], extraRange = 0, o: Partial<SimSlot> = {}) =>
    new OrbitSim(cfg({ slots: [slot(o)], pose, extraRange })).targetRange(0);

  it("idle = flower radius + 40", () => {
    expect(target("idle")).toBe(BASE_FLOWER_RADIUS + RANGE_IDLE);
  });
  it("attack = flower radius + 100", () => {
    expect(target("attack")).toBe(BASE_FLOWER_RADIUS + RANGE_ATTACK);
  });
  it("defend = flower radius + 15", () => {
    expect(target("defend")).toBe(BASE_FLOWER_RADIUS + RANGE_DEFEND);
  });
  it("extra_range applies only while attacking", () => {
    expect(target("attack", 75)).toBe(BASE_FLOWER_RADIUS + RANGE_ATTACK + 75);
    expect(target("idle", 75)).toBe(BASE_FLOWER_RADIUS + RANGE_IDLE);
    expect(target("defend", 75)).toBe(BASE_FLOWER_RADIUS + RANGE_DEFEND);
  });
  it("defend_only petals hold the idle radius on attack", () => {
    expect(target("attack", 0, { defendOnly: true })).toBe(BASE_FLOWER_RADIUS + RANGE_IDLE);
    expect(target("attack", 75, { defendOnly: true })).toBe(BASE_FLOWER_RADIUS + RANGE_IDLE);
    // but defending still pulls them in
    expect(target("defend", 0, { defendOnly: true })).toBe(BASE_FLOWER_RADIUS + RANGE_DEFEND);
  });
});

describe("a frozen ring settles exactly on its target", () => {
  const settledFrozen = (pose: SimConfig["pose"], extraRange = 0, o: Partial<SimSlot> = {}) => {
    const s = new OrbitSim(cfg({ slots: [slot(o)], pose, extraRange, yinYangCount: FROZEN }));
    s.settle(400);
    return orbitRadius(s, s.petals[0]);
  };

  it("idle -> 65", () => expect(settledFrozen("idle")).toBeCloseTo(65, 6));
  it("attack -> 125", () => expect(settledFrozen("attack")).toBeCloseTo(125, 6));
  it("defend -> 40", () => expect(settledFrozen("defend")).toBeCloseTo(40, 6));
  it("attack + extra_range 75 -> 200", () =>
    expect(settledFrozen("attack", 75)).toBeCloseTo(200, 6));
  it("defend_only on attack stays at 65", () =>
    expect(settledFrozen("attack", 0, { defendOnly: true })).toBeCloseTo(65, 6));
});

describe("a rotating ring lags slightly wide (emergent, and real)", () => {
  it("settles within a few units outside the target, never inside", () => {
    for (const pose of ["idle", "attack", "defend"] as const) {
      const s = new OrbitSim(cfg({ slots: [slot()], pose }));
      s.settle(600);
      const r = orbitRadius(s, s.petals[0]);
      const t = s.targetRange(0);
      expect(r).toBeGreaterThanOrEqual(t - 0.01); // never pulled inside
      expect(r - t).toBeLessThan(5);              // and only slightly wide
    }
  });

  it("faster rotation produces more lag", () => {
    const lag = (extraRotationSpeed: number) => {
      const s = new OrbitSim(cfg({ extraRotationSpeed }));
      s.settle(600);
      return orbitRadius(s, s.petals[0]) - s.targetRange(0);
    };
    expect(lag(5)).toBeGreaterThan(lag(0));
  });
});

describe("angular spacing", () => {
  it("4 petals sit exactly pi/2 apart", () => {
    const s = new OrbitSim(cfg({ slots: [slot(), slot(), slot(), slot()] }));
    s.settle(400);
    const angles = s.petals.map((p) => Math.atan2(p.y, p.x));
    const gaps = angles.slice(1).map((a, i) => {
      let d = a - angles[i];
      while (d < 0) d += Math.PI * 2;
      return d;
    });
    for (const g of gaps) expect(g).toBeCloseTo(Math.PI / 2, 2);
  });

  it("all petals settle at the same radius", () => {
    const s = new OrbitSim(cfg({ slots: [slot(), slot(), slot()] }));
    s.settle(400);
    const radii = s.petals.map((p) => orbitRadius(s, p));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 2);
  });
});

describe("heading angle (Flower.cc:255-267)", () => {
  const headingAfter = (ticks: number, yinYangCount = 0, extraRotationSpeed = 0) => {
    const s = new OrbitSim(cfg({ yinYangCount, extraRotationSpeed }));
    for (let i = 0; i < ticks; i++) s.step();
    return s.headingAngle;
  };

  it("advances 2.5 rad/s at the base rate", () => {
    expect(headingAfter(TPS)).toBeCloseTo(2.5, 6);
  });
  it("extra_rotation_speed sums into the base rate", () => {
    expect(headingAfter(TPS, 0, 2.5)).toBeCloseTo(5.0, 6);
  });
  it("one Yin Yang reverses the ring", () => {
    expect(headingAfter(TPS, 1)).toBeCloseTo(-2.5, 6);
  });
  it("two Yin Yangs FREEZE the ring", () => {
    expect(headingAfter(TPS, FROZEN)).toBe(0);
  });
  it("three Yin Yangs wrap back to forward", () => {
    expect(headingAfter(TPS, 3)).toBeCloseTo(2.5, 6);
  });
  it("a full loadout of Yin Yangs spins 10x", () => {
    expect(headingAfter(TPS, MAX_SLOT_COUNT)).toBeCloseTo(25.0, 5);
  });
});

describe("integrator fidelity vs Motion.cc:28-36", () => {
  it("matches a hand-computed tick to 1e-6", () => {
    const s = new OrbitSim(cfg({ slots: [slot()] }));
    const p = s.petals[0];
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    s.headingAngle = 0;
    s.step();

    // reproduce independently from the C++ formulae
    const friction = PETAL_FRICTION;
    const f = 1 - friction;
    const heading = 2.5 / TPS;              // heading advances before the target is read
    const range = BASE_FLOWER_RADIUS + RANGE_IDLE;
    const ax = Math.cos(heading) * range * 0.5;
    const ay = Math.sin(heading) * range * 0.5;
    const termX = ax / friction, termY = ay / friction;
    const k = (Math.pow(f, 1) - 1) / Math.log(f);

    // position after one tick from rest: p += V*dt + (v0 - V)*(f^dt - 1)/ln f
    expect(p.x).toBeCloseTo(termX * 1 + (0 - termX) * k, 6);
    expect(p.y).toBeCloseTo(termY * 1 + (0 - termY) * k, 6);
  });

  it("velocity after one tick from rest is a/friction * (1 - f)", () => {
    const s = new OrbitSim(cfg({ yinYangCount: FROZEN })); // stationary target
    const p = s.petals[0];
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    s.step();
    const f = 1 - PETAL_FRICTION;
    const ax = (Math.cos(0) * 65 - 0) * 0.5;
    const expected = (ax / PETAL_FRICTION) * (1 - f);
    expect(p.vx).toBeCloseTo(expected, 6);
  });

  it("converges rather than oscillating or diverging", () => {
    const s = new OrbitSim(cfg());
    s.settle(600);
    const r = orbitRadius(s, s.petals[0]);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(50);
    expect(r).toBeLessThan(80);
  });
});

describe("wall-clock playback runs whole ticks only", () => {
  it("advance() of exactly one tick equals one step()", () => {
    const a = new OrbitSim(cfg());
    const b = new OrbitSim(cfg());
    a.step();
    b.advance(1 / TPS);
    expect(b.petals[0].x).toBeCloseTo(a.petals[0].x, 9);
    expect(b.headingAngle).toBeCloseTo(a.headingAngle, 9);
  });

  it("sub-tick advances accumulate rather than stepping early", () => {
    const a = new OrbitSim(cfg());
    const b = new OrbitSim(cfg());
    a.step();
    for (let i = 0; i < 4; i++) b.advance(1 / TPS / 4); // 4 quarter-ticks = 1 tick
    expect(b.petals[0].x).toBeCloseTo(a.petals[0].x, 9);
  });

  it("clamps a huge catch-up instead of freezing the tab", () => {
    const s = new OrbitSim(cfg());
    expect(() => s.advance(9999)).not.toThrow();
    expect(Number.isFinite(s.petals[0].x)).toBe(true);
  });
});

describe("clump behaviour", () => {
  it("clump petals sit near the ring point, offset by clump_radius", () => {
    const s = new OrbitSim(cfg({ slots: [slot({ size: 4, count: 4, clumpRadius: 10 })] }));
    s.settle(400);
    for (const p of s.petals) {
      const r = orbitRadius(s, p);
      expect(r).toBeGreaterThan(65 - 10 - 2);
      expect(r).toBeLessThan(65 + 10 + 2);
    }
  });

  it("the clump sub-ring spreads its petals apart", () => {
    const s = new OrbitSim(cfg({ slots: [slot({ size: 4, count: 4, clumpRadius: 10 })] }));
    s.settle(400);
    const [a, b] = s.petals;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
  });
});

describe("Moon as rotation centre (Flower.cc:85-105)", () => {
  it("other petals orbit the Moon, not the player", () => {
    const s = new OrbitSim(cfg({ slots: [slot({ isMoon: true, radius: 50 }), slot()] }));
    s.settle(800);
    const c = s.rotationCenter();
    const moon = s.petals[0];
    expect(c.x).toBeCloseTo(moon.x, 6);
    expect(c.y).toBeCloseTo(moon.y, 6);
    // moon orbits the player near radius 125 (spring lag makes it slightly wide)
    expect(Math.hypot(moon.x, moon.y)).toBeGreaterThan(120);
    expect(Math.hypot(moon.x, moon.y)).toBeLessThan(135);

    // The other petal targets moonRadius + 40 = 90, but the centre it is
    // chasing is itself sweeping a 125-radius circle at 2.5 rad/s, so the lag
    // is large and drags it well inside 90. That bunching is exactly what a
    // Moon build looks like in game.
    const other = s.petals[1];
    const dToMoon = Math.hypot(other.x - moon.x, other.y - moon.y);
    expect(dToMoon).toBeGreaterThan(50);
    expect(dToMoon).toBeLessThan(95);
  });

  it("without a Moon the centre is the player", () => {
    const s = new OrbitSim(cfg({ slots: [slot()] }));
    const c = s.rotationCenter();
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    expect(c.r).toBe(BASE_FLOWER_RADIUS);
  });
});

describe("robustness", () => {
  it("an empty loadout does not divide by zero", () => {
    const s = new OrbitSim(cfg({ slots: [] }));
    expect(() => s.settle(50)).not.toThrow();
    expect(s.rotationCount()).toBe(0);
  });

  it("never produces NaN across a large mixed loadout", () => {
    const slots: SimSlot[] = [
      slot(), slot({ size: 4, count: 4, clumpRadius: 8 }), slot({ defendOnly: true }),
      slot({ rotationStyle: 1 }), slot({ rotationStyle: 2 }), slot({ isWing: true }),
      slot({ isMoon: true, radius: 50 }), slot({ size: 3, count: 3, clumpRadius: 12 }),
    ];
    for (const pose of ["idle", "attack", "defend"] as const) {
      const s = new OrbitSim(cfg({ slots, pose, extraRange: 80, extraRotationSpeed: 5 }));
      s.settle(300);
      for (const p of s.petals) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Math.hypot(p.x, p.y)).toBeLessThan(1000);
      }
    }
  });

  it("Wing pulses outward on attack but never inward", () => {
    const s = new OrbitSim(cfg({ slots: [slot({ isWing: true })], pose: "attack" }));
    s.settle(100);
    let min = Infinity;
    for (let i = 0; i < 200; i++) {
      s.step();
      min = Math.min(min, s.targetRange(0));
    }
    expect(min).toBeGreaterThanOrEqual(BASE_FLOWER_RADIUS + RANGE_ATTACK - 1e-6);
  });
});

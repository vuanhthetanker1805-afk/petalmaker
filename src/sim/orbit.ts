/**
 * A faithful port of the gardn petal orbit.
 *
 * Every constant and every equation here is taken from the server, not
 * approximated:
 *   Server/Process/Flower.cc:66-83    ring division count
 *   Server/Process/Flower.cc:180-206  target position + the 0.5 spring
 *   Server/Process/Flower.cc:255-267  heading_angle advance / Yin Yang modes
 *   Server/Process/Petal.cc:19-27     self-rotation styles
 *   Server/Process/Motion.cc:10-45    the closed-form friction integrator
 *
 * The integrator is exact for any timestep because Motion.cc solves the
 * exponential-decay ODE in closed form and scales by dt = BASE_TPS / TPS.
 * Running at 60fps means dt = 1/3 and the same code is still exact.
 */

export const TPS = 20;
export const BASE_TPS = 20;
export const BASE_PETAL_ROTATION_SPEED = 2.5;
export const PLAYER_ACCELERATION = 5.0;
export const DEFAULT_FRICTION = 1 / 3;
export const PETAL_FRICTION = DEFAULT_FRICTION * 1.5; // Spawn.cc:159
export const BASE_FLOWER_RADIUS = 25;
export const MAX_PETALS_IN_CLUMP = 4;
export const MAX_SLOT_COUNT = 15;

export const RANGE_IDLE = 40;   // Flower.cc:185
export const RANGE_ATTACK = 100; // Flower.cc:188
export const RANGE_DEFEND = 15;  // Flower.cc:196
export const SPRING_GAIN = 0.5;  // Flower.cc:205
export const CLUMP_SPIN = 0.2;   // Flower.cc:200

export type Pose = "idle" | "attack" | "defend";

/** One equipped slot in the simulated loadout. */
export interface SimSlot {
  /** how many physical petals this slot holds (LoadoutSlot::size()) */
  size: number;
  count: number;          // PETAL_DATA.count, the clump ring divisor
  clumpRadius: number;
  defendOnly: boolean;
  rotationStyle: number;  // 0 passive, 1 none, 2 face-outward
  radius: number;
  /** marks the slot as the designed petal, for highlighting */
  isSubject?: boolean;
  /** Moon becomes the rotation centre for every other petal */
  isMoon?: boolean;
  /** Wing gets a sin^2 radial pulse while attacking */
  isWing?: boolean;
}

export interface SimPetal {
  slot: number;
  j: number;
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  /** entity-id parity decides passive spin direction (Petal.cc:22) */
  spinDir: 1 | -1;
  lifetime: number;
  detached: boolean;
  isSubject: boolean;
  radius: number;
}

export interface SimConfig {
  slots: SimSlot[];
  pose: Pose;
  extraRange: number;         // max() across the loadout
  extraRotationSpeed: number; // sum() across the loadout
  yinYangCount: number;
  playerX: number;
  playerY: number;
  /**
   * The game randomises each passive-rotation petal's starting angle
   * (Spawn.cc:154-155). Here that is seeded instead, so a given design always
   * previews identically and tests are reproducible.
   */
  seed?: number;
}

/** Small deterministic LCG -- avoids Math.random() making the sim unrepeatable. */
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class OrbitSim {
  petals: SimPetal[] = [];
  headingAngle = 0;
  cfg: SimConfig;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.rebuild();
  }

  setConfig(cfg: SimConfig) {
    const changedShape =
      cfg.slots.length !== this.cfg.slots.length ||
      cfg.slots.some((s, i) => s.size !== this.cfg.slots[i]?.size);
    this.cfg = cfg;
    if (changedShape) this.rebuild();
  }

  rebuild() {
    this.petals = [];
    const rng = makeRng(this.cfg.seed ?? 0x9e3779b9);
    let id = 0;
    this.cfg.slots.forEach((s, si) => {
      for (let j = 0; j < s.size; j++) {
        id++;
        this.petals.push({
          slot: si, j,
          x: this.cfg.playerX, y: this.cfg.playerY,
          vx: 0, vy: 0,
          angle: s.rotationStyle === 0 ? rng() * Math.PI * 2 : 0,
          spinDir: id % 2 ? 1 : -1,
          lifetime: 0,
          detached: !!s.isMoon,
          isSubject: !!s.isSubject,
          radius: s.radius,
        });
      }
    });
  }

  /** Flower.cc:66-83 -- a clump slot is one division; detached petals none. */
  rotationCount(): number {
    let n = 0;
    for (const s of this.cfg.slots) {
      if (s.clumpRadius > 0) n++;
      else if (!s.isMoon) n += s.size;
    }
    return n;
  }

  /** Flower.cc:85-105 -- a live Moon replaces the player as the orbit centre. */
  rotationCenter(): { x: number; y: number; r: number } {
    const moon = this.petals.find((p) => this.cfg.slots[p.slot]?.isMoon);
    if (moon) return { x: moon.x, y: moon.y, r: moon.radius };
    return { x: this.cfg.playerX, y: this.cfg.playerY, r: BASE_FLOWER_RADIUS };
  }

  private rangeFor(slot: SimSlot, petal: SimPetal, centerR: number): number {
    const { pose, extraRange } = this.cfg;
    let range = centerR + RANGE_IDLE;
    if (pose === "attack") {
      if (!slot.defendOnly) range = centerR + RANGE_ATTACK + extraRange;
      if (slot.isWing) {
        // Flower.cc:189-193 -- sin^2 so it only ever swings outward
        let wave = Math.sin(petal.lifetime / (0.4 * TPS));
        wave = wave * wave;
        range += wave * 120;
      }
    } else if (pose === "defend") {
      range = centerR + RANGE_DEFEND;
    }
    return range;
  }

  /**
   * Motion.cc:28-36 -- closed-form solution of the friction ODE, so the result
   * is identical at any dt rather than drifting like Euler would.
   */
  private integrate(p: SimPetal, ax: number, ay: number, dt: number) {
    const friction = PETAL_FRICTION;
    const f = 1 - friction;
    const termX = ax / friction;
    const termY = ay / friction;
    const vx = p.vx - termX;
    const vy = p.vy - termY;
    const pw = Math.pow(f, dt);
    const k = (pw - 1) / Math.log(f);
    p.x += termX * dt + vx * k;
    p.y += termY * dt + vy * k;
    p.vx = termX + vx * pw;
    p.vy = termY + vy * pw;
  }

  /**
   * The exact orbit radius the ring is aiming for, before any spring lag.
   * Pure -- this is the ladder from Flower.cc:185-196 with nothing emergent.
   */
  targetRange(slotIndex: number, petal?: SimPetal): number {
    const slot = this.cfg.slots[slotIndex];
    if (!slot) return 0;
    const p = petal ?? this.petals.find((q) => q.slot === slotIndex);
    return this.rangeFor(slot, p ?? ({ lifetime: 0 } as SimPetal), this.rotationCenter().r);
  }

  /**
   * Advance exactly ONE server tick.
   *
   * Deliberately not fractional: the server integrates at 20 Hz with the ring
   * target recomputed once per tick, so sub-stepping would produce a smoother
   * but *different* trajectory. Faithfulness beats smoothness -- the real
   * client also runs 20 Hz state and interpolates only for rendering
   * (Client/Simulation.cc:10-30).
   */
  step() {
    const dt = BASE_TPS / TPS;
    const center = this.rotationCenter();
    const count = this.rotationCount();
    const ticks = 1;

    // Flower.cc:255-267 -- Yin Yang count decides direction, or freezes it
    const speed = (BASE_PETAL_ROTATION_SPEED + this.cfg.extraRotationSpeed) / TPS;
    const yy = this.cfg.yinYangCount;
    if (yy === MAX_SLOT_COUNT) this.headingAngle += 10 * speed;
    else if (yy % 3 === 0) this.headingAngle += speed;
    else if (yy % 3 === 1) this.headingAngle -= speed;
    // yy % 3 === 2 -> frozen

    let rotPos = 0;
    for (let si = 0; si < this.cfg.slots.length; si++) {
      const slot = this.cfg.slots[si];
      const mine = this.petals.filter((p) => p.slot === si);

      for (const p of mine) {
        p.lifetime += ticks;

        // --- self rotation (Petal.cc:19-27) ---
        if (slot.rotationStyle === 0) {
          const amt = slot.isWing ? 10.0 : 1.0;
          p.angle += (p.spinDir * amt * ticks) / TPS;
        } else if (slot.rotationStyle === 2) {
          p.angle = Math.atan2(p.y - this.cfg.playerY, p.x - this.cfg.playerX);
        }

        if (p.detached) {
          // the Moon runs its own spring around the player (Petal.cc:48-53)
          if (slot.isMoon) {
            const wantAngle = p.angle * 2.5;
            const wantR = 100 + BASE_FLOWER_RADIUS;
            const tx = this.cfg.playerX + wantR * Math.cos(wantAngle);
            const ty = this.cfg.playerY + wantR * Math.sin(wantAngle);
            this.integrate(p, (tx - p.x) * SPRING_GAIN, (ty - p.y) * SPRING_GAIN, dt);
          } else {
            this.integrate(p, 0, 0, dt);
          }
          continue;
        }

        // --- ring target (Flower.cc:180-206) ---
        let wx = 0, wy = 0;
        if (count > 0) {
          const a = (2 * Math.PI * rotPos) / count + this.headingAngle;
          wx = Math.cos(a);
          wy = Math.sin(a);
        }
        const range = this.rangeFor(slot, p, center.r);
        wx *= range; wy *= range;

        if (slot.clumpRadius > 0) {
          const sa = (2 * Math.PI * p.j) / Math.max(1, slot.count) + this.headingAngle * CLUMP_SPIN;
          wx += Math.cos(sa) * slot.clumpRadius;
          wy += Math.sin(sa) * slot.clumpRadius;
        }

        // wanting += delta; wanting *= 0.5  ->  accel = 0.5 * (target - pos)
        wx += center.x - p.x;
        wy += center.y - p.y;
        this.integrate(p, wx * SPRING_GAIN, wy * SPRING_GAIN, dt);

        if (slot.clumpRadius === 0) rotPos++;
      }
      if (slot.clumpRadius > 0) rotPos++;
    }
  }

  /** Run enough ticks that the ring has settled, for a static screenshot. */
  settle(ticks = 120) {
    for (let i = 0; i < ticks; i++) this.step();
  }

  /**
   * Wall-clock driver for playback. Accumulates real seconds and runs only
   * whole ticks, so playback speed changes the rate but never the trajectory.
   */
  private acc = 0;
  advance(seconds: number, speed = 1) {
    this.acc += seconds * speed * TPS;
    // guard against a huge catch-up after a background tab resumes
    if (this.acc > 40) this.acc = 40;
    while (this.acc >= 1) {
      this.step();
      this.acc -= 1;
    }
  }
}

/** Distance from the rotation centre, for tests and readouts. */
export function orbitRadius(sim: OrbitSim, p: SimPetal): number {
  const c = sim.rotationCenter();
  return Math.hypot(p.x - c.x, p.y - c.y);
}

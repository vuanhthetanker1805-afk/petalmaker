import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Doc } from "@/src/engine/types";

export interface PetalRecord {
  id: string;
  name: string;
  rarity: number;
  doc: Doc;
  createdAt: string;
  views: number;
  /** optional free-text credit supplied at publish time */
  author?: string;
}

/**
 * Publish rate limiting. OFF by default -- publishing is unlimited unless
 * PUBLISH_LIMIT_PER_HOUR is set to a positive number.
 *
 * Worth turning on only if the site is public AND the Discord mirror is
 * enabled, since that combination turns an open endpoint into a route into
 * someone's server. For local use it is pure friction.
 *
 * In-memory, so on serverless it is per-instance rather than global -- a hard
 * guarantee would need the count in Postgres.
 */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateMax(): number {
  const v = Number(process.env.PUBLISH_LIMIT_PER_HOUR ?? 0);
  return Number.isFinite(v) && v > 0 ? v : 0; // 0 = unlimited
}

export function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const max = rateMax();
  if (max <= 0) return { ok: true };

  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= max) {
    const retryAfter = Math.ceil((RATE_WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  hits.set(ip, recent);
  // opportunistic cleanup so the map cannot grow without bound
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return { ok: true };
}

export interface Store {
  list(limit?: number): Promise<PetalRecord[]>;
  get(id: string): Promise<PetalRecord | null>;
  save(doc: Doc, author?: string): Promise<PetalRecord>;
}

const shortId = () => {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
};

/**
 * Default driver. Keeps `npm run dev` working with zero setup -- no database,
 * no env vars. Not suitable for serverless (the filesystem is ephemeral), which
 * is why POSTGRES_URL switches to the Postgres driver in production.
 */
class FileStore implements Store {
  private file = path.join(process.cwd(), ".data", "petals.json");

  private async readAll(): Promise<PetalRecord[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as PetalRecord[];
    } catch {
      return [];
    }
  }

  private async writeAll(rows: PetalRecord[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(rows, null, 2), "utf8");
  }

  async list(limit = 60) {
    const rows = await this.readAll();
    return rows.slice(-limit).reverse();
  }

  async get(id: string) {
    const rows = await this.readAll();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return null;
    rows[i].views++;
    await this.writeAll(rows);
    return rows[i];
  }

  async save(doc: Doc, author?: string) {
    const rows = await this.readAll();
    const rec: PetalRecord = {
      id: shortId(),
      name: doc.name,
      rarity: doc.rarity,
      doc,
      createdAt: new Date().toISOString(),
      views: 0,
      ...(author ? { author } : {}),
    };
    rows.push(rec);
    await this.writeAll(rows);
    return rec;
  }
}

/** Used automatically when POSTGRES_URL is present (Vercel, Neon, Supabase). */
class PostgresStore implements Store {
  private sqlP: Promise<import("postgres").Sql> | null = null;

  private async sql() {
    if (!this.sqlP) {
      this.sqlP = (async () => {
        const { default: postgres } = await import("postgres");
        const s = postgres(process.env.POSTGRES_URL!, { ssl: "require", max: 1 });
        await s`
          create table if not exists petals (
            id text primary key,
            name text not null,
            rarity int not null default 0,
            doc jsonb not null,
            created_at timestamptz not null default now(),
            views int not null default 0,
            author text
          )
        `;
        return s;
      })();
    }
    return this.sqlP;
  }

  async list(limit = 60) {
    const sql = await this.sql();
    const rows = await sql<PetalRecord[]>`
      select id, name, rarity, doc, created_at as "createdAt", views, author
      from petals order by created_at desc limit ${limit}
    `;
    return rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }));
  }

  async get(id: string) {
    const sql = await this.sql();
    const rows = await sql<PetalRecord[]>`
      update petals set views = views + 1 where id = ${id}
      returning id, name, rarity, doc, created_at as "createdAt", views, author
    `;
    return rows[0] ? { ...rows[0], createdAt: String(rows[0].createdAt) } : null;
  }

  async save(doc: Doc, author?: string) {
    const sql = await this.sql();
    const id = shortId();
    const rows = await sql<PetalRecord[]>`
      insert into petals (id, name, rarity, doc, author)
      values (${id}, ${doc.name}, ${doc.rarity}, ${sql.json(doc as never)}, ${author ?? null})
      returning id, name, rarity, doc, created_at as "createdAt", views, author
    `;
    return { ...rows[0], createdAt: String(rows[0].createdAt) };
  }
}

let cached: Store | null = null;
export function getStore(): Store {
  if (!cached) cached = process.env.POSTGRES_URL ? new PostgresStore() : new FileStore();
  return cached;
}

/** Reject junk before it reaches storage. */
export function validateDoc(v: unknown): { ok: true; doc: Doc } | { ok: false; error: string } {
  if (typeof v !== "object" || v === null) return { ok: false, error: "body must be an object" };
  const d = v as Partial<Doc>;
  if (typeof d.name !== "string" || d.name.length === 0 || d.name.length > 40)
    return { ok: false, error: "name must be 1-40 characters" };
  if (typeof d.radius !== "number" || !isFinite(d.radius) || d.radius <= 0 || d.radius > 500)
    return { ok: false, error: "radius out of range" };
  if (typeof d.rarity !== "number" || d.rarity < 0 || d.rarity > 9)
    return { ok: false, error: "rarity must be 0-9" };
  if (!Array.isArray(d.shapes)) return { ok: false, error: "shapes must be an array" };
  if (d.shapes.length > 200) return { ok: false, error: "too many shapes (max 200)" };
  const cmdCount = d.shapes.reduce((n, s) => n + (Array.isArray(s?.cmds) ? s.cmds.length : 0), 0);
  if (cmdCount > 5000) return { ok: false, error: "too many path commands (max 5000)" };
  return { ok: true, doc: v as Doc };
}

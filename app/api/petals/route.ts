import { NextResponse } from "next/server";
import { getStore, rateLimit, validateDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Behind Vercel the socket address is the proxy, so trust the forwarded header. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(120, Number(url.searchParams.get("limit") ?? 60) || 60);
  try {
    const rows = await getStore().list(limit);
    // `since` lets the Discord bot ask only for petals newer than the last one
    // it posted, instead of re-scanning the whole gallery every poll
    const since = url.searchParams.get("since");
    const petals = since
      ? rows.filter((r) => new Date(r.createdAt).getTime() > new Date(since).getTime())
      : rows;
    return NextResponse.json({ petals });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = rateLimit(clientIp(req));
  if (!gate.ok) {
    return NextResponse.json(
      { error: `Too many publishes. Try again in ${Math.ceil(gate.retryAfter / 60)} minutes.` },
      { status: 429, headers: { "retry-after": String(gate.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { author, ...docPart } = (body ?? {}) as Record<string, unknown>;
  const v = validateDoc(docPart);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // a petal with no artwork is almost always an accidental publish, and it
  // would post an empty image into Discord
  if (v.doc.shapes.length === 0)
    return NextResponse.json({ error: "draw something before publishing" }, { status: 400 });

  const credit =
    typeof author === "string" && author.trim().length > 0
      ? author.trim().slice(0, 40)
      : undefined;

  try {
    const rec = await getStore().save(v.doc, credit);
    return NextResponse.json({ petal: rec }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getStore, validateDoc } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Math.min(120, Number(new URL(req.url).searchParams.get("limit") ?? 60) || 60);
  try {
    const rows = await getStore().list(limit);
    // the list view only needs metadata + geometry, not per-row extras
    return NextResponse.json({ petals: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const v = validateDoc(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const rec = await getStore().save(v.doc);
    return NextResponse.json({ petal: rec }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

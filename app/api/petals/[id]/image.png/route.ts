import { getStore } from "@/lib/store";
import { exportSvg, exportTileSvg } from "@/src/export/svg";

export const dynamic = "force-dynamic";

/**
 * Rasterised petal art, so a Discord embed can actually show the design rather
 * than just naming it. Discord will not render SVG in an embed, so the vector
 * export is piped through sharp (already a Next.js dependency) to PNG.
 *
 *   ?style=tile  (default) the in-game inventory tile -- rarity plate + petal
 *   ?style=plain            the bare artwork on transparency
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const style = new URL(req.url).searchParams.get("style") === "plain" ? "plain" : "tile";

  try {
    const rec = await getStore().get(id);
    if (!rec) return new Response("not found", { status: 404 });

    const svg = style === "tile" ? exportTileSvg(rec.doc) : exportSvg(rec.doc, 6);
    const { default: sharp } = await import("sharp");

    let img = sharp(Buffer.from(svg), { density: 384 });
    img =
      style === "tile"
        ? img.resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        : img.resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

    const png = await img.png().toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        // artwork for a given id never changes, so let Discord cache it hard
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return new Response(`render failed: ${(e as Error).message}`, { status: 500 });
  }
}

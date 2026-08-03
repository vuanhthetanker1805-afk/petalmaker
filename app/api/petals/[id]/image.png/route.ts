import { getStore } from "@/lib/store";
import { exportSvg } from "@/src/export/svg";

export const dynamic = "force-dynamic";

/**
 * Rasterised petal art, so a Discord embed can actually show the design rather
 * than just naming it. Discord will not render SVG in an embed, so the vector
 * export is piped through sharp (already a Next.js dependency) to PNG.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const rec = await getStore().get(id);
    if (!rec) return new Response("not found", { status: 404 });

    const svg = exportSvg(rec.doc, 6);
    const { default: sharp } = await import("sharp");
    const png = await sharp(Buffer.from(svg), { density: 384 })
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        // the artwork for a given id never changes, so let Discord cache it
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return new Response(`render failed: ${(e as Error).message}`, { status: 500 });
  }
}

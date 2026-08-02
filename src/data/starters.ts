import { parseCpp } from "@/src/import/cppParser";
import type { Doc } from "@/src/engine/types";

/**
 * Example petals, kept as their original C++ from Client/Assets/Petal.cc and run
 * through the importer at load. Keeping the source rather than pre-baked JSON
 * means the examples are genuinely the game's artwork, and they exercise the
 * parser every time the app boots.
 */
const SOURCES: { name: string; radius: number; rarity: number; src: string }[] = [
  {
    name: "Basic", radius: 10, rarity: 0,
    src: `
      ctx.set_fill(0xffffffff);
      ctx.set_stroke(0xffcfcfcf);
      ctx.set_line_width(3);
      ctx.begin_path();
      ctx.arc(0, 0, r);
      ctx.fill();
      ctx.stroke();`,
  },
  {
    name: "Leaf", radius: 10, rarity: 1,
    src: `
      ctx.set_fill(0xff39b54a);
      ctx.set_stroke(0xff2e933c);
      ctx.set_line_width(3);
      ctx.round_line_cap();
      ctx.round_line_join();
      ctx.begin_path();
      ctx.move_to(-20, 0);
      ctx.line_to(-15, 0);
      ctx.bcurve_to(-10,-12,5,-12,15,0);
      ctx.bcurve_to(5,12,-10,12,-15,0);
      ctx.fill();
      ctx.stroke();
      ctx.begin_path();
      ctx.move_to(-9,0);
      ctx.qcurve_to(0,-1.5,7.5,0);
      ctx.stroke();`,
  },
  {
    name: "Stinger", radius: 7, rarity: 1,
    src: `
      ctx.set_fill(0xff333333);
      ctx.set_stroke(0xff292929);
      ctx.set_line_width(3);
      ctx.round_line_cap();
      ctx.round_line_join();
      ctx.begin_path();
      ctx.move_to(r, 0);
      ctx.line_to(-r*0.5, r*0.866);
      ctx.line_to(-r*0.5, -r*0.866);
      ctx.line_to(r, 0);
      ctx.fill();
      ctx.stroke();`,
  },
  {
    name: "Quartz", radius: 10, rarity: 2,
    src: `
      ctx.set_fill(0xffe8f0f5);
      ctx.set_stroke(0xffb8c4cc);
      ctx.set_line_width(3);
      ctx.round_line_join();
      ctx.begin_path();
      ctx.move_to(r, 0);
      ctx.line_to(r * 0.5, r * 0.866);
      ctx.line_to(-r * 0.5, r * 0.866);
      ctx.line_to(-r, 0);
      ctx.line_to(-r * 0.5, -r * 0.866);
      ctx.line_to(r * 0.5, -r * 0.866);
      ctx.line_to(r, 0);
      ctx.fill();
      ctx.stroke();`,
  },
  {
    name: "Amber", radius: 10, rarity: 4,
    src: `
      ctx.set_fill(0xffe89b1c);
      ctx.set_stroke(0xffb87715);
      ctx.set_line_width(3);
      ctx.begin_path();
      ctx.ellipse(0, 0, r * 0.85, r * 1.1);
      ctx.fill();
      ctx.stroke();
      ctx.set_fill(0xff7a4a08);
      ctx.begin_path();
      ctx.ellipse(0, 0, r * 0.3, r * 0.45);
      ctx.fill();`,
  },
  {
    name: "Yin Yang", radius: 10, rarity: 5,
    src: `
      ctx.set_line_width(3);
      ctx.set_fill(0xffffffff);
      ctx.set_stroke(0xffcfcfcf);
      ctx.begin_path();
      ctx.partial_arc(0,0,r,M_PI/2,3*M_PI/2,0);
      ctx.partial_arc(0,-r/2,r/2,-M_PI/2,M_PI/2,0);
      ctx.partial_arc(0,r/2,r/2,-M_PI/2,M_PI/2,1);
      ctx.fill();
      ctx.stroke();`,
  },
];

export const STARTERS: { name: string; doc: Doc }[] = SOURCES.map((s) => {
  const { doc } = parseCpp(s.src, s.radius);
  doc.name = s.name;
  doc.radius = s.radius;
  doc.rarity = s.rarity;
  return { name: s.name, doc };
});

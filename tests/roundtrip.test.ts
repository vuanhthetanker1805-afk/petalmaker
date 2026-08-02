import { describe, expect, it } from "vitest";
import { parseCpp } from "@/src/import/cppParser";
import { exportCpp } from "@/src/export/cpp";
import { exportSvg } from "@/src/export/svg";
import { deriveStroke, hsv, mix, toCppHex, argb, toCss } from "@/src/engine/color";
import { evalExpr, splitArgs } from "@/src/import/expr";

/**
 * These snippets are copied verbatim out of the real game source,
 * Client/Assets/Petal.cc, so the parser is tested against the actual dialect
 * rather than against something this project invented.
 */

// Petal.cc:906-921 -- regular hexagon, all coords as multiples of r
const QUARTZ = `
        case PetalID::kQuartz:
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
            ctx.stroke();
            break;
`;

// Petal.cc:1029-1041 -- two ellipses, the inner one fill-only
const AMBER = `
        case PetalID::kAmber:
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
            ctx.fill();
            break;
`;

// Petal.cc:58-81 -- cubics plus a separate stroke-only detail path
const LEAF = `
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
            ctx.stroke();
`;

// Petal.cc:518-528 -- partial_arc with a ccw flag driving the shape
const YINYANG = `
            ctx.set_line_width(3);
            ctx.set_fill(0xffffffff);
            ctx.set_stroke(0xffcfcfcf);
            ctx.begin_path();
            ctx.partial_arc(0,0,r,M_PI/2,3*M_PI/2,0);
            ctx.partial_arc(0,-r/2,r/2,-M_PI/2,M_PI/2,0);
            ctx.partial_arc(0,r/2,r/2,-M_PI/2,M_PI/2,1);
            ctx.fill();
            ctx.stroke();
`;

describe("expression evaluator", () => {
  it("handles the arithmetic found in petal source", () => {
    const s = { r: 10 };
    expect(evalExpr("r", s)).toBe(10);
    expect(evalExpr("r * 0.866", s)).toBeCloseTo(8.66);
    expect(evalExpr("-r * 0.5", s)).toBeCloseTo(-5);
    expect(evalExpr("r/2", s)).toBe(5);
    expect(evalExpr("M_PI/2", s)).toBeCloseTo(Math.PI / 2);
    expect(evalExpr("3*M_PI/2", s)).toBeCloseTo((3 * Math.PI) / 2);
    expect(evalExpr("-M_PI/2", s)).toBeCloseTo(-Math.PI / 2);
    expect(evalExpr("(r + 10)", s)).toBe(20);
    expect(evalExpr("1.5f", s)).toBe(1.5);
    expect(evalExpr("-1.5", s)).toBe(-1.5);
  });

  it("splits argument lists on top-level commas only", () => {
    expect(splitArgs("0, 0, r")).toEqual(["0", "0", "r"]);
    expect(splitArgs("Renderer::HSV(0xff777777, 0.8)")).toEqual(["Renderer::HSV(0xff777777, 0.8)"]);
  });

  it("rejects nonsense rather than silently returning garbage", () => {
    expect(() => evalExpr("r $ 2", { r: 10 })).toThrow();
    expect(() => evalExpr("unknownvar", { r: 10 })).toThrow();
  });
});

describe("colour maths matches Renderer.cc", () => {
  it("extracts AARRGGBB channels in the right order", () => {
    // 0xffcfcfcf is opaque #cfcfcf
    expect(toCss(0xffcfcfcf)).toBe("rgba(207,207,207,1)");
    // Renderer.cc treats the high byte as alpha
    expect(toCss(0x80ff0000)).toBe("rgba(255,0,0,0.5019607843137255)");
    expect(argb(255, 0x39, 0xb5, 0x4a)).toBe(0xff39b54a);
  });

  it("HSV is a brightness multiplier that preserves alpha", () => {
    expect(hsv(0xff646464, 0.5)).toBe(0xff323232);
    expect(hsv(0xff000000, 2)).toBe(0xff000000);
    // alpha of the base survives untouched
    expect(hsv(0x80ffffff, 0.5) >>> 24).toBe(0x80);
  });

  it("MIX lerps per channel and keeps base alpha", () => {
    expect(mix(0xff000000, 0xffffffff, 1)).toBe(0xffffffff);
    expect(mix(0xff000000, 0xffffffff, 0)).toBe(0xff000000);
  });

  it("emits C++ hex literals padded to 8 digits", () => {
    expect(toCppHex(0xff39b54a)).toBe("0xff39b54a");
    expect(toCppHex(0x0000ffff)).toBe("0x0000ffff");
  });
});

describe("round-trip of real petals from Petal.cc", () => {
  it("Quartz: hexagon geometry survives parse -> export", () => {
    const { doc, warnings } = parseCpp(QUARTZ, 10);
    expect(warnings).toEqual([]);
    expect(doc.name).toBe("Quartz");
    expect(doc.shapes).toHaveLength(1);

    const s = doc.shapes[0];
    expect(s.fill).toBe(0xffe8f0f5);
    expect(s.stroke).toBe(0xffb8c4cc);
    expect(s.lineWidth).toBe(3);
    expect(s.roundJoin).toBe(true);
    expect(s.fillRule).toBe("evenodd");
    expect(s.cmds).toHaveLength(7); // move + 6 line

    // r=10, so r*0.866 must have evaluated to 8.66
    expect(s.cmds[1]).toMatchObject({ t: "line", x: 5 });
    expect((s.cmds[1] as { y: number }).y).toBeCloseTo(8.66);

    // and it must come back out in r-parametric form
    const out = exportCpp(doc, { useRadius: true });
    expect(out).toContain("ctx.move_to(r, 0);");
    expect(out).toContain("ctx.line_to(r * 0.5, r * 0.866);");
    expect(out).toContain("ctx.line_to(-r * 0.5, -r * 0.866);");
    expect(out).toContain("ctx.set_fill(0xffe8f0f5);");
    expect(out).toContain("ctx.fill();");
    expect(out).toContain("ctx.stroke();");
    expect(out).toContain("case PetalID::kQuartz:");
  });

  it("Amber: two shapes, second is fill-only with no stroke", () => {
    const { doc, warnings } = parseCpp(AMBER, 10);
    expect(warnings).toEqual([]);
    expect(doc.shapes).toHaveLength(2);

    expect(doc.shapes[0].fill).toBe(0xffe89b1c);
    expect(doc.shapes[0].stroke).toBe(0xffb87715);
    expect(doc.shapes[1].fill).toBe(0xff7a4a08);
    // no ctx.stroke() followed the second begin_path
    expect(doc.shapes[1].stroke).toBeNull();

    const e = doc.shapes[0].cmds[0];
    expect(e.t).toBe("ellipse");
    expect((e as { rx: number }).rx).toBeCloseTo(8.5);
    expect((e as { ry: number }).ry).toBeCloseTo(11);

    const out = exportCpp(doc, { useRadius: true });
    expect(out).toContain("ctx.ellipse(0, 0, r * 0.85, r * 1.1);");
    // the fill-only shape must not emit a stroke call
    const second = out.slice(out.indexOf("0xff7a4a08"));
    expect(second).not.toContain("ctx.stroke();");
  });

  it("Leaf: cubics and a stroke-only detail path", () => {
    const { doc, warnings } = parseCpp(LEAF, 10);
    expect(warnings).toEqual([]);
    expect(doc.shapes).toHaveLength(2);

    const body = doc.shapes[0];
    expect(body.cmds.filter((c) => c.t === "cubic")).toHaveLength(2);
    expect(body.cmds[2]).toMatchObject({
      t: "cubic", c1x: -10, c1y: -12, c2x: 5, c2y: -12, x: 15, y: 0,
    });
    expect(body.roundCap).toBe(true);

    // the detail path is stroked but never filled
    const detail = doc.shapes[1];
    expect(detail.fill).toBeNull();
    expect(detail.stroke).toBe(0xff2e933c);
    expect(detail.cmds[1]).toMatchObject({ t: "quad", cx: 0, cy: -1.5, x: 7.5, y: 0 });

    // literal mode should reproduce the original hard-coded coordinates
    const out = exportCpp(doc, { useRadius: false, wrapCase: false });
    expect(out).toContain("ctx.move_to(-20, 0);");
    expect(out).toContain("ctx.bcurve_to(-10, -12, 5, -12, 15, 0);");
    expect(out).toContain("ctx.qcurve_to(0, -1.5, 7.5, 0);");
  });

  it("Yin Yang: partial_arc angles and the ccw flag survive", () => {
    const { doc, warnings } = parseCpp(YINYANG, 10);
    expect(warnings).toEqual([]);
    const cmds = doc.shapes[0].cmds;
    expect(cmds).toHaveLength(3);
    expect(cmds[0]).toMatchObject({ t: "parc", ccw: false });
    expect((cmds[0] as { sa: number }).sa).toBeCloseTo(Math.PI / 2);
    expect((cmds[0] as { ea: number }).ea).toBeCloseTo((3 * Math.PI) / 2);
    expect(cmds[2]).toMatchObject({ t: "parc", ccw: true });

    // angles should come back out in M_PI form, and the ccw flag preserved
    const out = exportCpp(doc, { useRadius: true, wrapCase: false });
    expect(out).toContain("ctx.partial_arc(0, 0, r, M_PI / 2, 3 * M_PI / 2, 0);");
    expect(out).toContain("1);");
  });

  it("parse -> export -> parse is stable (idempotent)", () => {
    for (const src of [QUARTZ, AMBER, LEAF, YINYANG]) {
      const first = parseCpp(src, 10);
      const emitted = exportCpp(first.doc, { useRadius: true });
      const second = parseCpp(emitted, 10);
      expect(second.warnings).toEqual([]);
      expect(second.doc.shapes.length).toBe(first.doc.shapes.length);
      // re-emitting must produce byte-identical output
      expect(exportCpp(second.doc, { useRadius: true })).toBe(emitted);
    }
  });
});

describe("even-odd fill semantics", () => {
  it("defaults to evenodd and only fill(1) opts into nonzero", () => {
    const eo = parseCpp("ctx.set_fill(0xffffffff); ctx.begin_path(); ctx.arc(0,0,r); ctx.fill();", 10);
    expect(eo.doc.shapes[0].fillRule).toBe("evenodd");
    expect(exportCpp(eo.doc, { wrapCase: false })).toContain("ctx.fill();");

    const nz = parseCpp("ctx.set_fill(0xffffffff); ctx.begin_path(); ctx.arc(0,0,r); ctx.fill(1);", 10);
    expect(nz.doc.shapes[0].fillRule).toBe("nonzero");
    expect(exportCpp(nz.doc, { wrapCase: false })).toContain("ctx.fill(1);");
  });

  it("warns instead of silently dropping a fill with no colour set", () => {
    const { doc, warnings } = parseCpp("ctx.begin_path(); ctx.arc(0,0,r); ctx.fill();", 10);
    expect(doc.shapes[0].fill).toBeNull();
    expect(warnings.join(" ")).toContain("no preceding set_fill");
  });
});

describe("HSV stroke idiom", () => {
  it("recognises Renderer::HSV on the way in and re-emits it", () => {
    const src = `
      ctx.set_fill(0xff777777);
      ctx.set_stroke(Renderer::HSV(0xff777777, 0.8));
      ctx.set_line_width(3);
      ctx.begin_path();
      ctx.arc(0, 0, r);
      ctx.fill();
      ctx.stroke();
    `;
    const { doc, warnings } = parseCpp(src, 10);
    expect(warnings).toEqual([]);
    expect(doc.shapes[0].stroke).toBe(deriveStroke(0xff777777));
    expect(exportCpp(doc, { wrapCase: false, useHsvIdiom: true }))
      .toContain("ctx.set_stroke(Renderer::HSV(0xff777777, 0.8));");
  });
});

describe("SVG export", () => {
  it("carries fill-rule through and emits a viewBox", () => {
    const { doc } = parseCpp(QUARTZ, 10);
    const svg = exportSvg(doc);
    expect(svg).toContain("<svg");
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('fill="#e8f0f5"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toMatch(/viewBox="[-\d. ]+"/);
  });

  it("emits fill=none for stroke-only shapes", () => {
    const { doc } = parseCpp(LEAF, 10);
    expect(exportSvg(doc)).toContain('fill="none"');
  });
});

describe("unsupported input is reported, not silently dropped", () => {
  it("warns on transforms and clip", () => {
    const { warnings } = parseCpp("ctx.scale(r / 10); ctx.begin_path(); ctx.arc(0,0,10); ctx.fill();", 10);
    expect(warnings.join(" ")).toContain("scale");
  });
});

/**
 * Document model. Mirrors the primitives available on the gardn Renderer
 * (Client/Render/Renderer.hh:71-91) so every document is exactly expressible
 * as gardn C++ -- nothing here can be drawn that the game cannot render.
 */

export type Cmd =
  | { t: "move"; x: number; y: number }
  | { t: "line"; x: number; y: number }
  | { t: "quad"; cx: number; cy: number; x: number; y: number }
  | { t: "cubic"; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { t: "arc"; x: number; y: number; r: number }
  | { t: "parc"; x: number; y: number; r: number; sa: number; ea: number; ccw: boolean }
  | { t: "ellipse"; x: number; y: number; rx: number; ry: number; a: number }
  | { t: "rect"; x: number; y: number; w: number; h: number }
  | { t: "roundRect"; x: number; y: number; w: number; h: number; r: number }
  | { t: "close" };

export type FillRule = "evenodd" | "nonzero";

export interface Shape {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  cmds: Cmd[];
  /** null = do not fill this shape */
  fill: number | null;
  /** null = do not stroke this shape */
  stroke: number | null;
  lineWidth: number;
  roundCap: boolean;
  roundJoin: boolean;
  /**
   * gardn's ctx.fill() is EVEN-ODD by default (Renderer.cc:311-315), the
   * inverse of the Canvas2D default. Only fill(1) opts into nonzero.
   */
  fillRule: FillRule;
}

export interface Doc {
  name: string;
  /** PETAL_DATA[id].radius -- artwork is authored at this scale. */
  radius: number;
  /** index into RARITY_COLORS / RARITY_NAMES */
  rarity: number;
  /** PETAL_DATA[id].count -- petals per clump, drives the clump preview */
  count: number;
  /** PetalAttributes::icon_angle */
  iconAngle: number;
  shapes: Shape[];
}

export type ToolId =
  | "select"
  | "pen"
  | "circle"
  | "ellipse"
  | "rect"
  | "roundRect"
  | "polygon";

let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyShape = (name: string): Shape => ({
  id: newId(),
  name,
  visible: true,
  locked: false,
  cmds: [],
  fill: 0xffffffff,
  stroke: 0xffcfcfcf,
  lineWidth: 3,
  roundCap: true,
  roundJoin: true,
  fillRule: "evenodd",
});

export const emptyDoc = (): Doc => ({
  name: "MyPetal",
  radius: 10,
  rarity: 0,
  count: 1,
  iconAngle: 0,
  shapes: [],
});

/** Anchor/handle points a shape exposes for direct manipulation. */
export interface Node {
  shapeId: string;
  cmdIndex: number;
  /** which coordinate pair within the command */
  slot: "p" | "c1" | "c2";
  x: number;
  y: number;
}

export function shapeNodes(s: Shape): Node[] {
  const out: Node[] = [];
  s.cmds.forEach((c, i) => {
    const push = (slot: Node["slot"], x: number, y: number) =>
      out.push({ shapeId: s.id, cmdIndex: i, slot, x, y });
    switch (c.t) {
      case "move":
      case "line":
      case "arc":
      case "ellipse":
      case "parc":
        push("p", c.x, c.y);
        break;
      case "quad":
        push("c1", c.cx, c.cy);
        push("p", c.x, c.y);
        break;
      case "cubic":
        push("c1", c.c1x, c.c1y);
        push("c2", c.c2x, c.c2y);
        push("p", c.x, c.y);
        break;
      case "rect":
      case "roundRect":
        push("p", c.x, c.y);
        break;
    }
  });
  return out;
}

export function moveNode(c: Cmd, slot: Node["slot"], x: number, y: number): Cmd {
  switch (c.t) {
    case "quad":
      return slot === "c1" ? { ...c, cx: x, cy: y } : { ...c, x, y };
    case "cubic":
      if (slot === "c1") return { ...c, c1x: x, c1y: y };
      if (slot === "c2") return { ...c, c2x: x, c2y: y };
      return { ...c, x, y };
    case "close":
      return c;
    default:
      return { ...c, x, y };
  }
}

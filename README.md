# flrrpetalmaker

A vector petal editor for [gardn](https://github.com/trigonal-bacon/gardn) — draw a
petal, then copy out C++ that pastes straight into `draw_static_petal_single`, or
export SVG.

## Why

gardn draws all of its petals as hand-written C++ against a Canvas2D shim — about
1300 lines of `ctx.begin_path(); ctx.bcurve_to(...)` in `Client/Assets/Petal.cc`.
Authoring a new petal means writing bezier coordinates by hand and rebuilding the
whole WASM client just to see what it looks like. This does that part visually.

## Features

- **Vector editor** — pen tool (lines + cubics with draggable handles), circle,
  ellipse, rect, rounded rect, polygon; node editing, layers, undo/redo
- **Export gardn C++** — a ready-to-paste `case PetalID::kX:` block, with a toggle
  between `r`-scaled coordinates (`r * 0.866`) and literals, matching the two
  conventions the real source uses
- **Export SVG**, JSON project files
- **Import gardn C++** — paste an existing petal case back in and edit it
- **Rarity colours** — all 10 tiers, driving a live loadout-tile preview
- **Live previews** — single petal, clump (`count > 1`), and inventory tile
- **Gallery** — publish a petal and share it at `/p/<id>`

## Faithful rendering

The preview does not use raw Canvas2D. It goes through `src/engine/gardnCanvas.ts`,
a port of gardn's `Renderer`, because two of its defaults differ from the browser's
and would otherwise make exports look wrong in-game:

| | gardn | Canvas2D |
|---|---|---|
| `fill()` winding | **even-odd** (`Renderer.cc:311-315`) | nonzero |
| colour format | `0xAARRGGBB` int | CSS string |

`Renderer::HSV(c, v)` is also not HSV — it is a brightness multiplier. The near
universal outline idiom in the artwork is `stroke = HSV(fill, 0.8)`, which the
editor exposes as a one-click "derive stroke" button and re-emits in that form.

Artwork is authored centred on `(0,0)` with **Y pointing down**, at
`PETAL_DATA[id].radius` scale (usually ±7–25), default `line_width` 3.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

No database needed for local development — the gallery falls back to a JSON file
under `.data/`.

```bash
npm run build    # production build
npm run lint
npm test         # round-trip tests against real Petal.cc source
```

## Deploying

Push to GitHub, then import the repo at [vercel.com/new](https://vercel.com/new).

For the gallery to persist in production, add any Postgres database (Vercel
Postgres, Neon, Supabase) and set:

```
POSTGRES_URL=postgres://…
```

`lib/store.ts` picks the driver automatically: `POSTGRES_URL` present → Postgres,
otherwise the local file store. The table is created on first use. Without the
env var the app still runs; the gallery just won't survive a redeploy, since
serverless filesystems are ephemeral.

## Tests

`tests/roundtrip.test.ts` parses petal snippets copied **verbatim** from
`Client/Assets/Petal.cc` — Quartz (polygon), Amber (ellipses), Leaf (cubics),
Yin Yang (`partial_arc` with a ccw flag) — re-exports them, and asserts the output
matches the original dialect. It also checks that parse → export → parse is
idempotent, so the model, parser and emitter cannot silently drift apart.

## Layout

```
app/            routes: editor, gallery, /p/[id], REST API
lib/store.ts    storage interface + file and postgres drivers
src/engine/     types, colour maths, gardn Renderer port, doc renderer
src/export/     cpp.ts, svg.ts
src/import/     cppParser.ts, expr.ts (evaluates `r * 0.866`, `M_PI / 2`)
src/ui/         canvas, toolbar, inspector, layers, previews, export panel
src/data/       rarity table, starter petals
tests/          round-trip tests
```

## Keyboard

`V` select · `P` pen · `C` circle · `E` ellipse · `R` rect · `G` polygon ·
`Ctrl+Z` / `Ctrl+Shift+Z` undo/redo · `Delete` remove shape · `Esc` cancel ·
`Alt+drag` pan · wheel zooms

## Licence

MIT

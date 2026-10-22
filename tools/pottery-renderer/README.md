# Pottery renderer

A zero-dependency, deterministic procedural renderer that makes studio-style
"product photos" of Indian terracotta pottery for the Jigar Matka House site.
It uses only Node built-ins: `worker_threads`, `zlib` and `fs`. PNGs are
encoded by `lib/png.mjs`.

> **These renders are illustrative placeholders.** Replace them with real
> product photography as soon as the shop's own photos are available.

## Run

```bash
# everything, final quality (all CPU cores)
node tools/pottery-renderer/render.mjs --out <dir> --quality final

# a group, or a subset of files
node tools/pottery-renderer/render.mjs --out <dir> --only products,hero
node tools/pottery-renderer/render.mjs --out <dir> --filter classic-clay-matka

# fast look-dev
node tools/pottery-renderer/render.mjs --out /tmp/draft --quality draft   # 0.3x, 1 spp
node tools/pottery-renderer/render.mjs --list                            # show jobs
```

**Groups:**
- `products`
- `hero`
- `sequence`
- `collection`
- `texture`
- `categories`
- `extras`

**Qualities:**
- `draft`: 0.3× resolution, 1 sample per pixel.
- `preview`: 0.5× resolution, 4 samples per pixel.
- `final`: full resolution, 4 samples per pixel, adaptively refined to 13 on edges.

Output is deterministic: the same code and arguments always give the same pixels.

## What it produces

| Path | Size | Notes |
|---|---|---|
| `products/<slug>/1.png` (18) | 1600×1600 RGB | catalogue shot on a cream sweep |
| `products/<slug>/2.png`, `3.png` (6 slugs) | 1600×1600 RGB | higher ¾ view, close detail — **defined (`--only extras`) but not rendered in the delivered set (P2 skipped)** |
| `hero/matka.png`, `hero/matka-shadow.png` | 1600×2000 RGBA | cutout + aligned shadow layer (#45352C, alpha = shadow) |
| `sequence/frame-000…059.png` | 1600×1000 RGBA | scroll sequence: band close-up → full pot, 100° turn |
| `collection/group.png` | 2400×1350 RGB | group shot, late-afternoon light |
| `texture/*.png` (3) | 2000×1250 RGB | macro close-ups |
| `categories/<slug>.png` (8) | 1200×1500 RGB | category covers |
| `manifest.json` | | every file with size, alpha flag and alt text |

The outer border of every opaque image (except the macro or detail close-ups)
is exactly `#F6F0E5`, so it blends into a page of that colour.

## Render time

On a heavily loaded 4-core/8-thread laptop i7, `final` took about 65 min for P0
(81 images) and about 20 min for P1 (11 images). On an idle machine it is several
times faster.

## How it works

**Geometry (`lib/profile.mjs`, `lib/models.mjs`).**
- Pots are 2D cross-section profiles revolved around the y axis. Each profile
  is built from splines, arcs and rounded corners.
- An exact polyline signed distance is accelerated by a two-level grid.
- Taps, handles, the coin slot, the wick, leaves and the coconut are custom
  SDFs.
- Low-harmonic radius wobble makes each pot slightly non-circular, so it looks
  handmade.

**Rendering (`lib/renderer.mjs`).**
- Shapes are drawn by sphere tracing.
- Lighting is a soft area key light with SDF penumbra shadows, plus fill and
  rim lights, SDF ambient occlusion and a warm floor bounce.
- The studio sweep is a shadow catcher.
- Diffuse uses Oren–Nayar with a warm wrap ("fake subsurface"). Specular is
  GGX with environment cards.
- Colours go through Hill ACES tone mapping.

**Materials (`lib/materials.mjs`, `lib/patterns.mjs`).**
- Clay gets mottling, firing flashes, grog speckle, sand and pores,
  wheel-throwing ridges and burnish.
- Brass, glaze, black clay and painted slip have their own materials.
- Painted motifs are 2D SDFs in (angle, arc-length) space, anti-aliased
  analytically from the pixel footprint.
- All noise is seeded by object-space position, so animation frames don't
  shimmer.

**Post-processing (`lib/post.mjs`).** Bloom for diya flames, depth of field
for close-ups, gentle grain, and exact-cream edges.

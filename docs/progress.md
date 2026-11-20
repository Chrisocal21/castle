# Castle Builder: Progress Tracker

Updated 2026-11-18.

## Done

- Concept defined and scoped (this session).
- Research on Miniopolis: store page, press kit and developer devlog read. Building method and design intent confirmed. World size not published.
- Version 1 design decisions made (see FEATURE_MAP).

## In progress

- Slice 1 first pass (2026-11-18): Vite + Three.js app on localhost:3000. 64 x 64 x 32 plot, orbit camera, drag-box select on any face, pull to extrude or push to subtract (plus E/Q keys), one material (light stone), 16³ chunked mesh with only edited chunks rebuilt, simple corner AO and soft shadows. Needs a feel test.
- Visual pass pulled forward from Slice 4 at Chris's request (2026-11-18): physical sky + image-based lighting, procedural cut-stone walls and flagstone tops with normal maps, grass/earth/walnut plinth textures, instanced wind-animated grass tufts that hide under blocks, GTAO ambient occlusion, subtle bloom, tilt-shift (T toggles), SMAA.
- Realism pass 2 + water (2026-11-18): tilt-shift off by default; larger stones on a 4-block tile with world-space weathering, base grime and rain streaks; calmer sun, brighter fill. Ground is now 4 layers of diggable earth. Water added as a block type (palette: Stone / Earth / Water, keys 1-3) with animated ripples and sky reflections. Plot sits as an island in a lake. Wooden plinth removed.
- Slice 2 first pass (2026-11-18): world stored on a 4x4x4 sub-grid per block (256 x 192 x 256 sub-cells, 32-cell chunks). Step size Full / Half / Quarter (keys Z / X / C) snaps both the selection box and the pull distance. Readout shows box size and pull amount in blocks (½, ¾ etc). Extrusion is relative to the selected surface, so a quarter-high surface extrudes a full block from its own height. Headless smoke test: full build ~0.5s, a large edit ~20ms.
- Slice 3 first pass (2026-11-18): all six materials (light stone, dark stone, brick, timber, plaster, roof tile) with their own procedural textures, keys 1-6 (earth 7, water 8). Auto-shape v0, applied at mesh time so stored data is never altered (toggle with A): (1) battlements: on the rim of any 2+ block tall wall of stone/dark stone/brick, alternate blocks lose their top half; (2) rounded outside corners on stone/dark stone/brick/plaster, so a 1x1 stack reads as a round tower. Not done: arches, windows, roof pitch.
- Autosave pulled forward from Slice 6 (2026-11-18): run-length encoded grid in localStorage, saved 0.9s after each edit, restored on load. A test castle is ~3 KB. Clear-plot button with inline confirm.
- HUD redesign (2026-11-18), based on docs/hud-research.md: bottom-centre dock with real-texture material chips (keys 1-8), step segment (1 / ½ / ¼), auto-shape toggle; material name fades in above the dock; size and pull tag pinned to the selection in the world; top-left brand + fading "Saved" mark; top-right controls / hide-HUD / clear; controls sheet on ? or F1; H hides the HUD; one-time first-drag hint.
- First-person camera (2026-11-18, Chris's call): orbit camera replaced by a fly camera (src/flycam.js). Two modes, Tab toggles: Fly (pointer locked, mouse look, crosshair builds, dock hidden) and Build (free cursor, hold right mouse to look, dock shown). WASD flies along the view, Space/Shift up/down, wheel glides, right mouse + wheel sets fly speed. Esc leaves Fly mode. Auto-shape key moved A -> B.
- Land & water materials + Paint tool (2026-11-18): grass, dirt, sand, gravel, cobblestone, rock, lake water, moat water (murkier). Dock split into Castle / Land & Water tabs (V switches, keys 1-8 within the tab). Paint (F or brush button) re-materials the selected surface one step deep without adding or removing blocks. Land materials never get battlements or rounded corners.
- Expandable plot (2026-11-18): + handles at each plot edge (Build mode) grow the plot 8 blocks that way, up to 256 x 256. Storage is now sparse 32-cell chunks, so empty sky costs nothing. Mesher merges flat 4x4 sub-face patches into one quad (64 x 64 ground: 147k -> 9k quads). Shadows follow the camera's view point. Save format v2 stores bounds + chunks; v1 saves migrate. Full 256 x 256 plot builds in about 2s headless.

## Suggested build slices (PROPOSED, order not confirmed)

1. Slice 1: bounded plot, orbit camera, drag-box extrude and subtract in full blocks, one material, chunked mesh.
2. Slice 2: half and quarter steps on the sub-grid.
3. Slice 3: six materials and the first auto-shape rules (battlements, corners).
4. Slice 4: miniature diorama look (shadows, light, depth of field).
5. Slice 5: utility blocks and photo mode with weather.
6. Slice 6: autosave, export and import, screenshot.

Test of success after slice 1: dragging a box and extruding feels satisfying on its own, before any castle shaping exists.

## Next action

Try Slice 3 in the browser. Then: Chris to pick the version 1 auto-shape list (arches, windows, roof pitch), and give feedback on the new HUD.

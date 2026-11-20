# Castle Builder: Feature Map

Working name. Voxel castle sandbox in the style of Miniopolis (Radiangames). Updated 2026-11-18.

Status key: DECIDED = Chris confirmed. PROPOSED = Forge suggestion, not yet confirmed.

## Core definition

- DECIDED: Strictly a builder. Same spirit as Miniopolis. No resources, no sim layer, no enemies, no fail state.
- DECIDED: Browser first (Three.js). Port to Unity only if it earns it.
- DECIDED: Filter for every feature: a quiet evening, zoned in, losing track of time. Anything that interrupts works against it.

## Building (version 1)

- DECIDED: Drag a selection box, then extrude or subtract blocks. This is how Miniopolis works. It is not premade pieces.
- DECIDED: Extrusion works in full, half and quarter block steps.
- PROPOSED: Full block sits on a 4x4 sub-grid. A quarter is one sub-cell, a half is two.
- DECIDED: Auto-shaping. Blocks shape themselves from context (wall tops become battlements, corners round into towers, window stacks get arches). Exact rule set not yet written.
- DECIDED: Six core materials: light stone, dark stone, brick, timber, plaster, roof tile.
- PROPOSED utility blocks: torches, banners, trees, water (moats), windows.

## Look and feel

- DECIDED: Miniature-model diorama look. Soft shadows, warm light, tilt-shift depth of field, clean slightly toy-like materials. No ray tracing.
- DECIDED: First-person fly camera with a quick Fly / Build mode switch (changed from free orbit camera, 2026-11-18).
- DECIDED: Photo mode with depth of field and weather controls.
- PROPOSED: Weather and time-of-day presets (sunny, sunset, night, fog, rain) inside photo mode.

## World

- DECIDED: Bounded plot, like a tabletop diorama base.
- PROPOSED: Start around 64 x 64 blocks, flat grass. Size is a tuning number. Miniopolis sources do not state its size.
- PROPOSED later: terrain options (hill, river, cliff).

## Progression

- DECIDED: Everything unlocked from the first minute.
- PROPOSED later: optional unlocks (materials, weather presets) only if a reason to return is needed.

## Save and share (version 1)

- DECIDED: Browser autosave.
- DECIDED: Export and import a castle as a small file.
- DECIDED: Screenshot button in photo mode.
- LATER: online gallery, shareable links.

## Out of scope for version 1

Resources, citizens, economy, combat, sieges, physics, multiplayer, mod support, free single-block "Minecraft mode".

## Technical notes

- Miniopolis regenerates its entire city mesh on every block add or remove (per the developer). That will not hold up in a browser. Plan: chunk the world so only the edited chunk rebuilds.

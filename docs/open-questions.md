# Castle Builder: Open Questions

Updated 2026-11-18.

1. Working name. "Castle Builder" is a placeholder.
2. Plot size. Starts 64 x 64; the player can now expand it 8 blocks per side up to 256 x 256. Is 256 the right cap?
3. Sub-grid. Built as 4x4x4 sub-cells per full block (Slice 2). Still unconfirmed by Chris; the SUB constant in world.js changes it.
4. Auto-shape rule set. v0 built with battlements and rounded corners only (Slice 3). Still needs Chris's written list for version 1: arches, roof pitch, windows?
5. Roofs. Do roof tiles auto-slope from a stack of blocks, or does the player draw the pitch? Not discussed.
6. Water. Built as a block type for now (dig, then fill with Water). A one-click fill tool could come later.
7. Utility block list. Torches, banners, trees, water, windows are proposed. Final list not confirmed.
8. Terrain. Flat plot first. When and how to add hills, rivers and cliffs?
9. Platform targets. Desktop browser assumed. Touch and mobile not discussed.
10. Audio. Music and ambient sound not discussed.
11. Performance target. Chunk size and the largest castle the browser must handle.
12. Slice order. Proposed order in PROGRESS_TRACKER not confirmed.
13. Sharing later. Gallery and links: wanted at all?

## Settled (do not reopen)

Strict builder, browser first, drag-extrude with full/half/quarter steps, auto-shaping on, six core materials, miniature diorama look, bounded plot, everything unlocked, free orbit camera with photo mode, autosave plus export/import plus screenshot.

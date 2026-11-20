# Castle Builder: HUD Research

Updated 2026-11-18. Covers the interface patterns of builder games and which ones suit a quiet castle sandbox.

## What the genre does

| Game | HUD pattern | Fit for us |
|---|---|---|
| Townscaper | Almost no UI. A colour palette, place and remove. No building menu. Stålberg calls it "more of a toy than a game". | High. Same toy spirit. |
| Tiny Glade (castle diorama) | Small icon toolbar, symbols not words, mouse-only. Procedural shapes do the work: tower bases grow battlements, walls meet walls. Critique: some tool features stay hidden. | Very high. Closest game to ours. |
| Miniopolis | Drag-box extrude/subtract, six blocks plus utility blocks, player-controlled weather, time of day and depth of field. | High. Our building model. |
| Minecraft (creative) | Bottom-centre hotbar of numbered slots, item name fades in above it. | High for materials. Number keys map to slots. |
| Anno 1800 | Functional over ornamental by design, to cut cognitive load. Bottom build bar, top resource bar. Console radial menus bury buildings in submenus. | Partial. Take the restraint, not the resource bars. |
| Manor Lords | Top bar of regional info, game-tools buttons, contextual pop-ups on a selection, a toggle to hide the whole UI for screenshots. | Partial. Take hide-UI and contextual info. |
| Cities: Skylines 2 | Dense bottom toolbar of categories and sub-tabs. Reviews say what to build is unclear. Being overhauled in 2026. | Low. Too much chrome for a sandbox. |

## Decisions for our HUD (PROPOSED)

1. **One bottom dock, centred.** Material swatches as real texture chips, step size, auto-shape. Number keys match chip order (Minecraft hotbar pattern).
2. **The name fades in above the dock** when the material changes, then fades out. No permanent labels.
3. **Measurements live at the selection**, not in a corner: a small tag tracks the selection on screen with its size and the pull amount.
4. **Controls are off-screen by default.** A `?` key opens a controls sheet. A one-time hint teaches the first drag, then goes away.
5. **Hide the whole HUD** with one key, for screenshots and for the "just look at it" moments.
6. **Quiet status, top corners only.** Autosave shows a small "Saved" mark that fades out. No resource bars, no notifications.
7. **Look:** dark smoked panels, a fine bronze hairline, serif small caps for names, tabular numerals for measurements. No glassy gradients, no neon, no emoji. Restraint over ornament (the Anno lesson).

## Avoid

- Category trees and submenus (Cities, Anno console). We have under ten tools.
- Text-heavy help on screen at all times.
- Hidden features with no way to discover them (the Tiny Glade critique). The `?` sheet lists everything.

## Sources

- Townscaper: https://en.wikipedia.org/wiki/Townscaper, https://reason.com/2021/03/19/townscraper/, https://pcgamer.com/townscapers-developer-on-how-its-radically-casual-design-is-inspiring-a-new-wave-of-low-stress-builders-to-adapt-the-blueprint
- Tiny Glade: https://gameluster.com/?p=107947, https://shacknews.com/article/141431/tiny-glade-review-score, https://indie-hive.com/tiny-glade/, https://spawningpoint.com/article/tiny-glade-review-2026-the-case-for-a-glade-without-a-goal
- Anno 1800: https://www.pcgamer.com/anno-1800s-clean-easy-to-use-interface-masks-a-fiendishly-compulsive-city-builder, https://www.anno-union.com/?p=9862, https://butwhytho.net/2023/03/review-anno-1800-console-edition/
- Manor Lords: https://wiki.hoodedhorse.com/Manor_Lords/Beginner's_Guide, https://gamesradar.com/manor-lords-tips
- Cities: Skylines 2: https://techradar.com/gaming/consoles-pc/cities-skylines-2-review-road-to-success, https://www.pcgames.de/Cities-Skylines-2-Spiel-74219/News/UI-Ueberarbeitung-Iceflace-Studios-1494328/
- Minecraft hotbar: general knowledge, not sourced here.

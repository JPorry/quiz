# Hamster Hideaway

A cozy Three.js take on Nurikabe: lay see-through play tubes through a glass
hamster habitat so that every hamster gets a room of its own. Every day brings
three new puzzles, one easy, one medium and one hard, and every earlier day stays
open to play. Like Tiny Isles, this is a standalone project with its own Vite
setup, build, and storage namespace, and it is published under
`/hamster-hideaway/` on the same GitHub Pages site.

## Run

```sh
npm ci
npm run dev -- --port 5191
npm test
npm run verify:levels
npm run build
```

Add `?capture` for screenshots (keeps the drawing buffer). `window.__hamsters`
has hooks for checks: `start(day, tier)`, `tutorial()`, `solve(leave)`,
`set([[cell, value], ...])` and `advance(seconds)`.

## Rules

It's Nurikabe, with the shaded cells as tubes and the islands as rooms:

- Every number is a hamster. It needs a room of exactly that many cells of
  bedding, counting its own.
- Hamsters live alone, so two rooms never touch side by side.
- All the tubes join up into one network.
- Tubes are one cell wide: no 2×2 block of tube anywhere.

Tap a cell to lay a tube, tap again to drop a sunflower seed (a note that the
cell is bedding), and once more to clear it. Dragging paints every cell it
passes with the same mark, and one Undo takes the whole drag back. Cells the
player leaves alone count as bedding, so a habitat is solved as soon as the
tubes are right; seeds are only notes.

The game points out mistakes as they happen: a 2×2 block of tube turns pink and
wobbles, a number whose room is walled in too small, or joined to another room
by seeds, turns coral, and the line under the habitat says which rule is
broken. **Hint** first points at any mark that's wrong, then at the next cell
a person could be sure of, and says why.

## A first game

The first time a puzzle is opened, a guided habitat of its own (Welcome Nook,
4×4) comes first. A coach card over the habitat greets the player, then shows
one deduction at a time on the board: the cell glows and the card explains the
rule that decides it (rooms never touch, a finished room is walled in, tubes
can't make a 2×2, no room can reach this far). When everyone is home it sums
up the rules and goes on to the puzzle that was picked. It can be skipped, and
replayed from Settings. **How to play** on the title opens it too.

## How it looks

The habitat is a tilted diorama seen through a fixed orthographic camera
(`src/scene.js`). A glass tank with a mint plastic base sits on a warm wooden
table; the front glass is left off so nothing stands between the player and
the board. The floor is a canvas of cream bedding flakes on a faint grid. Rows
stretch a little so cells look square through the tilt. Behind the tank stand a
little red-roofed house with a hamster peeking out, a water bottle hung on the
back glass, and a big blue wheel turning under a running hamster; a potted
plant sits by the front corner.

Tubes are built cell by cell: a glass ball at the cell's centre, an arm toward
every neighbouring tube, an open blue collar at each seam and a white shine
along the top. They're drawn in two passes (depth, then colour) so overlapping
glass blends as a single layer. A new tube pops in with a springy overshoot and
a few sparkles; a removed one shrinks away; neighbours re-join around it.

Every number is a hamster (`src/hamsters.js`): a chubby toy with a sticker
outline, in one of seven coats, that breathes, blinks and looks around, with
its number floating on a badge over it. Once its room is walled in at exactly
its size, the room gets a rug in its own colour, a pink bed slides in under the
hamster, and its things pop in one by one: a food bowl, a little wheel, a pile
of seeds, wooden chew blocks, a ball, a carrot, a wooden hideout, a cushion or a
sunflower. The hamster hops, settles down and closes its eyes, and its badge
turns green. If the room is broken again, its things shrink away and it wakes
up.

When every hamster has a room, the light turns golden, confetti pops over the
rooms, everyone hops, and a few hamsters come out to scurry through the tubes.

## Puzzles

`scripts/generate-levels.mjs` builds `src/days.js`: 400 days of an easy, a
medium and a hard habitat. Each one starts as a finished habitat, all tube,
with bedding carved out of 2×2 blocks of tube until none is left, keeping the
tubes in one piece and every room within its tier's size; rooms then grow a
little until the habitat has its share of bedding. Each room gets its number in
one of its cells. The puzzle is kept only if it has exactly one solution and a
player can solve it by always taking the easiest step.

`src/logic.js` has both solvers. `solve` counts solutions by propagation and
backtracking. `playerSolve` uses the rules a person would, in order: a cell
between two rooms is tube; a finished room is walled in; the last cell of a
three-quarters-tube 2×2 is bedding; cells no room can reach are tube; a room or
a tube with only one way out goes that way. When those run out it supposes a
cell one way, follows the rules, and if something breaks takes the other (a
"trial"). Easy habitats need no trials, medium ones one to four, hard ones five
to eighteen.

| Tier | Size | Biggest room | Trials |
| --- | --- | --- | --- |
| Easy | 5×5 or 6×6 | 4 | 0 |
| Medium | 6×7 or 7×7 | 5 | 1 to 4 |
| Hard | 7×8 or 8×9 | 5 | 5 to 18 |

`npm run verify:levels` checks every shipped habitat (about 4 seconds), and the
Pages workflow runs it before publishing.

## Sound

`scripts/compose-audio.py` (adapted from Tiny Isles') writes the music, the
effects and `src/audioManifest.js`: a slow lullaby in G major with a music box
or celesta lead over Rhodes, nylon guitar and upright bass, with a faint room
tone and the odd rustle of bedding. Effects are pitched in the same key: a
glassy celesta clink for each tube (a step higher along a drag), a woody tick
for a seed, a hamster squeak when one is tapped, a music-box ding-ding with a
happy squeak as each room comes right, and a kalimba-and-harp fanfare with a
chorus of squeaks for a win. It needs FluidSynth, the FluidR3 soundfont, ffmpeg,
numpy and scipy: `npm run compose:audio`.

## Title art

The title painting and logo are rendered from the game itself:
`dev/title.html` draws a finished habitat (capture it at 941×1672 with
`?capture`) and `dev/logo.html` sets the logo in Fredoka (capture `#logo` with a
transparent background). Both are saved as WebP in `public/`.

# Flower Patch

A cozy Three.js take on Tectonic (Suguru): plant seeds in raised garden beds and
watch them bloom. Like Tiny Isles, this is a standalone project with its own Vite
setup, build, and storage namespace, and it is published under `/flower-patch/`
on the same GitHub Pages site. The original Tectonic page in Twofold stays as it is.

## Run

```sh
npm ci
npm run dev -- --port 5190
npm test
npm run verify:levels
npm run build
```

Add `?capture` for screenshots (keeps the drawing buffer). `window.__garden` has
hooks for checks: `start(index)`, `solve(leave)` and `advance(seconds)`.

## Rules

- The garden is split into beds. A bed of N plots takes one of each seed from 1 to N.
- The same seed can never grow in two plots that touch, not even corner to corner.
- Beds hold at most six plots, so every seed is a dice face.

## How it looks

The garden is a tilted diorama seen through a fixed orthographic camera. Each
bed is a raised bed of soil walled in terracotta brick: three courses laid like a
real wall, each shifted half a brick, with cream mortar between, running from the
lawn up to just above the soil, with a strip of striped lawn between beds, so the
regions read at a glance. Faint dashed furrows split a bed into its plots, and
a white picket fence, bushes, mushrooms, and a watering can sit around the edge.
Rows stretch a little to make up for the tilt, so plots look square and the
garden fills a tall phone.

Around the fence is a little world (`src/world.js`) that fills whatever lawn the
screen shows: a cottage with a round roof and a puffing chimney behind the
garden, puffy trees (some in pink blossom), flowering bushes, spotted mushrooms,
a gnome, stepping stones leading down from the garden, and a pond with lily pads
and a paddling duck. Bunnies hop about and stop to look around, a snail glides
along, and ladybirds scurry in loops, each with a soft round shadow. Tap a
critter and it jumps. Everything is chunky and round with sticker outlines.

A seed shows as chubby round green sprouts laid out like a die's pips
(`src/flowers.js`), one round sprout per pip, so the number never needs a label.
Each sprout is a soft mochi-round seedling with two tiny leaves tucked on top,
big shiny eyes, rosy cheeks and a little smile, and it breathes gently. Plants grow through three stages and keep the
pips the whole way:

1. **Sprout:** a round, smiling seedling on a little mound, the same for every bed.
   It pops up with a squash and stretch when planted.
2. **Bud:** once a bed holds 1 to N with no clashes, it bursts into bud. A beat
   after the tap, a wave runs through the bed from the plot just planted, and
   each sprout *becomes* its bud in one continuous change (sixteen in-between
   shapes, `morph` in `src/flowers.js`): its body swells, rises and ripens
   through fresh yellows and peaches into the flower's colour, its two little
   leaves slide down and wrap round it as the outer petals, it closes its eyes,
   and the mound sinks away as leaves unfurl from the soil and a green cup grows
   under the bud. It breathes as it changes and lands with a little boing, a
   spray of petals and sparkles, a ring in the soil and a note that climbs with
   the wave. Green spreads across the bed from the plot behind a bright edge,
   the last pop rings the bed's chime, and a little flower flies up to the count
   of budding beds, which ticks up with a bounce. A butterfly comes to visit. If
   the bed is broken again, the buds turn back into sprouts the same way.
3. **Bloom:** when the garden is solved, the buds unfurl their petals in a wave
   from the middle, the camera rises to look down on the mosaic, the light turns golden,
   petals drift down, and bees come out.

At the finale each bud opens into its flower the same way, in one continuous
change (sixteen in-between shapes, `bloom` in `src/flowers.js`): a stem lifts it
as the ball of wrapped petals shrinks and its outer petals fold back and fade,
while the flower's own petals grow and unfurl from inside, and the green cup
slips down to hold it. The last shape of a bud and the first shape of its bloom
are identical (a test checks this), so nothing ever jumps.

Each bed grows one of nine flowers, each with its own shape as well as colour:
tulip, marigold, buttercup, daisy, forget-me-not, cornflower, lavender, pansy and
rose. They are built to look cosy, like a box of sweets: plump round petals,
big soft centres, short chunky stems and round leaves, in warm colours, with no
spikes or thin slivers (and no faces). A bud sits in a little green cup like a
lollipop. Every kind opens to the same big, chunky size, whatever its shape or
its plot's number, so the finished garden is an even carpet of flowers. Beds that touch, even at a corner, never share a flower, and colours are
picked far apart on the colour wheel (`assignFlowers` in `src/logic.js`). A
single-plot bed always grows a sunflower.

Plots planted at the start carry a little plant label: a cream board with a
coral border, a painted smiling sprout and a pink bow, standing at the front
middle of the plot, the one spot no die face uses. When two seeds clash,
their sprouts slump (grown plants droop), turn straw coloured, and the plot glows red.

## Controls

Pick a seed packet (each shows its die face), then tap a plot to plant it. Tap a
plot again with the same packet, or use the trowel, to dig it up. A seed too big
for its bed is refused. Undo and Restart (tap twice) sit under the packets; keys
1 to 6 pick a packet, 0 or Backspace the trowel, and Ctrl+Z undoes. The level
badge opens the picker: Easy, Medium and Hard tabs of twenty gardens each. Every
garden remembers what was planted, and a solved garden opens in bloom.

## Levels

Sixty levels in three pools of twenty, generated by `scripts/generate-levels.mjs`
(`npm run generate:levels`). The generator grows random beds of one to six cells
(at most one lone cell), fills them with a random valid solution, then removes
seeds in random order, keeping a removal only while the level still has exactly
one solution and a player can solve it with the pool's techniques. The solver in
`src/logic.js` always takes the easiest step:

| Technique | What it spots |
| --- | --- |
| single | a plot with one seed left |
| hidden | a seed with one plot left in its bed |
| reach | every plot that could take a seed in a bed touches one outside plot, so that plot can't |
| subset | two or three plots of a bed share just two or three seeds |
| trial | trying a seed breaks the garden, so it can't go there |

| Pool | Gardens | Needs |
| --- | --- | --- |
| Easy | 5×5 to 6×6 | singles and hidden singles only |
| Medium | 6×6 to 7×7 | at least two reach or subset steps, no trials |
| Hard | 7×7 to 8×8 | at least one trial |

`npm run verify:levels` (and `npm test`) checks every shipped level: sizes and
connected beds of at most six cells, a solution that follows the rules, givens that
match it, exactly one solution, solvable with the pool's techniques, and not
solvable with the easier pool's.

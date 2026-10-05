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
bed is a planter: soil sunk inside a terracotta brick wall of four courses laid
like a real wall, each shifted half a brick, with cream mortar between, running
from the lawn to a rim well above the soil. Pips sit a little in from each
plot's edges, so sprouts, buds and labels always stay inside the wall, with a strip of striped lawn between beds, so the
regions read at a glance.

The soil is a real surface, not a picture (`soilSurface` in `src/garden.js`):
every plot is a soft, rounded mound of earth, highest in the middle where its
plants grow, dipping into a furrow where it meets the next plot and settling
lower against the wall, with small lumps all over. It is shaded by its own
shape (furrows and the foot of the wall darker, crowns lighter), mottled with
damper and drier patches, and scattered with little clods. When a bed flowers,
the same mounds turn into soft green cushions of moss. A white picket fence, bushes, mushrooms, and a watering can sit around the edge.
Rows stretch a little to make up for the tilt, so plots look square and the
garden fills a tall phone.

Around the fence is a little world (`src/world.js`) that fills whatever lawn the
screen shows: a cottage with a round roof and a puffing chimney behind the
garden, puffy trees (some in pink blossom), flowering bushes, spotted mushrooms,
a gnome, stepping stones leading down from the garden, and a pond with lily pads
and a paddling duck. Bunnies hop about and stop to look around, a snail glides
along, and ladybirds scurry in loops, each with a soft round shadow. Tap a
critter and it jumps. Everything is chunky and round with sticker outlines.

A seed shows as tiny green seedlings laid out like a die's pips
(`src/flowers.js`), one per pip, so the number never needs a label. Each is a
little plant on a short stem: two big, round seed leaves low and wide, two
smaller, paler leaves standing up between them, and a curled new leaf in the
middle. From above the rosette reads as one round pip. Every number also has its
own colour, carried by the seedling's bud tip and its little upright leaves, and
by the dots on its seed packet, in soft pastels: 1 strawberry, 2 apricot,
3 butter, 4 baby blue, 5 lilac, 6 white. They differ in lightness as well as
hue (every pair is at least 42 apart in CIELAB ΔE), so a bed reads as a set of colours and a doubled number
stands out; the die layout still tells them apart for colour-blind players. As
a sprout grows into a bud and opens, it keeps its number's colour all the way
into full bloom. Seedlings breathe
gently. Plants grow through three stages and keep the pips the whole way:

1. **Sprout:** the seedling, with a few crumbs of earth heaved up round its
   foot, the same for every bed. Planting wakes it up: the soil swells into a
   little dome over each pip, trembles and cracks open with a few crumbs, and
   each seedling pushes slowly up out of the ground with its leaves folded up
   tight. Then it opens them out wide with a chirp and settles. Everything happens inside the plot. A dug-up seedling sinks back into
   the soil. A wilting one lets its leaves droop.
2. **Flower:** once a bed holds 1 to N with no clashes, it bursts into flower. A
   beat after the tap (or, if the last seed was just planted, once it has
   woken and opened its leaves) every plant in the bed grows at the same time,
   and each sprout *becomes* an open flower in one continuous change (24
   in-between shapes). First it grows into a fat bud (`morph` in
   `src/flowers.js`): the coloured bud tip swells and rises, petals in the
   same colour grow out of it and
   wrap round it, the seedling's leaves slide down to become the bud's rosette,
   and a green cup grows under it. Then the bud opens (`bloom`): a
   stem lifts it as the wrapped petals fold back and fade and the flower's own
   petals unfurl from inside. The flowers stay modest and all one size, so the
   dice faces still read. It lands with a little boing, a spray of petals and
   sparkles, a ring in the soil and a bright little chord. Green
   spreads across the bed from the plot behind a bright edge, the last pop rings
   the bed's chime, and a little flower flies up to the count of flowering beds,
   which ticks up with a bounce. A butterfly comes to visit. If the bed is broken
   again, the flowers close and shrink back into sprouts the same way.
3. **Bloom:** when the garden is solved, every flower grows a little bigger in a
   wave from the middle (the fewer in a plot, the bigger), opening flatter
   rather than puffing up, until the flowers just touch: the garden is full
   but each flower still reads on its own. The camera rises to look down on it, the light turns golden,
   petals drift down, and a crowd of bees, butterflies and ladybirds comes to see.

Little visitors live in the garden (`src/insects.js`), each a chubby toy with a
face, a sticker outline and a soft round shadow, flying slowly with smooth
steered motion that turns and banks gently. They cruise above the flowers and
only come down when right over the one they are visiting, landing on the real
top of its head, so they never pass through a flower:

- **Butterflies** have round, spotted wings. They flap in little bursts and
  glide between them, land on flowers and slowly fan their wings. Every bed in
  flower keeps one, and it flies off if the bed is broken.
- **Bumblebees** are round and fuzzy, with stripes and shimmering wings. They
  zip from flower to flower and hover over each one in a tiny figure of eight.
- **Ladybirds** flutter over with their spotted shells lifted, then settle on a
  flower, close up and potter round its petals.

Now and then a newly opened flower draws a visitor, who stops at a few flowers
and wanders off again. Tap the lawn near a critter to make it jump.

Now and then (every 7 to 17 seconds, at random) a gentle breeze drifts across
the garden from a random direction. A faint light ripple rolls slowly over the
beds, a couple of soft wind wisps and a few loose petals float along with it,
and every flower and sprout it passes leans over just a little and sways softly
back as it moves on (sprouts lean less). It comes with a quiet rustle. In
between, a light breeze keeps everything swaying gently.

Each stage's last shape is the next one's first (a test checks this), so nothing
ever jumps.

Kind and colour are separate. Each bed grows one of nine kinds of flower, each
with its own shape: tulip, marigold, buttercup, daisy, forget-me-not,
cornflower, lavender, pansy and rose. Each plant blooms in its seed number's
colour, whatever its kind (`palette` in `src/flowers.js`): the petals in the
number's colour, inner petals in a lighter or deeper shade of it, and a golden
eye picked to stand out against it. So a finished bed is one kind of flower in
1 to N different colours, and the numbers still read in full bloom. A bed's
green carpet is strewn with petals in its numbers' colours. They are built to
look like soft clay toys: every petal is an inflated balloon, narrow where it
joins the flower and swelling to a round, puffy tip, nearly as thick as it is
wide; centres are big soft domes, the daisy's and sunflower's ringed with
little beads. Plants use a smooth clay material with a gentle sheen and no
outline (`clay` in `src/look.js`), unlike the sticker-outlined world around
them. It takes less flat fill light and more sun than the world does, every
petal darkens towards its base and underneath, and plants cast shadows on each
other, so each petal stands out with a lit side, a shaded side and a crease. Short chunky stems and round leaves, no spikes or thin slivers (and no
faces). Each flower sits in a little green cup.

Beds that touch, even at a corner, never share a kind of flower
(`assignFlowers` in `src/logic.js`). A single-plot bed always grows a sunflower.

Plots planted at the start sit in a soft-edged patch of dark, rich earth, dug
over and already tended, so they stand out from the lighter soil around them.
When two seeds clash,
their sprouts slump (grown plants droop), turn straw coloured, and the plot glows red.

## Controls

Pick a bag of seeds, then tap a plot to plant it. Each bag is a plump little sack in its number's colour, tied with twine, with the die face on its label; picking one makes it squash, hop and wiggle, a seedling pops up and waves out of its top, and a few seeds tumble out. Tap a
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

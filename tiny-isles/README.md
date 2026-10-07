# Tiny Isles

A cozy Three.js take on Hashiwokakero (Bridges): connect little islands in a
turquoise sea and watch their cities grow. Every day brings three new puzzles,
one easy, one medium and one hard, and every earlier day stays open to play.
Like Tidal Garden, this is a standalone project with its own Vite setup, build,
and storage namespace, and it is published under `/tiny-isles/` on the same
GitHub Pages site.

## Run

```sh
npm ci
npm run dev -- --port 5183
npm test
npm run build
```

Add `?capture` for screenshots (keeps the drawing buffer). `dev/cities.html`
shows every stage of a city side by side; add `?x=` to pan along the row.

## Rules

- Each island shows how many bridges it wants.
- One or two bridges can join two islands. They run straight, only to the
  nearest island in that direction, and never cross.
- Every island must be joined into one network.
- On fog levels, some islands hide their number behind a cloud badge marked
  "?". They still want an exact number of bridges (somewhere from 1 to 8),
  which you work out from their neighbours. The badge shows a dot per bridge
  laid, and the fog lifts to reveal the numbers once everything joins up.

## How it looks

The board is a tilted diorama seen through a fixed orthographic camera. The sea
(`src/sea.js`) is a cel-shaded moving surface. Gentle swells cross the open water.
Near every island, waves roll in toward the shore, grow in the shallows, surge
up the cliffs and break into crisp white foam that slowly dissolves, throwing up
a few droplets as they hit. Lighting comes in hard bands, and depth shows as flat
rings of colour. Each level bakes its shorelines (islands and the rocks along
their cliffs) into a distance-field texture, so the shaders never loop over
islands. Islands (`src/island.js`) are little plateaus with cliffs in coloured layers, a
top that drips over the edge, rocks for the waves to break on, and a beach on
one side with a dock and a rowboat. Bigger numbers make bigger islands.

Each island has a personality. It belongs to a biome that sets its colours,
trees, landmark, the animals on its beach, the little things dotted on its top,
and what drifts through the air above it:

| Biome | Landmark | Locals | Dotted about | In the air |
| --- | --- | --- | --- | --- |
| Meadow | windmill | sheep | flowers, mushrooms | butterflies |
| Tropical | lighthouse | crabs | hibiscus | |
| Snowy | snowman | penguins | snow mounds, ice crystals | snow |
| Cherry blossom | pagoda | bunnies | fallen petals | petals |
| Desert | dome | tortoises | pebbles, barrel cacti | |
| Autumn | barn | hedgehogs | mushrooms, leaf piles | leaves |

The animals potter along their beach and hop about once their island has
exactly its number of bridges. Every bridge grows a footpath into town.
Sailboats tack in circles on the open water, leaving a wake, and gulls wheel
overhead.

Every island's city grows a step with each bridge it gets (`src/city.js`):

0. a cottage and two trees
1. a second cottage
2. houses, a shop with a striped awning and a little park
3. a clock tower, shops and a first apartment block
4. glass towers and taller apartments
5. a stepped skyscraper among the towers
6. a twisting tower and palm trees
7. a needle spire in shrinking hexagonal stages, a sail-shaped hotel and a
   golden ring
8. the full futuristic skyline, everything a little taller

New buildings rise with a springy pop and the ones they replace sink away.
Buildings are baked into one toon-shaded mesh each, with a soft outline so they
read like stickers.

A bridge is laid plank by plank: each plank drops in with a little bounce and
a note a step higher than the last. A dotted guide shows where it is heading.
Once every plank is down, the wooden bridge gets rope rails strung with
bunting, its piers rise out of the water with foam rings around them, confetti
pops at both ends and a chime plays. A second bridge between the same islands
rebuilds it as a wide stone bridge with peach parapets, a dashed road and lamp
posts. Tiny rounded cars drive across, two-way on two-lane bridges, and more
of them as the cities on both ends grow. Taking a bridge down tumbles its
planks into the sea, each with a splash.

Each island's badge shows its number with a ring of segments, one per bridge
it wants, filling as bridges arrive; it turns green when the island is happy
and red when it has too many. Connecting everything turns the light to golden
hour and sets off fireworks over the cities.

## Music and sounds

`scripts/compose-audio.py` composes and renders everything in `public/audio/`
and writes `src/audioManifest.js`. The music is low-key harbor lo-fi in G major.
The home theme is at 80 bpm:
- a soft Rhodes, a nylon guitar picking in eighths, and a walking upright bass
- a shaker, plus a soft kick and side stick on the home theme
- little two-bar tunes on a steel drum
- an accordion breathing through the B sections, and the odd glockenspiel twinkle
- a distant buoy bell

The two puzzle tracks are made for the background: 68 bpm, with the melody an
octave lower on vibraphone or a low marimba, fewer and longer phrases, the
guitar picking slowly in its own register, no drums but a whispered shaker,
quieter gulls, and the top end softened with a gentle low-pass. They also play
a little quieter than the home theme.

It's rendered through the FluidR3 General MIDI soundfont with FluidSynth and laid
over a harbor bed made with numpy: the sea swelling, a breeze, and gulls calling
("kyow" or a laughing run), some near, some far. There is one home theme and two
calmer puzzle tracks, and two streaming decks crossfade between them as you move
around; the music dips while the win fanfare plays.

The effects are pitched in G major pentatonic, so they always sit inside the
music:

| Moment | Sound |
| --- | --- |
| Touch an island | a round bloop with a woody tick |
| Each plank laid | a marimba tok, a step higher along the bridge |
| Drag past halfway | a bright pluck and a springy boing |
| Bridge opens | a kalimba run and a celesta twinkle; a stone bridge rings on steel drum and glockenspiel |
| An island gets exactly its number | a music-box ding-ding, higher with each happy island |
| A city grows | a glockenspiel sparkle, higher for bigger cities |
| Swipe cuts a bridge | a swish and a snip-snip, then a splash and bubbles |
| Bridges would cross | a wooden bonk and a sorry little boing |
| Tap the open sea | a drop of water |
| Undo, restart | a kalimba falling back, a wave washing over |
| Open a puzzle | a little boat's toot-toot |
| Every island joined | a steel-drum fanfare with harp, celesta, a gull and two toots |

The speaker button opens a menu with separate Music and Sounds switches, which
are remembered. To rebuild the audio (needs fluidsynth, fluid-soundfont-gm,
ffmpeg, numpy and scipy):

```sh
python3 scripts/compose-audio.py [--only=music|sfx]
```

## Controls

Drag from an island toward a neighbour: the bridge follows the finger plank by
plank, and past halfway it snaps across. Drag again for a two-lane bridge, and
a third time to take it down. Tapping a bridge, or two islands in turn, does
the same. Swiping across bridges from open water takes each one you pass over
down at once, single or double, with a splash. Every touch sends a ripple out from the
finger (warm yellow on an island), a swipe across the water leaves a fading
streak, and each bridge it cuts flashes a coral starburst (`src/touch.js`). A bridge that would cross another stops short and the one in the way
wobbles. Undo and Restart (tap twice) sit below the sea, and the back button
(or the phone's back gesture) returns home.

## Home

The home screen is a little live sea with today's three islands set in a
staircase, easy at the front up to hard at the back. Each island has a floating
label with its difficulty, name, a cloud when it has fog, and Play, Resume or
Solved. Tapping the island or its label opens the puzzle. The islands' cities
show how each puzzle is going: a cottage when untouched, a town once started, a
skyline when solved. Above the sea sit the bobbing title, today's date, a streak
chip (days in a row with a puzzle solved) and three shells that fill in as
today's puzzles are solved; below it, a greeting that follows the day's
progress and an Earlier days button counting the puzzles still open on past
days.

Earlier days (`#/days`) is a calendar, newest month first. Each day shows three
dots, filled in the difficulty's colour once that puzzle is solved and grey
once started; finished days turn green and today is ringed. Tapping a day opens
a sheet with its three puzzles as cards, each with a little map of its islands
(and the bridges laid so far). Back from a puzzle returns wherever it was
opened from.

Bridges are saved as they are laid, so any puzzle can be left and picked up
later, and a solved one opens finished (Restart plays it again). Puzzles are
addressed as `#/<day>/<tier>`. The home screen and the puzzle screen share one
renderer, which moves between them; nothing is drawn on the calendar.

## Levels

`src/days.js` holds 400 days of puzzles from day 1, 16 September 2026, so day 20
is 5 October 2026 and the last is in October 2027. `src/puzzles.js` turns the
player's local date into a day number, so a new day starts at their own
midnight, and gives each puzzle its name. `scripts/generate-levels.mjs` builds
them (`npm run generate:levels`, `--days=` for more); every puzzle is seeded by
its day and difficulty, so adding days never changes ones already played. Each
puzzle is packed into a short string: width and height, then four digits per
island for its row, column, number and fog.

Every puzzle has exactly one solution that a player can reach by always taking
the easiest step; `src/logic.js` holds the board model, the step-by-step solver
and the uniqueness check, and the tests run all 1,200. Each difficulty stays
steady from day to day:

| Difficulty | Seas | Islands | Fog | Needs |
| --- | --- | --- | --- | --- |
| Easy | 5×5 or 6×6 | 5 to 8 | 1 island, every third day | counting only |
| Medium | 7×7 | 9 to 12 | 2 islands, every other day | spotting islands that would be cut off, at most two look-aheads |
| Hard | 7×8 or 8×9 | 13 to 16 | 3 islands, every other day | at least two look-aheads |

A look-ahead tries a bridge and follows the easy steps until something breaks.
Fog is placed one island at a time, each time on the island that makes the
puzzle hardest while keeping it unique and within its difficulty. The solver
treats a fog island's number as a range (1 to 8) rather than a value, so every
deduction still holds. Rows stretch to fill tall phone screens.

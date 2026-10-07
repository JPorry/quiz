# Tidal Garden

A standalone Three.js interpretation of the Binary puzzle, rendered as a
miniature island diorama seen from above. This project has its own Vite
configuration, dependencies, build, and storage namespace.

## Run

```sh
npm ci
npm run dev -- --port 5180
```

The server listens on the local network, so a phone on the same Wi-Fi can use
the network address printed by Vite.

```sh
npm test
npm run verify:days
npm run build
npm run test:visual
npm run test:rendering
npm run test:touch
```

Visual tests expect the development server at `http://127.0.0.1:5180` and a
Playwright Chromium installation. Set `TIDAL_TEST_URL` to test another server.
Screenshots and canvas diagnostics are written to `test-results/`.

## Screens

Like Flower Patch and Tiny Isles, Tidal Garden is a daily puzzle: every day
brings three new gardens, an easy, a medium and a hard one, and every earlier
day stays open to play. A new day starts at the player's own midnight. Routes
are hash based, so a phone's back gesture steps back through them.

- **Title** (`#/`): the painted sea (`public/title-sea.webp`) fills the
  screen, with the **Tidal Garden** logo (`public/title-logo.webp`, a separate
  transparent image) in its sky and the buttons on the water. Everything
  arrives in turn, and again each time the title is shown: the sea eases in,
  the logo drops from above and lands with a squash and a wobble, the tagline
  fades up, then **Play** (today's gardens), **How to play** (the tutorial) and
  the Settings gear spring up. Afterwards the logo floats gently with a glint
  of light sweeping across its letters now and then, and Play breathes.
- **Today's gardens** (`#/daily`): over the painted sea, softened with a pale
  wash and with petals and bubbles drifting by. A back button to the title,
  the title in the logo's style, today's date, a flickering flame for the
  streak (days in a row with a garden in balance), three little islands for
  today that sprout once a garden is started and flower once it's in balance,
  and today's three gardens as cards: the difficulty with one to three dots, a
  little map of the garden, its name, its kinds of clue, and Play, Resume, or
  its time once in balance. A greeting follows the day's progress, and
  **Earlier days** shows how many past gardens are still to play.
- **Earlier days** (`#/days`): a calendar, newest month first, weeks starting
  on Monday. Each day has three dots for its gardens (green, gold and pink once
  in balance, sandy once started); a day with all three in balance turns green,
  and today is ringed. Tapping a day raises a sheet with its three cards.
- **A garden** (`#/<day>/<difficulty>`): the game, laid out to give the board
  every pixel it can. A slim bar on top holds Back, a pill with the
  difficulty's dots, the day and difficulty, the garden's name, time, and a
  progress bar, and a Settings button. Below the board sits a single hint
  line, then a dock with the three pieces and Undo, Hint, and Restart chips.
  On wide screens (iPads and desktops held landscape) the dock stands beside
  the board instead, so the board can use the full height; tablets get bigger
  pieces, and short landscape phones a compact, icon-only dock. Back returns to
  wherever the garden was opened from. Finishing a garden plays the finale, and
  its card offers the next garden still to play: the rest of that day, then
  today's, then the latest earlier day with one open.

Progress is kept in `localStorage` under `tidal-garden.daily`, per garden id
`<day>-<difficulty>`: the gardens in balance with their times, and the tiles,
undo history and time of the rest. Add `?play` to the address to go straight
into today's easy garden, as the visual tests do.

## Guided gardens

The tutorial is a garden of its own, **First Light** (`src/tutorialGarden.js`,
route `#/tutorial`). The first time a player opens any garden, they are taken to
the tutorial first, and once it's done or skipped they go straight on to the
garden they picked (the tutorial steps out of the history, so Back goes where
it should). **How to play** on the title opens it too.

A coach card above the board (`src/tutorial.js`) takes one rule at a time
(never three in a row, mind the gap, five and five), each on a real tile it
decides, chosen near the front of the board. The piece to pick bounces, the
tile to place pulses gold, and the tiles that decide it wear golden rings; a
wrong tile there asks for Undo. It ends with the last rule and where Hint is,
and the finished tutorial's win card says **Let's play** and goes on to the
garden picked.

The first daily garden with a kind of clue the player hasn't been shown yet
(villages, lighthouses, ferries or pilgrims) opens with a short guide of its
own: it introduces the clue, then shows it deciding a tile, using the solver's
simplest clue move. When the clue can't decide anything yet, the coach rings
those clues and the player plays on until one does. A garden shows at most one
guide, so a hard garden with two new clues saves the second for later. Each
guide can be skipped, ends when its garden is finished, and is remembered once
done (`tidal-garden.guides`).

## Settings

The gear on the title, today's gardens, and the garden's bar (and a button in the rules) opens Settings:
sliders for the music and sound-effect volumes (sliding to nothing switches
one off), a switch for tilting with the phone, the rules, the language (English or Spanish), Replay the tutorial (the
tutorial garden plays again, then returns to wherever the player was, and
every clue's guide returns), and Reset all
progress, which asks for confirmation before clearing every garden, time, and
guide.

## Languages

The game speaks English and Spanish (Spain). Every word the player sees lives
in a dictionary per language (`src/locales/en.js`, `src/locales/es.js`), read
through `src/i18n.js`: `t('key', { values })` fills in `{placeholders}`, and the
garden names have their own word lists per language in `src/gardenNames.js`,
in the same order, so a garden's name is the same idea in each ("Pebble Cove"
is «Cala de Guijarros»). The first visit follows the
device's language; the picker in Settings changes it and reloads the game on
the same screen, with Settings open. Anything a language hasn't translated
falls back to English, and a test checks that every language has every
string with the same placeholders. To add a language, copy `es.js`, translate
it, and list it in `LANGUAGES`.


## Install as an app

Tidal Garden can be added to a phone's home screen and opens full screen like an
app, with its own icon: on iOS, Share → Add to Home Screen; on Android, Install
app from the browser's menu. `index.html` carries the home-screen icon, title,
and status bar settings for iOS, and `public/manifest.webmanifest` describes the
app for other browsers. The icon, the little island at dawn, is drawn
in `scripts/icon.svg`; `node scripts/render-icons.mjs` renders it into the
favicons, the iOS icon, and the manifest's icons, including a maskable one.

## Music and sound

The music and sound effects are real audio files in `public/audio/`, composed
and rendered by `scripts/compose-audio.py` (run it with `npm run compose:audio`;
it needs FluidSynth, the `fluid-soundfont-gm` soundfont, ffmpeg, numpy, and
scipy). It writes the notes itself, renders them through sampled instruments
from the FluidR3 General MIDI soundfont, and lays them over a nature bed made
with numpy, then masters and encodes everything to MP3 and lists the files in
`src/audioManifest.js`.

The music is calm and slow, in F major: a warm pad and a soft low root hold a
progression that alternates Fmaj7, Am7, B♭maj7, Cadd9 with Dm9, B♭maj7, F/A,
Csus4, two bars per chord at 66 beats a minute. A harp rolls gently through some
chords, a lead sings short motifs that repeat with little twists and only ever
use the F major pentatonic scale, wind chimes stir now and then, and on the
title a flute breathes the odd long note. Beneath it the sea laps in slow,
uneven swells with a hiss of foam as each breaks, a breeze comes and goes, and
little songbirds sing now and then. Each screen has its own track: the title
(kalimba), the menus (music box, more birdsong), the garden (two longer, sparser
kalimba tracks that take turns, the quietest), and the finale's evening
(vibraphone, crickets instead of birds). Music streams through two decks that
crossfade at the end of a track and between screens.

The 43 sound effects are pitched in the same key, so they sit inside the music:
a marimba tap and a bubble for buttons, a breeze between screens, a kalimba run
and a celesta sparkle for Play, a marimba note for each garden card that
climbs with its difficulty, bubbles, soft round boops with a
kalimba note, and mist for the three pieces, a soft bloop and bubble with a kalimba
note or a soft thump and pop with a marimba note for each placement (pitched by where the tile lands, so filling a
row plays a little tune), a kalimba rewind for Undo, a celesta twinkle for a
hint, a soft marimba bonk when something falls out of balance, the tide
washing out for Restart, a gust and a harp sweep for a finished row, and the
clue celebrations: a kalimba welcome for a village, a bell buoy for a
lighthouse, a little ferry horn, a temple bell for the pilgrims, and a harp
arpeggio with a celesta shimmer for a finished garden. Effects are decoded once
and play instantly.

Browsers only allow sound after a tap, so the music starts with the player's
first tap or key (on iOS both music decks are unlocked by that tap). Settings
has a volume slider each for the music and the sound effects. The choices are
remembered, and sound pauses while the page is hidden.

## Puzzle

Water is `0`, land is `1`, and an empty tile is `null`.

- Every row and column contains five of each terrain type.
- Three identical terrain tiles cannot occur consecutively.
- Completed rows and columns must have distinct terrain patterns.

Every garden can be solved by always taking the easiest available move, so
moves chain into each other and the rule that lines must differ is never
needed. The moves, easiest first, are: a pair of equal tiles forces both ends,
a gap between two equal tiles takes the other kind, a line with five of one
kind takes the other kind everywhere else, and a line with only one balanced,
triple-free way to finish forces its tiles. Clues add moves of their own (see
below). The hint uses the same solver, pointing at the easiest move and saying
why it works.

## Daily gardens

`scripts/generate-days.mjs` (`npm run generate:days`) builds four hundred days
of gardens from 7 October 2026, three a day, into `src/days.js`, read by
`src/daily.js`, which also names each garden and works out today. Every garden
is 10×10 and is seeded by its day and difficulty, so adding days never changes
the ones already played. Each starts from a finished garden, sets out its clues
so they never crowd each other, then carves starting tiles away for as long as
a player could still solve it by always taking the easiest move. A garden is
packed as its starting tiles and its clues; its answer is worked out by the
same solver when it's opened. Generating takes about five minutes;
`--tier=hard --json=hard.json` builds one difficulty on its own (run the three
side by side) and `--merge=a,b,c` packs them together.

| Difficulty | Clues | Starting tiles | Needs |
| --- | --- | --- | --- |
| Easy | none, balance alone | 42 | pairs, gaps and counting; one answer |
| Medium | one kind, taking turns day by day: villages, lighthouses, ferries, pilgrims | about 26 | its clue at least twice, and can't be finished without it; no whole-line reasoning |
| Hard | two or more kinds, taking turns through the mixes (all four now and then) | about 20 | every clue at least once, and at least two rounds of whole-line reasoning |

`npm run verify:days` checks all 1,200 gardens (`npm test` checks the first
month's): a player can finish each one by always taking the easiest step, its
answer is balanced and keeps every clue, its starting tiles match the answer,
and it is the difficulty it says it is.

The starting tiles are the garden's old foundations. Starting land rises on
blue-grey stone cliffs with a pale stone rim around its green top, where your
own land has sand, and carries a small weathered landmark in one corner: a
standing stone, a cairn, a stone lantern, or now and then a little arch.
Starting water holds a gently deeper pool, rounded and darkest in the middle,
that fades softly into the turquoise around it; neighboring starting water
merges into one organic deep patch, so the sea never turns into a patchwork.
Grey stone appears nowhere else, and each garden arranges its landmarks
differently. Keyboard terrain selection uses `0`/`W`, `1`/`L`, and `E`; the
board supports focus and arrow navigation.

## The Villages

Village signs are one of the four kinds of clue. A
little village sign on a starting land tile, a rounded cream board under a tiny
thatched cap, shows how many land tiles its island holds.
Each land tile you join to a signed island raises a little round straw hut,
earthen walls under a layered thatched cone, and the tile's trees step aside to
make room. When water closes the
island in at exactly its number, the sign spins down into the ground, the last
hut pops up where it stood, the huts hop one after another, their doorways glow
with firelight, and smoke curls from every thatched crown; a soft chime plays
when sound is on. An
island that outgrows its sign, or is closed in too small, is marked like any
other mistake, and a garden is only finished when every village matches its
sign. Villages keep their flowers but host no wild residents.

The solver and hints know three village moves: a village that already holds its
number is sealed by water, a village short of its number with a single way out
must grow through it, and a gap that would join islands into a village bigger
than its sign must be water. The generator signs a handful of a finished garden's smaller
islands, each island wholly given over to its huts.

## The Lighthouses

Lighthouses are another kind of clue. A little red-and-white lighthouse on a
starting land tile carries a numbered badge: the count of water tiles its light
reaches looking straight up, down, left, and right before land or the board's
edge stops it. While it is dark, soft breathing dots mark the water it already
sees, so its count can be read off the garden. When every beam ends at exactly
its number, the badge pops off with a spin, the tower crouches and springs up
half again as tall, overshooting and wobbling to rest, and the lamp flickers on
twice before glowing steadily with a burst of sparkles, and a bright chime plays
when sound is on. Now and then, at random, a lit lighthouse sweeps its beam slowly
around once and lets it fade; undone, a lighthouse settles back down and its
badge returns. A lighthouse that already sees too much,
or can no longer see enough, is marked like any other mistake, and a garden is
only finished when every lighthouse is lit.

The solver and hints know two lighthouse moves: a lighthouse that already sees
its number has land at the end of every open beam, and when the other beams
cannot make up its number, the light must carry further along this one, so the
tiles it has to cross are water. The generator raises lighthouses on land
tiles that see two to eight water tiles.

## The Ferries

Ferries are the third kind of clue. Little wooden docks stand on starting
land tiles in pairs, each a ticket hut on the grass under a colored roof, with a
little porch, a lifebuoy,
and a fluttering pennant. Docks with matching roofs must end up joined by water,
moving up, down, left, and right, so their ferry can sail from beside one to
beside the other. When the water first joins a pair, the huts give a happy hop,
a jetty's planks pop out from each dock toward the water, and a chubby little
ferry, a white hull with a colored band, round windows, and a puffing funnel,
bobs up beside the first jetty with a soft toot-toot when sound is on. From then
on it is in no hurry: it rests at its jetty for ten seconds or so, ambles across
along the shortest water at about a quarter of a tile a second, leaving a soft
foamy wake, turns slowly around at the other jetty and rests there, then comes
back again. If land later cuts its course, it slips under and resurfaces at the
dock it left; undone, it sinks away and the jetties fold up. A pair of docks
that can no longer be joined is marked like any other mistake, and a garden is
only finished when every pair is joined.

The solver and hints know one ferry move: a tile that every remaining way
between two matching docks has to cross must be water. The generator sets out
pairs of docks on shore tiles joined by long crossings.

## The Pilgrims

Pilgrims are the fourth kind of clue. Little shrines stand on starting land
tiles in pairs: a wooden hall under a colored roof on a stone step, a tiny red
gate in front, and a paper lantern glowing in the pair's color (rose, mint,
amber, or violet). Shrines with matching lanterns must end up on the same
island, joined by land up, down, left, and right, so their pilgrim can walk from
one to the other. When land first joins a pair, the shrines give a happy hop,
the trees step aside for a stepping-stone path along the shortest way, glowing
lanterns pop up beside it one after another, and a tiny pilgrim in a straw hat
tied with a ribbon in the pair's color, with a matching bundle on their back and
a walking staff, steps out with the ring of a temple bell when sound is on. Like
the ferries, the pilgrim is in no hurry: they rest before a shrine for ten
seconds or so, bowing now and then, stroll along the path at about a fifth of a
tile a second with a little waddle, rest and bow at the other shrine, and walk
back. Where two paths share a tile it carries one set of stones and lanterns.
If water later cuts the way, the pilgrim slips back to the shrine they left;
undone, the lanterns shrink away and the trees return. Shrines that can no
longer be joined are marked like any other mistake. A garden that opens with a
path already joined finds its pilgrim resting at one of its shrines.

The solver and hints know one pilgrim move, the ferries' move turned around: a
tile that every remaining way between two matching shrines has to cross must be
land. Hard gardens can mix docks and shrines, so water has to join some pairs
while land joins others.

## Mixed clues

Hard gardens mix two or more kinds of clue. Every clue keeps its own rules and
its own celebration, and the hints reach for whichever move is easiest. Clues
are set out so they never crowd each other (`chooseClues` in
`scripts/garden-kit.mjs`): a signed island fills with huts, so it carries no
other clue (and no pilgrims' path crosses it), and every other clue keeps a
tile's distance from the rest.

## Art

The garden is a little diorama: a tray of sea above a layer of sand, seen
from a fixed orthographic camera tilted 10 degrees from straight down. Every
cell is the same size and rows stay parallel, so there is no pan, zoom, or
orbit to fight with taps, while the tilt still reveals the south-facing cliffs.
Add `?tilt=<degrees>` to the URL to try other angles.

Land tiles are rounded slabs with a sand cliff and a grass terrace. Each tile
picks its outline from its eight neighbors: sides facing water pull in and
round off, sides facing land run flush into the next tile, and inner corners
get a concave fillet, so connected land reads as one organic island. Outlines
are cached per neighbor pattern. Each land tile grows its own planting from a
gentle mix: round trees in three greens, cherry blossoms, autumn trees, tall
poplars, pines, saplings, small groves, berry bushes, flower patches, and
mossy rocks, each at its own size. Tufts of grass dot every island and sway in a
slow wave across the garden. Undecided cells are the unfinished
part of the model: empty cream plaster sockets with a sketched paper floor and
no water poured yet, which the water laps against. A new board assembles in a
wave of popping sockets; building a tile pushes its socket away as the water
floods in or the land rises, and clearing a tile pops a socket back up.

Depth comes from light. A low sun casts soft shadows, and shadowed areas see
only a pale blue sky light, which tints them blue rather than grey. The sun
crosses the sky as the garden fills, from morning light in the northeast to
golden hour in the northwest, easing over a few seconds after each tile so
shadows swing slowly across the board. Every so often a breeze wanders over
the garden. Its front is ragged, its strength comes in patches and puffs, and
its heading swirls, so trees and flowers bow from their base at different
moments and angles, loose leaves tumble along curling paths, and the water's
wave marks hurry along.
Now and then a cloud's shadow drifts across the tray: a soft, ragged cluster of
puffs that enters from a random side along a random line and takes 15 to 45
seconds to cross. The sky stays clear for most of the game: the first cloud
arrives after half a minute or so, and later ones come one to two minutes
apart, at random. About one cloud in three is a little darker and brings a
passing shower: slanted rain falls beneath it, building as it drifts over the
tray and easing off as it leaves, and each drop dimples the water or splashes
on the grass. Reduced motion keeps the sky clear.

When a placement completes a row or column that follows every rule, a gust of
wind rushes out along it from that tile: plants and grass bow and shake as it
passes, with a little spilling onto the rows either side, the tiles give a soft
bounce, and leaves and petals tumble along with it. With
sound on, a soft whoosh plays. Finishing a row and a column at once sends gusts
along both.

On phones the garden leans very slightly with the device, as if the diorama were
sitting in it: dipping the right edge lowers the board's east side and raising
the top edge lifts its north side, by up to three and a half degrees, reached
only at a full 30-degree turn of the phone, and followed smoothly.
Only movement counts: "level" slowly settles to however the phone is held, so
any comfortable reading angle is neutral. Android browsers share motion freely,
so tilting starts on; iOS needs a tap on each visit: the first one prompts and
later ones confirm quietly, without a prompt, once allowed. A switch in
Settings (shown only where the phone can tilt the garden) turns it on or off,
and the choice is remembered. Reduced motion
leaves the board still.

The water is flat pigment. One cached distance field to the same rounded
coastline drives a pale shallow rim, a lapping foam lip, calmer lakes, and a
few breathing wave marks in open water. Slow swells of light roll across it,
sunlight shimmers over the shallows, and glints twinkle in open water. Fish
shadows cruise between the islands, steering clear of land and each other,
and every few seconds one leaps clear of the surface with a splash.

New land springs up past its height and settles while its plants grow. New
water bursts up in a column that collapses into a ring-shaped crown and a
spray of droplets, floods its tile with light from the center, and sends a
foam ring rolling outward; sometimes a fish jumps out. Whatever was on the
tile before sinks away beneath it, and both send ripple rings across the
water, blocked by land and the tray edge, and a spring through neighboring
terrain and foliage.
Phone rendering is capped at 30fps and 1.25x pixel density with 1024px shadows
refreshed at most five times per second. Hidden pages pause scene rendering;
desktop rendering is capped at 45fps.

A faint white outline defines the 10x10 puzzle without numbered markers or
counting overlays. Hover, click, and keyboard focus illuminate both the active
row and column; the selected cell remains highlighted after the pointer leaves.

Fully enclosed small islands grow extra flowers, while enclosed lakes unfurl
lily pads. Three randomized land celebrations and three water celebrations
provide petal blooms, drifting lights, meadow waves, lotus sparkles, fountains,
and ripple choruses. A patch must have an entirely assigned cardinal shoreline;
unresolved cells and board edges cannot complete it. Undo or erase removes its
finished details, and reload restores them without replaying celebrations.
Reduced-motion preferences retain the finished details but disable animation.

Completed patches of at least two cells also become persistent wildlife habitats.
Single-cell islands and lakes keep their flowers, lily pads, and celebrations
without adding animals. Larger ponds gain koi
shoals, floating otter pairs, duck families, or frogs on lily pads. Land gains
perching songbirds, squirrels, butterflies, or rabbits. Residents are small,
round, and big-eyed, with eyes set high so they read from above. They surface,
fly in, or hop into place, then wander their whole habitat: each steers toward
spots it picks for itself, keeps its distance from its neighbors, walks around
tree trunks, and rests now and then. Ducklings paddle in a line behind their
mother, songbirds hop between treetops, and frogs croak on their lily pads. Fish and birds have additional color variations. Habitat choices are
seeded by the patch and puzzle so reload restores the same residents; undo
removes them if their shoreline reopens. Swimming paths stay within connected
water cells, and reduced-motion mode freezes residents in their settled poses.

Finishing a garden plays a finale instead of covering it with a dialog, and
every part of it is derived from the finished grid, so it works for any garden.
The interface fades away and a wave of life rolls out from the last tile:
islands bounce and shed petals while fish leap and ripples spread across the
water. The camera lifts to 38 degrees and slowly turns the island, framed to
fit the whole tray at any angle. The sun keeps going past golden hour into a
low sunset and a blue evening, fireflies come out over the land, paper lanterns
float up in open water, and a small flock sweeps in, circles the island, and
flies off. A small card then offers the way onward, to the next garden still to play; on wide
screens it sits on the left. Dragging turns the island by hand; tapping or pressing
a key brings the card forward early. "Stay a little longer" (or Escape) lowers
the camera back to the board and brings the interface back, and "See it at
dusk" returns to the evening view. Opening a finished garden goes straight to
its evening view, without the wave or the flock. Reduced motion skips the
turn, the wave, and the flock, and goes straight to the evening view.

All scene assets are generated in code. Interface fonts load from Google
Fonts with local serif and sans-serif fallbacks. The primary 3D scene remains
fully local.

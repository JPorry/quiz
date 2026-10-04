# Bunny Burrows

A cozy Three.js take on Hashiwokakero (Bridges), played on a little meadow
diorama. Burrows are the islands, stepping-stone paths are the bridges, and
Grandma's burrow is where the carrots come from. Like Tidal Garden, this is a
standalone project with its own Vite setup, build, and storage namespace, and
it is published under `/bunny-burrows/` on the same GitHub Pages site.

## Run

```sh
npm ci
npm run dev -- --port 5181
npm test
npm run build
```

Add `?play` to the URL to skip the title, `?unlock` to open every level, and
`?capture` for screenshots (skips the intro and keeps the drawing buffer).
`dev/bunnies.html` is a preview stage for the bunny models: open it through the
dev server and use `?zoom=`, `?elev=`, `?yaw=`, `?pan=`, `?moods=` and
`?binky=1` to look at them up close.

## Rules

- Each burrow has baskets. Lay exactly one path per basket.
- One or two paths can join two burrows. They run straight, only to the nearest
  burrow in that direction, and never cross.
- Grandma's carrots travel along the paths, so every burrow must be joined to
  Grandma's.

## How the rules show up

One object carries both of the puzzle's checks: the woven basket.

- **Waiting:** empty baskets sit in a ring on the mound's top. Their number is
  how many paths the burrow still needs, so the mound reads like a clue without
  printing one. (The Numbers chip adds small number badges for anyone who
  prefers them.)
- **Set out:** laying a path takes a basket off the mound and puts it beside the
  path's mouth, on the side the path leaves from. Double paths set out two.
- **Filled:** carrots only arrive along paths from Grandma's, so a burrow's
  set-out baskets fill, the round door swings open on a warm glow, and its
  bunny wakes up once it is joined to her. Baskets fill in waves outward from
  Grandma, nearest first, and a courier bunny with a basket hops the route to
  the farthest burrow that just joined. A group that closes itself off shows
  every basket set out and empty, with sleepy bunnies.
- **Too many paths:** an extra path arrives with no basket left, carrots spill
  on the grass, the mound shakes, and the bunny frets with a bead of sweat.

## Bunnies

The bunnies are built from primitives in `src/bunny.js`, in their own units and
scaled into the meadow. Each has a turned pear-shaped body with a lighter belly,
big hind feet and front paws, a pompom tail, puffy cheeks, a muzzle with a nose
that wiggles, a ω mouth, blush, whiskers, and glossy eyes with two highlights.
Ears hang from pivots so they can perk, twitch, droop, and trail behind a hop;
some bunnies are lop-eared. Fur uses a soft rim light so it reads as fluffy.
Coats come in snow, cream, caramel, cocoa, and smoke, with bows, scarves, or
flowers. Grandma wears round spectacles, a polka-dot headscarf, and a knitted
shawl with a brooch, and her burrow has a smoking chimney, carrot rows, and a
heart sign.

They are always alive: breathing, blinking (sometimes twice), looking around,
twitching ears, wiggling noses, wagging tails, and tipping their faces up toward
the player. Moods change with the puzzle: sleepy (slow breaths, closed eyes,
relaxed ears) until the carrots arrive, content when fed, happy when their
burrow is complete, and worried when it has too many paths. Hops use
anticipation, squash and stretch, and ears that lag behind; a happy bunny does a
binky, a twisting leap with ^ ^ eyes and an open smile. Finishing a level sends
binkies rippling out from Grandma with floating hearts.

## Levels

Thirty levels in one meadow, from 4 burrows on a 5×5 field to 17 on 8×9.
`scripts/generate-levels.mjs` grows each warren path by path from one burrow,
keeping burrows from crowding each other, adds a few loops, and keeps it only if
it has exactly one solution and a player can finish it by always taking the
easiest step. Grandma moves into the busiest burrow near the middle. The levels
are written to `src/levels.js` with their solutions, which the hints use;
regenerate them with `npm run generate:levels`.

The solver in `src/logic.js` works on a range of path counts for every possible
path and knows four steps, easiest first: crossing (a path can't be laid across
an existing one), capacity (a burrow's baskets must be shared among the paths it
can still take), isolation (never close a group off from Grandma), and trial
(try one end of a range and see if the easy steps fall apart). The same steps
rate difficulty, check uniqueness, and drive the hints: a hint points out a
wrong path first, otherwise the easiest path the player can be sure of, and says
why.

## Controls

Drag from a burrow toward a neighbour, or tap two burrows, to lay a path; doing
it again doubles it, and a third time takes it away. Tapping a path does the
same. A path that would cross another gives a little wobble instead. Undo,
Hint, Numbers, and Restart (tap twice) sit in the dock; Ctrl/Cmd+Z undoes.
Progress, each level's paths, and the sound and number settings are saved in
the browser.

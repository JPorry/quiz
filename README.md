# Twofold

A mobile-friendly logic puzzle collection built with React and Vite. The build
uses relative asset paths so it can be hosted from a GitHub Pages project URL
and later bundled in a Capacitor app.

## Local development

```sh
npm install
npm run dev
```

Before pushing a change, run:

```sh
npm run lint
npm run build
```

## Binary puzzle generation

Generate deterministic 10 × 10 Binary puzzles with:

```sh
npm run generate:binary -- --count=5 --seed=20260724 --clues=34
```

The generator starts from a valid completed grid and removes a clue only while
the exhaustive solver still finds exactly one solution. The production build
also generates sample puzzles and rejects the build if uniqueness is not
preserved.

## Elements puzzle generation

Generate deterministic 6 × 6 Elements puzzles with:

```sh
npm run generate:elements -- --count=5 --seed=20260725 --clues=15 --attempts=16
```

The generator evaluates uniquely solvable candidates with the same immediate
human techniques used for difficulty analysis. After every simulated placement
it records the available moves, their techniques and locations, newly revealed
moves, and the distance to the nearest continuation. It rewards repeated E1
separated-dominator deductions, technique diversity, nearby reveals, and
several continuously available choices while penalizing stalls, long
single-choice runs, visual search distance, and technique dominance.

The `--clues` value is a soft target. The generator evaluates several
clue-removal checkpoints and keeps extra clues when they produce a better
player-flow score. Clue removal is only a small tie-breaker after solve quality.
To replace the shipped level set, add `--output=src/biomesPuzzles.js`.
Add `--progressive` to vary clue counts and order the result using logical step
count and deduction dependency.

### Experimental 9 × 9 mode

Generate a 9 × 9 puzzle with:

```sh
npm run generate:elements:9 -- --count=1 --seed=20260725 --clues=30 --attempts=10
```

Replace the shipped experimental levels with
`--progressive --output=src/biomes9Puzzles.js`. The 9 × 9 generator uses cached
legal line patterns, bounded solution search, uniqueness verification, and the
same human solver as the 6 × 6 mode.

Run a development batch and print aggregate rejection and solving metrics with:

```sh
npm run batch:elements:9 -- --count=100 --seed=12345 --clues=30
```

Use `--strict` to reject candidates outside the preferred dominance-technique
range while tuning. Without it, those preferences contribute to quality
scoring instead of acting as hard constraints.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` builds and deploys the app after
every push to `main`. It can also be run manually from the Actions tab.

For the first deployment:

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings → Pages** in the GitHub repository.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab to follow the deployment.

The published URL will be shown in the completed deployment job.

The same deployment builds the standalone Tidal Garden project in
`tidal-garden/` and publishes it under `/tidal-garden/` on the same site. Bunny Burrows,
in `bunny-burrows/`, is built (after its tests pass) and published under
`/bunny-burrows/` the same way.

## Flower Patch

Flower Patch now lives in its own repository:
[JPorry/flower-patch](https://github.com/JPorry/flower-patch). Its source,
assets, puzzle generators, tests, and project history have moved there.

The existing `/flower-patch/` web demo remains available as a static snapshot in
`public/flower-patch/`, built from the standalone repository's commit
`5188f1e3f8a1dddf2870b60cc1ce0b3fc834e902`. Vite copies this snapshot into the
Pages build. Further Flower Patch development happens in the new repository;
the demo is no longer rebuilt as part of this project.

## Tiny Isles

Tiny Isles now lives in its own repository:
[JPorry/tiny-isles](https://github.com/JPorry/tiny-isles). Its source, artwork,
audio, puzzle generators, tests, and project history have moved there.

The existing `/tiny-isles/` web demo remains available as a static snapshot in
`public/tiny-isles/`, built from the extracted repository's commit
`e0d4e3511f121bd2b266b1797f2caf5a720d4bd2` (quiz commit `610b532`). Vite copies
this snapshot into the Pages build; further development happens in the new
repository. The snapshot keeps the existing browser save namespace.

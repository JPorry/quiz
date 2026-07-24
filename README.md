# Quiz

A mobile-friendly Hello World app built with React and Vite. The build uses
relative asset paths so it can be hosted from a GitHub Pages project URL and
later bundled in a Capacitor app.

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

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` builds and deploys the app after
every push to `main`. It can also be run manually from the Actions tab.

For the first deployment:

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings → Pages** in the GitHub repository.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab to follow the deployment.

The published URL will be shown in the completed deployment job.

// Shared building blocks for the chapter generators: reading flags, laying out a chapter's ramp of
// levels, and picking one garden per level so the whole chapter climbs steadily in difficulty.

// Flags without a value, like --output, are simply switched on.
export const parseArgs = (argv = process.argv.slice(2)) => Object.fromEntries(argv.map((arg) => {
  const [key, value = true] = arg.replace(/^--/, '').split('=')
  return [key, value]
}))

export const CHAPTER_LENGTH = 30

const lerp = (from, to, t) => from + (to - from) * t
const steps = (from, to, count) => Array.from({ length: count }, (_, i) => Math.round(lerp(from, to, count === 1 ? 0 : i / (count - 1))))

// A chapter's levels: a gentle stretch that needs only the chapter's own moves with pairs and gaps,
// a stretch that adds counting, and a long climb that adds whole-line reasoning. Starting tiles
// thin out along each stretch, and each clue's count grows across the chapter.
//   clues: { name: [first, last] }, each rounded to whole clues.
export function rampLevels({ moves = [], count = CHAPTER_LENGTH, gentle = 5, middle = 8, givens = [[32, 24], [24, 16], [16, 0]], clues = {} }) {
  const basic = [...moves, 'pair', 'gap']
  const counting = [...basic, 'count']
  const all = [...counting, 'line']
  const hard = count - gentle - middle
  const allowed = [...Array(gentle).fill(basic), ...Array(middle).fill(counting), ...Array(hard).fill(all)]
  const tiles = [...steps(...givens[0], gentle), ...steps(...givens[1], middle), ...steps(...givens[2], hard)]
  return allowed.map((techniques, i) => ({
    allowed: techniques,
    givens: tiles[i],
    // How far into its stretch this level sits, from 0 at the start to 1 at the end.
    stretch: i < gentle ? i / Math.max(1, gentle - 1) : i < gentle + middle ? (i - gentle) / Math.max(1, middle - 1) : (i - gentle - middle) / Math.max(1, hard - 1),
    ...Object.fromEntries(Object.entries(clues).map(([name, [from, to]]) => [name, Math.round(lerp(from, to, i / (count - 1)))])),
  }))
}

// Gathers a pool of gardens for a level: tries `make` until the pool is full (or the attempts run
// out), keeping the ones `accept` approves.
export function gather(make, accept, { size = 16, attempts = size * 40 } = {}) {
  const pool = []
  for (let attempt = 0; attempt < attempts && pool.length < size; attempt++) {
    const next = make()
    if (accept(next)) pool.push(next)
  }
  return pool
}

// Picks one garden from each level's pool so that each is harder than the one before, with the
// best total flow among all such runs.
export function climb(pools, difficulty, score) {
  const best = pools.map((pool) => pool.map(() => ({ total: -Infinity, from: -1 })))
  pools[0].forEach((garden, j) => { best[0][j] = { total: score(garden), from: -1 } })
  for (let i = 1; i < pools.length; i++) {
    pools[i].forEach((garden, j) => {
      pools[i - 1].forEach((before, k) => {
        if (best[i - 1][k].total === -Infinity || difficulty(before) >= difficulty(garden)) return
        const total = best[i - 1][k].total + score(garden)
        if (total > best[i][j].total) best[i][j] = { total, from: k }
      })
    })
  }
  let j = best.at(-1).reduce((top, entry, index, all) => (entry.total > all[top].total ? index : top), 0)
  if (best.at(-1)[j].total === -Infinity) {
    // Name the first level the climb can't get past, so the ramp there can be eased.
    const stuck = best.findIndex((row) => row.every((entry) => entry.total === -Infinity))
    throw new Error(`No climbing run reaches level ${stuck + 1}; try more candidates or ease that level`)
  }
  const chosen = []
  for (let i = pools.length - 1; i >= 0; i--) { chosen.unshift(pools[i][j]); j = best[i][j].from }
  return chosen
}

export const encodeGrid = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`

// Builds Tiny Isles' daily puzzles into src/days.js: every day has one easy, one
// medium and one hard puzzle.
//
// Each puzzle grows a network bridge by bridge from one island, then is kept only
// if it has exactly one solution and a player can solve it by always taking the
// easiest step, using only the techniques its difficulty allows. On some days a
// puzzle hides a few islands' numbers in fog, picked so it stays fair and gets
// harder. Every puzzle is seeded by its day and difficulty, so adding more days
// never changes the ones already played.
//
//   node scripts/generate-levels.mjs --days=400 --output=src/days.js
import { writeFileSync } from 'node:fs'
import { buildBoard, solve, playerSolve, DIRECTIONS } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const DAYS = Number(args.days ?? 400)
const FIRST_DAY = '2026-09-16'
let seed = 1
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const pick = (list) => list[Math.floor(rand() * list.length)]

// What each difficulty looks like every day. `fogOn` says which days it has fog.
const TIERS = {
  easy: {
    size: () => (rand() < 0.5 ? [5, 5, 5 + Math.floor(rand() * 3)] : [6, 6, 6 + Math.floor(rand() * 3)]),
    fog: 1,
    fogOn: (day) => day % 3 === 2,
    allows: (used) => !used.isolation && !used.trial,
    base: (used) => !used.isolation && !used.trial,
  },
  medium: {
    size: () => [7, 7, 9 + Math.floor(rand() * 4)],
    fog: 2,
    fogOn: (day) => day % 2 === 1,
    allows: (used) => used.trial <= 2 && used.isolation + used.trial >= 1,
    base: (used) => used.trial <= 2,
  },
  hard: {
    size: () => (rand() < 0.4 ? [7, 8, 13 + Math.floor(rand() * 3)] : [8, 9, 14 + Math.floor(rand() * 3)]),
    fog: 3,
    fogOn: (day) => day % 2 === 0,
    allows: (used) => used.trial >= 2,
    base: () => true,
  },
}

function grow({ width, height, count }) {
  const grid = Array.from({ length: height }, () => Array(width).fill(null))
  const used = Array.from({ length: height }, () => Array(width).fill(false))
  const islands = []
  const bridges = new Map()
  const free = (r, c) => r >= 0 && r < height && c >= 0 && c < width && grid[r][c] === null && !used[r][c]
  // Keep islands from crowding each other: none right beside or diagonal to another.
  const roomy = (r, c) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc
      if ((dr || dc) && rr >= 0 && rr < height && cc >= 0 && cc < width && grid[rr][cc] !== null) return false
    }
    return true
  }
  const place = (r, c) => {
    grid[r][c] = islands.length
    islands.push([r, c])
  }
  place(Math.floor(rand() * height), Math.floor(rand() * width))
  for (let attempt = 0; attempt < 2000 && islands.length < count; attempt++) {
    const from = Math.floor(rand() * islands.length)
    const [dr, dc] = pick(Object.values(DIRECTIONS))
    const [r0, c0] = islands[from]
    const length = 2 + Math.floor(rand() * (Math.max(width, height) - 2))
    let ok = true
    const cells = []
    for (let s = 1; s < length; s++) {
      const r = r0 + dr * s, c = c0 + dc * s
      if (!free(r, c)) { ok = false; break }
      cells.push([r, c])
    }
    const r = r0 + dr * length, c = c0 + dc * length
    if (!ok || !free(r, c) || !roomy(r, c)) continue
    cells.forEach(([rr, cc]) => (used[rr][cc] = true))
    place(r, c)
    bridges.set(`${from}-${islands.length - 1}`, rand() < 0.4 ? 2 : 1)
  }
  if (islands.length < count) return null
  // A few extra bridges between islands that already see each other make loops.
  const level = { width, height, burrows: islands.map(([r, c]) => [r, c, 0]) }
  const board = buildBoard(level)
  const counts = board.edges.map((e) => bridges.get(`${e.a}-${e.b}`) ?? bridges.get(`${e.b}-${e.a}`) ?? 0)
  for (const e of board.edges) {
    if (counts[e.index] || rand() > 0.35) continue
    if (board.crossings[e.index].some((f) => counts[f] > 0)) continue
    counts[e.index] = rand() < 0.3 ? 2 : 1
  }
  for (const e of board.edges) {
    level.burrows[e.a][2] += counts[e.index]
    level.burrows[e.b][2] += counts[e.index]
  }
  return level
}

const score = (used, level, fog) => used.capacity + used.isolation * 4 + used.trial * 12 + level.burrows.length * 2 + fog * 3

// Checks a level and rates it, or returns null if it doesn't belong in this pool.
function rate(level, tier) {
  const board = buildBoard(level)
  const player = playerSolve(board)
  if (!player.solved || !tier.allows(player.used)) return null
  const solutions = solve(board, { limit: 2 })
  if (solutions.length !== 1) return null
  const fog = level.burrows.filter((b) => b[3]).length
  return { level, solution: solutions[0], used: player.used, score: score(player.used, level, fog) }
}

// Hides numbers one island at a time, keeping each choice that leaves the puzzle
// fair and makes it hardest.
function addFog(base, tier, want) {
  let best = base
  for (let n = 0; n < want; n++) {
    let next = null
    const order = best.level.burrows.map((_, i) => i).filter((i) => !best.level.burrows[i][3]).sort(() => rand() - 0.5).slice(0, 8)
    for (const i of order) {
      const burrows = best.level.burrows.map((b, j) => (j === i ? [b[0], b[1], b[2], 1] : b))
      const rated = rate({ ...best.level, burrows }, tier)
      if (rated && (!next || rated.score > next.score)) next = rated
    }
    if (!next) return null
    best = next
  }
  return best
}

function candidate(name, day) {
  const tier = TIERS[name]
  seed = (day * 7919 + Object.keys(TIERS).indexOf(name) * 104729) % 2147483646 + 1
  const foggy = tier.fogOn(day)
  for (let attempt = 1; ; attempt++) {
    if (attempt % 3000 === 0) console.error('still looking', name, day)
    const [width, height, count] = tier.size()
    const level = grow({ width, height, count })
    if (!level) continue
    if (!foggy) {
      const rated = rate(level, tier)
      if (rated) return rated
      continue
    }
    // a fog puzzle starts from one that is fair even before the fog
    const plain = rate(level, { allows: tier.base })
    if (!plain) continue
    const fogged = addFog(plain, tier, tier.fog)
    if (fogged) return fogged
  }
}

// a puzzle packed into a short string: width and height, then four digits per
// island for its row, column, number and whether it is in fog
const pack = ({ width, height, burrows }) => `${width}${height}:${burrows.map(([r, c, v, f]) => `${r}${c}${v}${f ? 1 : 0}`).join('')}`

const days = []
for (let day = 1; day <= DAYS; day++) {
  const puzzles = Object.keys(TIERS).map((name) => candidate(name, day))
  days.push(puzzles.map((p) => pack(p.level)))
  if (day % 20 === 0 || day === DAYS) console.log('day', day, puzzles.map((p) => `${p.level.burrows.length} isles ${p.level.burrows.filter((b) => b[3]).length} fog ${JSON.stringify(p.used)}`).join(' | '))
}

const body = `// Generated by scripts/generate-levels.mjs. Regenerate with \`npm run generate:levels\`.
// Day 1 is FIRST_DAY. Each day has an easy, a medium and a hard puzzle, packed as
// "<width><height>:" followed by four digits per island: row, column, number, and
// 1 when the number is hidden in fog.
export const FIRST_DAY = '${FIRST_DAY}'
export const DAYS = [
${days.map((d) => `  ${JSON.stringify(d)},`).join('\n')}
]
`
if (args.output) writeFileSync(args.output, body)
else process.stdout.write(body)

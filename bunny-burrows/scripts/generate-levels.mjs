// Builds the meadow's levels into src/levels.js.
//
// Each level grows a warren path by path from one burrow, then keeps it only if it has
// exactly one solution and a player can solve it by always taking the easiest step.
// A pool is gathered for every level and one is picked so the levels climb steadily.
import { writeFileSync } from 'node:fs'
import { buildBoard, solve, playerSolve, DIRECTIONS } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
let seed = Number(args.seed ?? 20261004)
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const pick = (list) => list[Math.floor(rand() * list.length)]

const NAMES = [
  'Clover Hollow', 'Dandelion Dell', 'Buttercup Bank', 'Mossy Nook', 'Thimble Hill',
  'Primrose Patch', 'Bramble Corner', 'Daisy Green', 'Willow Bend', 'Hazel Hedge',
  'Fern Gully', 'Acorn Rise', 'Bluebell Wood', 'Sorrel Slope', 'Poppy Field',
  'Mushroom Ring', 'Pebble Brook', 'Cowslip Lane', 'Honeysuckle Way', 'Lavender Row',
  'Foxglove Glen', 'Sweetpea Crossing', 'Elderflower Edge', 'Meadowsweet', 'Rosehip Ridge',
  'Thistledown', 'Juniper Knoll', 'Chamomile Fold', 'Snowdrop Vale', 'Grandma’s Orchard',
]

// size, burrow count, and whether the hardest technique may appear
const PLAN = [
  ...Array.from({ length: 4 }, (_, i) => ({ width: 5, height: 5, count: [4, 5, 6, 6][i], trial: false, isolation: false })),
  ...Array.from({ length: 6 }, (_, i) => ({ width: 6, height: 6, count: [7, 7, 8, 8, 9, 9][i], trial: false, isolation: i > 2 })),
  ...Array.from({ length: 8 }, (_, i) => ({ width: 7, height: 7, count: [9, 10, 10, 11, 11, 12, 12, 13][i], trial: false, isolation: true })),
  ...Array.from({ length: 6 }, (_, i) => ({ width: 7, height: 8, count: [12, 13, 13, 14, 15, 15][i], trial: i > 2, isolation: true })),
  ...Array.from({ length: 6 }, (_, i) => ({ width: 8, height: 9, count: [15, 15, 16, 16, 17, 17][i], trial: true, isolation: true })),
]

function grow({ width, height, count }) {
  const grid = Array.from({ length: height }, () => Array(width).fill(null))
  const used = Array.from({ length: height }, () => Array(width).fill(false))
  const burrows = []
  const bridges = new Map()
  const free = (r, c) => r >= 0 && r < height && c >= 0 && c < width && grid[r][c] === null && !used[r][c]
  // Keep mounds from crowding each other: no burrow right beside or diagonal to another.
  const roomy = (r, c) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc
      if ((dr || dc) && rr >= 0 && rr < height && cc >= 0 && cc < width && grid[rr][cc] !== null) return false
    }
    return true
  }
  const place = (r, c) => {
    grid[r][c] = burrows.length
    burrows.push([r, c])
  }
  place(Math.floor(rand() * height), Math.floor(rand() * width))
  for (let attempt = 0; attempt < 2000 && burrows.length < count; attempt++) {
    const from = Math.floor(rand() * burrows.length)
    const [dr, dc] = pick(Object.values(DIRECTIONS))
    const [r0, c0] = burrows[from]
    const max = Math.max(width, height)
    const length = 2 + Math.floor(rand() * (max - 2))
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
    bridges.set(`${from}-${burrows.length - 1}`, rand() < 0.4 ? 2 : 1)
  }
  if (burrows.length < count) return null
  // A few extra paths between burrows that already see each other make loops.
  const level = { width, height, burrows: burrows.map(([r, c]) => [r, c, 0]) }
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

// Grandma lives in the busiest burrow nearest the middle, so carrots spread out from her.
function chooseSource(level) {
  let best = 0
  let bestScore = -Infinity
  level.burrows.forEach(([r, c, v], i) => {
    const score = v * 2 - Math.hypot(r - (level.height - 1) / 2, c - (level.width - 1) / 2) * 0.6
    if (score > bestScore) { bestScore = score; best = i }
  })
  return best
}

function difficulty(used, level) {
  return used.capacity * 1 + used.isolation * 4 + used.trial * 12 + level.burrows.length * 2
}

function candidate(plan) {
  const rejected = { grow: 0, unsolved: 0, technique: 0, unique: 0 }
  for (let attempt = 1; ; attempt++) {
    if (attempt % 5000 === 0) console.error('still looking', JSON.stringify(plan), JSON.stringify(rejected))
    const level = grow(plan)
    if (!level) { rejected.grow++; continue }
    const board = buildBoard(level)
    const player = playerSolve(board)
    if (!player.solved) { rejected.unsolved++; continue }
    if ((!plan.trial && player.used.trial) || (!plan.isolation && player.used.isolation)) { rejected.technique++; continue }
    const solutions = solve(board, { limit: 2 })
    if (solutions.length !== 1) { rejected.unique++; continue }
    return { level, solution: solutions[0], score: difficulty(player.used, level), used: player.used }
  }
}

const levels = []
let previous = 0
PLAN.forEach((plan, index) => {
  const pool = Array.from({ length: Number(args.pool ?? 40) }, () => candidate(plan)).sort((a, b) => a.score - b.score)
  // The easiest one that is still harder than the level before, near the pool's middle.
  const harder = pool.filter((p) => p.score > previous)
  const chosen = harder[Math.min(harder.length - 1, Math.floor(harder.length * 0.25))] ?? pool[pool.length - 1]
  previous = chosen.score
  const source = chooseSource(chosen.level)
  levels.push({
    id: `burrow-${String(index + 1).padStart(2, '0')}`,
    name: NAMES[index],
    width: chosen.level.width,
    height: chosen.level.height,
    source,
    burrows: chosen.level.burrows,
    solution: chosen.solution,
  })
  console.log(`${index + 1}`.padStart(2), NAMES[index].padEnd(20), `${plan.width}x${plan.height}`, `${chosen.level.burrows.length} burrows`, `score ${chosen.score}`, JSON.stringify(chosen.used))
})

const body = `// Generated by scripts/generate-levels.mjs. Regenerate with \`npm run generate:levels\`.
// Each burrow is [row, column, baskets]; solution lists the paths per possible path, in board order.
export const LEVELS = [
${levels.map((l) => `  { id: '${l.id}', name: ${JSON.stringify(l.name)}, width: ${l.width}, height: ${l.height}, source: ${l.source},\n    burrows: ${JSON.stringify(l.burrows)},\n    solution: ${JSON.stringify(l.solution)} },`).join('\n')}
]
`
if (args.output) writeFileSync(args.output, body)
else process.stdout.write(body)

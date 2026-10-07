// Builds Hamster Hideaway's daily puzzles into src/days.js: every day has one
// easy, one medium and one hard habitat.
//
// Each puzzle starts as a finished habitat: every cell tube, then bedding is
// carved out of 2×2 blocks of tube until none is left, keeping the tubes in one
// piece and every room within its tier's size. Each room gets its number in one
// of its cells, and the puzzle is kept only if it has exactly one solution and a
// player can solve it by always taking the easiest step, with no more guesswork
// than its difficulty allows. Every puzzle is seeded by its day and difficulty,
// so adding more days never changes the ones already played.
//
//   node scripts/generate-levels.mjs --days=400 --output=src/days.js
import { writeFileSync } from 'node:fs'
import { buildBoard, solve, playerSolve } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const DAYS = Number(args.days ?? 400)
const FIRST_DAY = '2026-10-07'
let seed = 1
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const shuffle = (list) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// What each difficulty looks like. `bedding` is roughly how much of the habitat
// is rooms; `allows` says how much supposing it may take to solve.
export const TIERS = {
  easy: {
    size: () => (rand() < 0.5 ? [5, 5] : [6, 6]),
    biggest: 4,
    bedding: 0.4,
    allows: (used) => used.trial === 0,
  },
  medium: {
    size: () => (rand() < 0.5 ? [6, 7] : [7, 7]),
    biggest: 5,
    bedding: 0.42,
    allows: (used) => used.trial >= 1 && used.trial <= 4,
  },
  hard: {
    size: () => (rand() < 0.5 ? [7, 8] : [8, 9]),
    biggest: 5,
    bedding: 0.42,
    allows: (used) => used.trial >= 5 && used.trial <= 18,
  },
}

// A finished habitat: 1 for tube, 0 for bedding.
export function carve(width, height, biggest, bedding) {
  const size = width * height
  const g = new Uint8Array(size).fill(1)
  const nb = (i) => {
    const r = Math.floor(i / width), c = i % width, out = []
    if (r > 0) out.push(i - width)
    if (c > 0) out.push(i - 1)
    if (c < width - 1) out.push(i + 1)
    if (r < height - 1) out.push(i + width)
    return out
  }
  // the room a cell would join, and its size, if it became bedding
  const joined = (i) => {
    const seen = new Set([i])
    const stack = [i]
    while (stack.length) {
      const c = stack.pop()
      for (const j of nb(c)) if (!g[j] && !seen.has(j)) { seen.add(j); stack.push(j) }
    }
    return seen.size
  }
  const tubesStayJoined = (i) => {
    g[i] = 0
    let start = -1, total = 0
    for (let k = 0; k < size; k++) if (g[k]) { total++; if (start < 0) start = k }
    const seen = new Uint8Array(size)
    const stack = [start]
    seen[start] = 1
    let n = 1
    while (stack.length) {
      const c = stack.pop()
      for (const j of nb(c)) if (g[j] && !seen[j]) { seen[j] = 1; n++; stack.push(j) }
    }
    g[i] = 1
    return n === total
  }
  const carveOne = (cells) => {
    for (const i of shuffle(cells)) {
      if (!g[i] || joined(i) > biggest || !tubesStayJoined(i)) continue
      g[i] = 0
      return true
    }
    return false
  }
  // first break up every 2×2 block of tube
  for (;;) {
    const pools = []
    for (let r = 0; r < height - 1; r++) for (let c = 0; c < width - 1; c++) {
      const i = r * width + c
      if (g[i] && g[i + 1] && g[i + width] && g[i + width + 1]) pools.push([i, i + 1, i + width, i + width + 1])
    }
    if (!pools.length) break
    if (!carveOne(pools[Math.floor(rand() * pools.length)])) return null
  }
  // then grow the rooms a little until the habitat has its share of bedding
  let tries = 0
  while (g.filter((v) => !v).length < bedding * size && tries++ < size * 4) {
    const edge = []
    for (let i = 0; i < size; i++) if (g[i] && nb(i).some((j) => !g[j])) edge.push(i)
    carveOne([edge[Math.floor(rand() * edge.length)]])
  }
  return g
}

export function roomsOf(g, width, height) {
  const seen = new Uint8Array(g.length)
  const rooms = []
  for (let i = 0; i < g.length; i++) {
    if (g[i] || seen[i]) continue
    const cells = [i]
    seen[i] = 1
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k], r = Math.floor(c / width), col = c % width
      for (const j of [r > 0 && c - width, col > 0 && c - 1, col < width - 1 && c + 1, r < height - 1 && c + width]) {
        if (j !== false && !g[j] && !seen[j]) { seen[j] = 1; cells.push(j) }
      }
    }
    rooms.push(cells)
  }
  return rooms
}

// Tries a few ways of placing each room's number; returns the first that makes
// a fair puzzle for this tier.
function place(g, width, height, tier) {
  const rooms = roomsOf(g, width, height)
  // lonely little rooms of 1 are fine, but not too many of them
  if (rooms.filter((r) => r.length === 1).length > rooms.length / 3) return null
  for (let attempt = 0; attempt < 8; attempt++) {
    const level = { width, height, rooms: rooms.map((cells) => {
      const i = cells[Math.floor(rand() * cells.length)]
      return [Math.floor(i / width), i % width, cells.length]
    }) }
    const board = buildBoard(level)
    if (solve(board, { limit: 2 }).length !== 1) continue
    const player = playerSolve(board, { maxTrials: 30 })
    if (!player.solved || !tier.allows(player.used)) continue
    return { level, used: player.used }
  }
  return null
}

function candidate(name, day) {
  const tier = TIERS[name]
  seed = (day * 7919 + Object.keys(TIERS).indexOf(name) * 104729) % 2147483646 + 1
  for (let attempt = 1; ; attempt++) {
    if (attempt % 500 === 0) console.error('still looking', name, day, attempt)
    const [width, height] = tier.size()
    const g = carve(width, height, tier.biggest, tier.bedding)
    if (!g) continue
    const found = place(g, width, height, tier)
    if (found) return found
  }
}

// a puzzle packed into a short string: width and height, then three digits per
// room for its row, column and number
const pack = ({ width, height, rooms }) => `${width}${height}:${rooms.map(([r, c, v]) => `${r}${c}${v}`).join('')}`

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = []
  const started = Date.now()
  for (let day = 1; day <= DAYS; day++) {
    const puzzles = Object.keys(TIERS).map((name) => candidate(name, day))
    days.push(puzzles.map((p) => pack(p.level)))
    if (day % 20 === 0 || day === DAYS || day < 4) console.log('day', day, `${((Date.now() - started) / 1000).toFixed(0)}s`, puzzles.map((p) => `${p.level.width}x${p.level.height} ${p.level.rooms.length} rooms trial ${p.used.trial}`).join(' | '))
  }
  const body = `// Generated by scripts/generate-levels.mjs. Regenerate with \`npm run generate:levels\`.
// Day 1 is FIRST_DAY. Each day has an easy, a medium and a hard habitat, packed as
// "<width><height>:" followed by three digits per room: row, column and number.
export const FIRST_DAY = '${FIRST_DAY}'
export const DAYS = [
${days.map((d) => `  ${JSON.stringify(d)},`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, body)
  else process.stdout.write(body)
}

// Builds Tiny Isles' three pools of levels (easy, medium, hard) into src/levels.js.
//
// Each level grows a network bridge by bridge from one island, then keeps it only if
// it has exactly one solution and a player can solve it by always taking the easiest
// step, using only the techniques its pool allows. Every other level hides a few
// islands' numbers in fog: those are picked so the puzzle stays unique and solvable
// and gets harder. Within a pool the levels climb steadily.
import { writeFileSync } from 'node:fs'
import { buildBoard, solve, playerSolve, DIRECTIONS } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
let seed = Number(args.seed ?? 20261005)
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const pick = (list) => list[Math.floor(rand() * list.length)]
const POOL = Number(args.pool ?? 10)

const NAMES = {
  easy: [
    'Pebble Bay', 'Seashell Cove', 'Driftwood Key', 'Sandy Hollow', 'Tidepool Point', 'Starfish Shoals', 'Gull Rock', 'Coral Nook',
    'Kelp Harbor', 'Sunny Sands', 'Lantern Isle', 'Breezy Banks', 'Puffin Perch', 'Clam Bake Cay', 'Seaglass Shore', 'Minnow Bay',
    'Sailcloth Cove', 'Buoy Bend', 'Saltwater Steps', 'Pelican Pier',
  ],
  medium: [
    'Lagoon Loop', 'Harbor Lights', 'Fisher’s Wharf', 'Mariner’s Rest', 'Compass Rose', 'Anchor Heights', 'Ferry Crossing', 'Bellbuoy Bay',
    'Market Quay', 'Marina Gardens', 'Clocktower Cay', 'Canal Quarter', 'Seawall Square', 'Lighthouse Row', 'Palm Promenade', 'Old Port',
    'Boardwalk Bay', 'Riviera Rise', 'Tidegate Town', 'Halfmoon Harbor',
  ],
  hard: [
    'Skyline Shoals', 'Glasswater City', 'Tower Atoll', 'Monorail Keys', 'Neon Waterfront', 'Aurora Archipelago', 'Silver Spires', 'Highrise Harbor',
    'Crystal Lagoon', 'Starlight Strait', 'Metro Marina', 'Pearl Skyline', 'Horizon Heights', 'Orbit Isles', 'Zenith Bay', 'Prism Port',
    'Cloudpiercer Cay', 'Golden Gateway', 'Opal Metropolis', 'Sapphire Metropolis',
  ],
}

// The board size and island count climb through each pool; `fog` is how many
// islands hide their numbers on the fog levels.
const TIERS = {
  easy: {
    sizes: (k) => (k < 8 ? [5, 5, 4 + Math.floor(k / 2)] : [6, 6, 6 + Math.floor((k - 8) / 3)]),
    fog: (k) => (k < 10 ? 1 : 2),
    allows: (used) => !used.isolation && !used.trial,
  },
  medium: {
    sizes: (k) => (k < 6 ? [6, 6, 8 + Math.floor(k / 3)] : [7, 7, 9 + Math.floor((k - 6) / 3)]),
    fog: (k) => (k < 10 ? 2 : 3),
    allows: (used) => used.trial <= 2 && used.isolation + used.trial >= 1,
  },
  hard: {
    sizes: (k) => (k < 10 ? [7, 8, 12 + Math.floor(k / 3)] : [8, 9, 14 + Math.floor((k - 10) / 3)]),
    fog: (k) => (k < 10 ? 3 : 4),
    allows: (used) => used.trial >= 2,
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

function candidate(name, k, foggy) {
  const tier = TIERS[name]
  const [width, height, count] = tier.sizes(k)
  for (let attempt = 1; ; attempt++) {
    if (attempt % 3000 === 0) console.error('still looking', name, k + 1, foggy ? 'fog' : '')
    const level = grow({ width, height, count })
    if (!level) continue
    if (!foggy) {
      const rated = rate(level, tier)
      if (rated) return rated
      continue
    }
    // a fog level starts from a puzzle that is fair even before the fog, so the
    // fog is what makes it harder
    const plain = rate(level, { allows: (used) => name === 'easy' ? tier.allows(used) : name === 'medium' ? used.trial <= 2 : true })
    if (!plain) continue
    const fogged = addFog(plain, tier, tier.fog(k))
    if (fogged) return fogged
  }
}

const pools = {}
for (const name of Object.keys(TIERS)) {
  pools[name] = []
  // plain and fog levels each climb on their own
  const previous = [0, 0]
  for (let k = 0; k < 20; k++) {
    // every other level is a fog level, starting with the second
    const foggy = k % 2 === 1
    const pool = Array.from({ length: POOL }, () => candidate(name, k, foggy)).sort((a, b) => a.score - b.score)
    const harder = pool.filter((p) => p.score > previous[+foggy])
    const chosen = harder[Math.min(harder.length - 1, Math.floor(harder.length * 0.3))] ?? pool[pool.length - 1]
    previous[+foggy] = chosen.score
    pools[name].push({
      id: `${name}-${String(k + 1).padStart(2, '0')}`,
      name: NAMES[name][k],
      width: chosen.level.width,
      height: chosen.level.height,
      burrows: chosen.level.burrows,
      solution: chosen.solution,
    })
    console.log(name.padEnd(6), `${k + 1}`.padStart(2), NAMES[name][k].padEnd(22), `${chosen.level.width}x${chosen.level.height}`, `${chosen.level.burrows.length} isles`, `${chosen.level.burrows.filter((b) => b[3]).length} fog`, `score ${chosen.score}`, JSON.stringify(chosen.used))
  }
}

const list = (levels) => levels.map((l) => `    { id: '${l.id}', name: ${JSON.stringify(l.name)}, width: ${l.width}, height: ${l.height},\n      burrows: ${JSON.stringify(l.burrows)},\n      solution: ${JSON.stringify(l.solution)} },`).join('\n')
const body = `// Generated by scripts/generate-levels.mjs. Regenerate with \`npm run generate:levels\`.
// Each island is [row, column, bridges] or [row, column, bridges, 1] when its number
// is hidden in fog; solution lists the bridges on every possible crossing, in board order.
export const POOLS = {
${Object.entries(pools).map(([name, levels]) => `  ${name}: [\n${list(levels)}\n  ],`).join('\n')}
}
`
if (args.output) writeFileSync(args.output, body)
else process.stdout.write(body)

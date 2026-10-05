// Builds Flower Patch's three pools of levels (easy, medium, hard) into src/levels.js.
//
// Each level splits a grid into beds of one to six cells, fills it with seeds that
// follow the rules, then takes seeds away one at a time, in random order, keeping
// each removal only while the garden still has exactly one solution and a player
// can solve it with the techniques its pool allows. A level is kept only if it
// needs what its pool asks for. Within a pool the levels climb steadily.
import { writeFileSync } from 'node:fs'
import { buildBoard, countSolutions, playerSolve, MAX_SEED } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
let seed = Number(args.seed ?? 20261005)
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const shuffle = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]] } return list }
const POOL = Number(args.pool ?? 20)
const TRIES = Number(args.tries ?? 6)

const NAMES = {
  easy: [
    'Seedling Row', 'Buttercup Bed', 'Snail Shell Plot', 'Morning Dew', 'Robin’s Corner', 'Pebble Path', 'Watering Can', 'Bumblebee Bend',
    'Clover Patch', 'Sunny Sill', 'Ladybird Lane', 'Puddle Nook', 'Trowel Turn', 'Wormery Way', 'Sprout Square', 'Picket Fence',
    'Garden Gate', 'Teacup Terrace', 'Mossy Step', 'Daisy Chain',
  ],
  medium: [
    'Cottage Border', 'Hollyhock Walk', 'Potting Shed', 'Birdbath Bower', 'Primrose Path', 'Wicker Arch', 'Herb Spiral', 'Rain Barrel',
    'Orchard Edge', 'Kitchen Garden', 'Sundial Lawn', 'Greenhouse Row', 'Beehive Bank', 'Trellis Corner', 'Lily Pond', 'Willow Gate',
    'Allotment', 'Hedge Maze', 'Lantern Walk', 'Midsummer Meadow',
  ],
  hard: [
    'Botanical Court', 'Walled Garden', 'Glasshouse Dome', 'Knot Garden', 'Topiary Terrace', 'Rose Pavilion', 'Moonlight Border', 'Grand Parterre',
    'Fountain Square', 'Secret Garden', 'Wisteria Cloister', 'Orangery', 'Labyrinth Lawn', 'Peacock Promenade', 'Starlit Arbor', 'Royal Conservatory',
    'Tapestry Beds', 'Mosaic Gardens', 'Kaleidoscope Court', 'Eden',
  ],
}

// Board sizes climb through each pool. `allow` is what the player may need, and
// `needs` what the level must make them use; `sizes` weights bed sizes 1 to 6.
const TIERS = {
  easy: {
    shape: (k) => (k < 7 ? [5, 5] : k < 14 ? [5, 6] : [6, 6]),
    allow: ['single', 'hidden'],
    needs: (used, k) => used.hidden >= (k < 7 ? 1 : 3),
    sizes: [0.5, 1, 2.2, 3, 3, 1.6],
  },
  medium: {
    shape: (k) => (k < 7 ? [6, 6] : k < 14 ? [6, 7] : [7, 7]),
    allow: ['single', 'hidden', 'reach', 'subset'],
    needs: (used, k) => used.reach + used.subset >= (k < 10 ? 2 : 4),
    sizes: [0.3, 0.7, 1.6, 2.6, 3.2, 2.6],
  },
  hard: {
    shape: (k) => (k < 7 ? [7, 7] : k < 14 ? [7, 8] : [8, 8]),
    allow: ['single', 'hidden', 'reach', 'subset', 'trial'],
    needs: (used, k) => used.trial >= (k < 10 ? 1 : 2),
    sizes: [0.25, 0.6, 1.4, 2.4, 3.2, 3],
  },
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// Grows beds from random cells until the grid is covered. Leftover single cells
// join a neighbouring bed when one has room; at most one stays a lone bed.
function partition(width, height, weights) {
  const cells = width * height
  const bed = new Int16Array(cells).fill(-1)
  const sizes = []
  const side = (i) => {
    const r = Math.floor(i / width), c = i % width
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < height && x >= 0 && x < width).map(([y, x]) => y * width + x)
  }
  const target = () => {
    const total = weights.reduce((a, b) => a + b, 0)
    let t = rand() * total
    for (let n = 0; n < weights.length; n++) if ((t -= weights[n]) < 0) return n + 1
    return MAX_SEED
  }
  for (const start of shuffle([...Array(cells).keys()])) {
    if (bed[start] >= 0) continue
    const id = sizes.length
    const want = target()
    const members = [start]
    bed[start] = id
    while (members.length < want) {
      const edge = shuffle(members.flatMap(side).filter((j) => bed[j] < 0))
      if (!edge.length) break
      bed[edge[0]] = id
      members.push(edge[0])
    }
    sizes.push(members.length)
  }
  // fold lone cells into a neighbour with room, smallest first
  for (let i = 0; i < cells; i++) {
    if (sizes[bed[i]] !== 1) continue
    const host = side(i).map((j) => bed[j]).filter((b) => sizes[b] < MAX_SEED).sort((a, b) => sizes[a] - sizes[b])[0]
    if (host === undefined) continue
    sizes[bed[i]] = 0
    bed[i] = host
    sizes[host]++
  }
  if (sizes.filter((n) => n === 1).length > 1) return null
  // renumber in reading order
  const names = new Map()
  const rows = []
  for (let r = 0; r < height; r++) {
    let row = ''
    for (let c = 0; c < width; c++) {
      const b = bed[r * width + c]
      if (!names.has(b)) names.set(b, LETTERS[names.size])
      row += names.get(b)
    }
    rows.push(row)
  }
  return rows
}

// A random filling that follows the rules, or null if the search gives up.
function fill(board) {
  const vals = new Int8Array(board.cells)
  let budget = 40000
  const options = (i) => {
    const out = []
    for (let v = 1; v <= board.size[i]; v++) if (!board.peers[i].some((j) => vals[j] === v)) out.push(v)
    return out
  }
  const search = () => {
    if (--budget < 0) return false
    let best = -1, bestOptions = null
    for (let i = 0; i < board.cells; i++) {
      if (vals[i]) continue
      const o = options(i)
      if (!o.length) return false
      if (!bestOptions || o.length < bestOptions.length) { best = i; bestOptions = o; if (o.length === 1) break }
    }
    if (best < 0) return true
    for (const v of shuffle(bestOptions)) {
      vals[best] = v
      if (search()) return true
    }
    vals[best] = 0
    return false
  }
  return search() ? vals : null
}

const toRows = (vals, width) => {
  const rows = []
  for (let i = 0; i < vals.length; i += width) rows.push([...vals.slice(i, i + width)].map((v) => (v ? String(v) : '.')).join(''))
  return rows
}

// How hard a level plays: harder techniques count for more, and fewer starting
// seeds make for longer solves.
export const WEIGHT = { single: 1, hidden: 1.6, reach: 4, subset: 5, trial: 14 }
const difficulty = (used, cells, givens) => Object.entries(used).reduce((a, [t, n]) => a + WEIGHT[t] * n, 0) / cells + (1 - givens / cells) * 2

function attempt(pool, k) {
  const tier = TIERS[pool]
  const [height, width] = tier.shape(k)
  const beds = partition(width, height, tier.sizes)
  if (!beds) return null
  const board = buildBoard({ width, height, beds })
  const solution = fill(board)
  if (!solution) return null
  const givens = Int8Array.from(solution)
  for (const i of shuffle([...Array(board.cells).keys()])) {
    const v = givens[i]
    givens[i] = 0
    if (countSolutions(board, givens) !== 1 || !playerSolve(board, givens, tier.allow).solved) givens[i] = v
  }
  const { used } = playerSolve(board, givens, tier.allow)
  // the level must not be solvable with the easier pool's techniques
  if (!tier.needs(used, k)) return null
  const count = givens.filter((v) => v).length
  return { width, height, beds, givens: toRows(givens, width), solution: toRows(solution, width), used, score: difficulty(used, board.cells, count) }
}

function make(pool) {
  const levels = []
  for (let k = 0; k < POOL; k++) {
    const found = []
    for (let tries = 0; found.length < TRIES && tries < 4000; tries++) {
      const level = attempt(pool, k)
      if (level) found.push(level)
    }
    if (!found.length) throw new Error(`could not make ${pool} ${k + 1}`)
    // later levels in a pool take the harder of the candidates
    found.sort((a, b) => a.score - b.score)
    levels.push(found[Math.min(found.length - 1, Math.floor((k / POOL) * found.length + found.length / 3))])
    process.stderr.write(`${pool} ${k + 1}: ${levels.at(-1).height}x${levels.at(-1).width} ${JSON.stringify(levels.at(-1).used)}\n`)
  }
  // climb steadily within each board size
  return levels
    .map((level, k) => ({ level, k }))
    .sort((a, b) => a.level.width * a.level.height - b.level.width * b.level.height || a.level.score - b.level.score || a.k - b.k)
    .map(({ level }, k) => ({ id: `${pool}-${String(k + 1).padStart(2, '0')}`, name: NAMES[pool][k], ...level }))
}

const pools = Object.fromEntries(Object.keys(TIERS).map((pool) => [pool, make(pool)]))

const out = [
  '// Generated by scripts/generate-levels.mjs. Regenerate with `npm run generate:levels`.',
  '// beds names each cell\'s bed with a letter; givens and solution hold seeds, with',
  '// \'.\' for a cell the player plants.',
  'export const POOLS = {',
]
for (const [pool, levels] of Object.entries(pools)) {
  out.push(`  ${pool}: [`)
  for (const l of levels) {
    out.push(`    { id: '${l.id}', name: ${JSON.stringify(l.name)}, width: ${l.width}, height: ${l.height},`)
    out.push(`      beds: ${JSON.stringify(l.beds)},`)
    out.push(`      givens: ${JSON.stringify(l.givens)},`)
    out.push(`      solution: ${JSON.stringify(l.solution)} },`)
  }
  out.push('  ],')
}
out.push('}', '')
if (args.output) writeFileSync(args.output, out.join('\n'))
else process.stdout.write(out.join('\n'))

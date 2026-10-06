// Builds Flower Patch's daily gardens into src/days.js: every day has an easy, a
// medium and a hard garden, and every earlier day stays open to play.
//
// Each garden splits a grid into beds of one to six cells, fills it with seeds
// that follow the rules, then takes seeds away one at a time, in random order,
// keeping each removal only while the garden still has exactly one solution and a
// player can solve it with the techniques its difficulty allows. A garden is kept
// only if it needs what its difficulty asks for. Every garden is seeded by its day
// and difficulty, so adding more days never changes the ones already played.
//
//   node scripts/generate-levels.mjs --days=400 --output=src/days.js
//   (or --tier=easy --json=out.json to build one difficulty, and --merge=a,b,c
//   --output=src/days.js to put the three together; see npm run generate:levels)
//
//   node scripts/generate-levels.mjs --tutorial
//   prints a fresh garden for the tutorial (TUTORIAL in src/puzzles.js): 5×5 and
//   easy, where the coach finds every lesson in order without a gap, its first a
//   bed of two or three with one plot left, and unlike any daily garden.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildBoard, countSolutions, playerSolve, MAX_SEED } from '../src/logic.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const DAYS = Number(args.days ?? 400)
let seed = 1
const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const shuffle = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]] } return list }
const pick = (list) => list[Math.floor(rand() * list.length)]

// What each difficulty looks like every day: the size of the garden, what the
// player may need (`allow`), what the garden must make them use (`needs`), and
// how bed sizes 1 to 6 are weighted.
const TIERS = {
  easy: {
    shape: () => pick([[5, 5], [5, 6], [6, 6]]),
    allow: ['single', 'hidden'],
    needs: (used) => used.hidden >= 2,
    sizes: [0.5, 1, 2.2, 3, 3, 1.6],
  },
  medium: {
    shape: () => pick([[6, 6], [6, 7], [7, 7]]),
    allow: ['single', 'hidden', 'reach', 'subset'],
    needs: (used) => used.reach + used.subset >= 3,
    sizes: [0.3, 0.7, 1.6, 2.6, 3.2, 2.6],
  },
  hard: {
    shape: () => pick([[7, 7], [7, 8], [8, 8]]),
    allow: ['single', 'hidden', 'reach', 'subset', 'trial'],
    needs: (used) => used.trial >= 1,
    sizes: [0.25, 0.6, 1.4, 2.4, 3.2, 3],
  },
}
const ORDER = Object.keys(TIERS)

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

function attempt(tier) {
  const t = TIERS[tier]
  const [height, width] = t.shape()
  const beds = partition(width, height, t.sizes)
  if (!beds) return null
  const board = buildBoard({ width, height, beds })
  const solution = fill(board)
  if (!solution) return null
  const givens = Int8Array.from(solution)
  for (const i of shuffle([...Array(board.cells).keys()])) {
    const v = givens[i]
    givens[i] = 0
    if (countSolutions(board, givens) !== 1 || !playerSolve(board, givens, t.allow).solved) givens[i] = v
  }
  const { used } = playerSolve(board, givens, t.allow)
  if (!t.needs(used)) return null
  return { width, height, beds, givens: toRows(givens, width), solution: toRows(solution, width) }
}

// One garden for a day and difficulty, always the same for the same pair.
function garden(day, tier) {
  seed = ((day * 7919 + ORDER.indexOf(tier) * 104729 + 12345) % 2147483646) + 1
  for (let tries = 0; tries < 20000; tries++) {
    const level = attempt(tier)
    if (level) return level
  }
  throw new Error(`could not make day ${day} ${tier}`)
}

// Packed as "<width><height>:<beds>:<givens>:<solution>", each a run of the rows.
const pack = (l) => `${l.width}${l.height}:${l.beds.join('')}:${l.givens.join('')}:${l.solution.join('')}`

function build(tier) {
  const out = []
  for (let day = 1; day <= DAYS; day++) {
    out.push(pack(garden(day, tier)))
    if (day % 25 === 0) process.stderr.write(`${tier} ${day}/${DAYS}\n`)
  }
  return out
}

// The tutorial's own garden. Every lesson must turn up in order as the player
// follows the coach, so it's tried by walking the coach through it.
async function tutorialGarden() {
  const { Tutorial } = await import('../src/tutorial.js')
  const { DAYS: daily } = await import('../src/days.js')
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } }
  const walks = (level) => {
    const board = buildBoard(level)
    const coach = new Tutorial(memory())
    coach.next()
    const values = Int8Array.from(board.givens), marks = new Uint8Array(board.cells)
    let play = { board, values, marks, seed: 1, marking: false, won: false }
    for (let k = 0; k < 20; k++) {
      const card = coach.card(play)
      if (card.step === 'outro') return true
      const m = coach.lesson
      if (card.step === 'putaway') { play = { ...play, marking: false }; continue }
      if (!m) return false
      if (card.step === 'bed' && !(m.last && m.size >= 2 && m.size <= 3)) return false
      if (card.step === 'flags') { for (const i of m.cells) marks[i] |= 1 << (m.value - 1); play = { ...play, marking: true } }
      else values[m.cell] = m.value
    }
    return false
  }
  const seen = new Set(daily.flat().map((p) => p.split(':')[1]))
  seed = 20261006
  const easy = TIERS.easy
  for (let tries = 0; tries < 200000; tries++) {
    const beds = partition(5, 5, easy.sizes)
    if (!beds || seen.has(beds.join(''))) continue
    const board = buildBoard({ width: 5, height: 5, beds })
    if (board.beds.length < 5 || board.beds.length > 7) continue
    const solution = fill(board)
    if (!solution) continue
    const givens = Int8Array.from(solution)
    for (const i of shuffle([...Array(board.cells).keys()])) {
      const v = givens[i]
      givens[i] = 0
      if (countSolutions(board, givens) !== 1 || !playerSolve(board, givens, easy.allow).solved) givens[i] = v
    }
    const level = { width: 5, height: 5, beds, givens: toRows(givens, 5), solution: toRows(solution, 5) }
    if (walks(level)) return level
  }
  throw new Error('no tutorial garden found')
}

function write(columns) {
  const lines = [
    '// Generated by scripts/generate-levels.mjs. Regenerate with `npm run generate:levels`.',
    '// Day 1 is FIRST_DAY. Each day has an easy, a medium and a hard garden, packed as',
    '// "<width><height>:<beds>:<givens>:<solution>", row after row: beds names each',
    '// cell\'s bed with a letter; givens and solution hold seeds, with \'.\' for a cell',
    '// the player plants.',
    "export const FIRST_DAY = '2026-09-16'",
    'export const DAYS = [',
  ]
  for (let d = 0; d < columns[0].length; d++) lines.push(`  ${JSON.stringify(columns.map((c) => c[d]))},`)
  lines.push(']', '')
  writeFileSync(args.output, lines.join('\n'))
}

if ('tutorial' in args) {
  const level = await tutorialGarden()
  console.log(JSON.stringify({ beds: level.beds, givens: level.givens, solution: level.solution }, null, 2))
} else if (args.merge) write(args.merge.split(',').map((f) => JSON.parse(readFileSync(f, 'utf8'))))
else if (args.tier) writeFileSync(args.json, JSON.stringify(build(args.tier)))
else write(ORDER.map(build))

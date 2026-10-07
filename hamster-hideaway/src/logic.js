// Hamster Hideaway is Nurikabe. Every number is one hamster's room, and the
// rest of the habitat is play tubes:
//
// - each room holds exactly its number of cells of bedding, with its number in it
// - rooms never touch side by side (hamsters live alone)
// - all the tubes join up into one network
// - tubes are one cell wide: no 2×2 block of tube anywhere
//
// A level is { width, height, rooms: [[row, column, number], ...] }. Cells are
// numbered row by row. The player marks each cell as bedding (the default), tube,
// or a seed (bedding they're sure of). The solver works on its own grid of
// unknown, tube and bedding cells.

export const BEDDING = 0
export const TUBE = 1
export const SEED = 2

// the solver's cell states
const UNKNOWN = 0
const BLACK = 1 // a tube
const WHITE = 2 // bedding

export function buildBoard(level) {
  const { width, height } = level
  const size = width * height
  const neighbors = []
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i / width), c = i % width
    const n = []
    if (r > 0) n.push(i - width)
    if (c > 0) n.push(i - 1)
    if (c < width - 1) n.push(i + 1)
    if (r < height - 1) n.push(i + width)
    neighbors.push(n)
  }
  // every 2×2 block, by its top-left cell
  const blocks = []
  for (let r = 0; r < height - 1; r++) for (let c = 0; c < width - 1; c++) {
    const i = r * width + c
    blocks.push([i, i + 1, i + width, i + width + 1])
  }
  const clueAt = new Int16Array(size).fill(-1)
  const clues = level.rooms.map(([row, column, value], index) => {
    const cell = row * width + column
    clueAt[cell] = index
    return { index, cell, row, column, value }
  })
  const white = clues.reduce((a, c) => a + c.value, 0)
  return { level, width, height, size, neighbors, blocks, clues, clueAt, white, black: size - white }
}

/* ---------- what the player sees ---------- */

// Groups the cells that `inside` accepts into connected pieces.
function pieces(board, inside) {
  const id = new Int32Array(board.size).fill(-1)
  const list = []
  for (let i = 0; i < board.size; i++) {
    if (id[i] !== -1 || !inside(i)) continue
    const cells = [i]
    id[i] = list.length
    for (let k = 0; k < cells.length; k++) {
      for (const j of board.neighbors[cells[k]]) if (id[j] === -1 && inside(j)) { id[j] = list.length; cells.push(j) }
    }
    list.push(cells)
  }
  return { id, list }
}

// How the habitat stands. `cells` holds BEDDING, TUBE or SEED for every cell.
//   rooms     per number: { done, cells } (cells: the bedding walled in with it)
//   wide      the top-left cell of every 2×2 block of tube
//   crowded   numbers whose room is joined, through seeds, to another or has
//             more seeds than it needs
//   cramped   numbers walled into a space too small for them
//   stray     seeds walled in where no hamster can reach them
//   split     true when some tubes are walled off from the rest
//   complete  the habitat is solved
export function status(board, cells) {
  const tube = (i) => cells[i] === TUBE
  const open = pieces(board, (i) => !tube(i))
  const rooms = board.clues.map(() => ({ done: false, cells: [] }))
  const cramped = [], stray = [], crowded = new Set()
  let loose = false
  for (const piece of open.list) {
    const here = piece.filter((i) => board.clueAt[i] !== -1).map((i) => board.clueAt[i])
    if (here.length === 1) {
      const clue = board.clues[here[0]]
      rooms[clue.index].cells = piece
      if (piece.length === clue.value) rooms[clue.index].done = true
      else if (piece.length < clue.value) cramped.push(clue.index)
    }
    if (!here.length) {
      loose = true
      for (const i of piece) if (cells[i] === SEED) stray.push(i)
    }
    if (here.length > 1) loose = true
  }
  // seeds and numbers that are certainly one room
  const sure = pieces(board, (i) => cells[i] === SEED || board.clueAt[i] !== -1)
  for (const piece of sure.list) {
    const here = piece.filter((i) => board.clueAt[i] !== -1).map((i) => board.clueAt[i])
    if (here.length > 1) here.forEach((k) => crowded.add(k))
    else if (here.length === 1 && piece.length > board.clues[here[0]].value) crowded.add(here[0])
  }
  const wide = board.blocks.filter((b) => b.every(tube)).map((b) => b[0])
  // tubes that can never meet up, even through cells not yet decided
  const reach = pieces(board, (i) => cells[i] === TUBE || (cells[i] === BEDDING && board.clueAt[i] === -1))
  const tubeGroups = new Set()
  for (let i = 0; i < board.size; i++) if (tube(i)) tubeGroups.add(reach.id[i])
  const split = tubeGroups.size > 1
  const tubes = pieces(board, tube)
  const complete = !wide.length && !loose && rooms.every((r) => r.done) && tubes.list.length <= 1
  return { rooms, wide, crowded: [...crowded], cramped, stray, split, complete }
}

/* ---------- the solver ---------- */

// Every white cell joined to a number belongs to that hamster's room. Returns
// null if two numbers meet or a room has outgrown its number.
function islandsOf(board, g) {
  const owner = new Int16Array(board.size).fill(-1)
  const islands = []
  for (const clue of board.clues) {
    if (owner[clue.cell] !== -1) return null
    owner[clue.cell] = clue.index
    const cells = [clue.cell]
    for (let k = 0; k < cells.length; k++) {
      for (const j of board.neighbors[cells[k]]) {
        if (g[j] !== WHITE || owner[j] !== -1) continue
        owner[j] = clue.index
        cells.push(j)
      }
    }
    if (cells.length > clue.value) return null
    islands.push({ clue, cells, left: clue.value - cells.length })
  }
  return { owner, islands }
}

// How far each room could still grow: cells within reach of a room that still
// needs that many more. Cells right beside another room are out of reach (they'd
// join the two). Returns, per cell, a bitmask of rooms (first 30) and a count.
function reachOf(board, g, owner, islands) {
  const near = new Int32Array(board.size)
  const count = new Uint8Array(board.size)
  const reachable = new Array(islands.length)
  const dist = new Int16Array(board.size)
  for (const is of islands) {
    if (!is.left) { reachable[is.clue.index] = 0; continue }
    const k = is.clue.index
    dist.fill(-1)
    const queue = []
    for (const c of is.cells) { dist[c] = 0; queue.push(c) }
    let n = 0
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q]
      if (dist[c] >= is.left) continue
      for (const j of board.neighbors[c]) {
        if (dist[j] !== -1 || g[j] === BLACK) continue
        if (owner[j] !== -1 && owner[j] !== k) continue
        if (board.neighbors[j].some((x) => owner[x] !== -1 && owner[x] !== k)) continue
        dist[j] = dist[c] + 1
        queue.push(j)
        n++
        if (count[j] < 255) count[j]++
        if (k < 30) near[j] |= 1 << k
      }
    }
    reachable[k] = n
  }
  return { near, count, reachable }
}

const RULES = ['between', 'complete', 'pool', 'unreachable', 'expand', 'escape', 'trial']

// One deduction using the basic rules, in order of how easy they are to spot.
// Returns { rule, cells, value } for the cells it decides, { contradiction }, or null.
function basicStep(board, g) {
  const a = islandsOf(board, g)
  if (!a) return { contradiction: true }
  const { owner, islands } = a
  let blacks = 0, whites = 0
  for (let i = 0; i < board.size; i++) { if (g[i] === BLACK) blacks++; else if (g[i] === WHITE) whites++ }
  if (blacks > board.black || whites > board.white) return { contradiction: true }
  // a 2×2 block of tube
  for (const b of board.blocks) if (b.every((i) => g[i] === BLACK)) return { contradiction: true }

  // a cell touching two different rooms must be tube
  const between = []
  const complete = []
  let completeRoom = -1
  for (let i = 0; i < board.size; i++) {
    if (g[i] !== UNKNOWN) continue
    let first = -1, two = false
    for (const j of board.neighbors[i]) {
      if (owner[j] === -1) continue
      if (first === -1) first = owner[j]
      else if (owner[j] !== first) two = true
    }
    if (two) between.push(i)
    else if (first !== -1 && !islands[first].left) {
      if (!complete.length) completeRoom = first
      complete.push(i)
    }
  }
  if (between.length) return { rule: 'between', cells: between, value: BLACK }
  // around a finished room is all tube
  if (complete.length) return { rule: 'complete', cells: complete, value: BLACK, room: completeRoom }
  // the last cell of a 2×2 that is three-quarters tube must be bedding
  for (const b of board.blocks) {
    let unknown = -1, black = 0
    for (const i of b) { if (g[i] === BLACK) black++; else if (g[i] === UNKNOWN) unknown = i }
    if (black === 3 && unknown !== -1) return { rule: 'pool', cells: [unknown], value: WHITE }
  }
  // cells no room can reach are tube
  const reach = reachOf(board, g, owner, islands)
  for (const is of islands) if (is.left && is.cells.length + reach.reachable[is.clue.index] < is.clue.value) return { contradiction: true }
  const unreachable = []
  for (let i = 0; i < board.size; i++) {
    if (reach.count[i] || owner[i] !== -1) continue
    if (g[i] === WHITE) return { contradiction: true }
    if (g[i] === UNKNOWN) unreachable.push(i)
  }
  if (unreachable.length) return { rule: 'unreachable', cells: unreachable, value: BLACK }
  // a room with only one way to grow grows that way
  for (const is of islands) {
    if (!is.left) continue
    const exits = new Set()
    for (const c of is.cells) for (const j of board.neighbors[c]) if (g[j] === UNKNOWN) exits.add(j)
    if (!exits.size) return { contradiction: true }
    if (exits.size === 1) return { rule: 'expand', cells: [...exits], value: WHITE, room: is.clue.index }
  }
  // tubes that must reach the rest but have only one way out go that way
  const tubes = pieces(board, (i) => g[i] === BLACK)
  for (const piece of tubes.list) {
    if (piece.length === board.black) continue
    const exits = new Set()
    for (const c of piece) for (const j of board.neighbors[c]) if (g[j] === UNKNOWN) exits.add(j)
    if (!exits.size) return { contradiction: true }
    if (exits.size === 1) return { rule: 'escape', cells: [...exits], value: BLACK }
  }
  // all tubes must still be able to meet through undecided cells
  if (tubes.list.length > 1) {
    const open = pieces(board, (i) => g[i] !== WHITE)
    const seen = new Set(tubes.list.map((p) => open.id[p[0]]))
    if (seen.size > 1) return { contradiction: true }
  }
  return null
}

// Applies basic steps until none is left. Returns false on a contradiction.
function settle(board, g, used) {
  for (;;) {
    const step = basicStep(board, g)
    if (!step) return true
    if (step.contradiction) return false
    for (const i of step.cells) g[i] = step.value
    if (used) used[step.rule]++
  }
}

const isSolved = (board, g) => {
  for (let i = 0; i < board.size; i++) if (g[i] === UNKNOWN) return false
  const a = islandsOf(board, g)
  if (!a || a.islands.some((is) => is.left)) return false
  for (let i = 0; i < board.size; i++) if (g[i] === WHITE && a.owner[i] === -1) return false
  if (board.blocks.some((b) => b.every((i) => g[i] === BLACK))) return false
  return pieces(board, (i) => g[i] === BLACK).list.length <= 1
}

function startGrid(board) {
  const g = new Int8Array(board.size)
  for (const c of board.clues) g[c.cell] = WHITE
  return g
}

// Finds up to `limit` solutions, as arrays of TUBE (1) and BEDDING (0).
export function solve(board, { limit = 2 } = {}) {
  const found = []
  const search = (g) => {
    if (found.length >= limit) return
    if (!settle(board, g)) return
    let pick = -1
    let best = Infinity
    for (let i = 0; i < board.size; i++) {
      if (g[i] !== UNKNOWN) continue
      // try cells beside bedding first: they settle the most
      const score = board.neighbors[i].some((j) => g[j] === WHITE) ? 0 : board.neighbors[i].some((j) => g[j] === BLACK) ? 1 : 2
      if (score < best) { best = score; pick = i; if (!score) break }
    }
    if (pick === -1) {
      if (isSolved(board, g)) found.push(Array.from(g, (v) => (v === BLACK ? TUBE : BEDDING)))
      return
    }
    for (const value of [WHITE, BLACK]) {
      const next = g.slice()
      next[pick] = value
      search(next)
    }
  }
  search(startGrid(board))
  return found
}

// Solves the way a person might: the basic rules for as long as they help, and
// when they run out, picks a cell, supposes it one way, and follows the basic
// rules until something breaks. Each supposition is counted as a trial; harder
// puzzles need more. Returns { solved, used } where used counts each rule.
export function playerSolve(board, { maxTrials = 40 } = {}) {
  const used = Object.fromEntries(RULES.map((r) => [r, 0]))
  const g = startGrid(board)
  for (;;) {
    if (!settle(board, g, used)) return { solved: false, used }
    if (!g.includes(UNKNOWN)) return { solved: isSolved(board, g), used, grid: g }
    if (used.trial >= maxTrials) return { solved: false, used }
    const step = trialStep(board, g)
    if (!step) return { solved: false, used }
    g[step.cell] = step.value
    used.trial++
  }
}

// A cell that one supposition settles: suppose it tube (or bedding) and follow
// the basic rules; if that breaks, it must be the other.
function trialStep(board, g) {
  const order = []
  for (let i = 0; i < board.size; i++) if (g[i] === UNKNOWN) order.push(i)
  // cells beside bedding are the natural ones to wonder about
  order.sort((a, b) => Number(!board.neighbors[a].some((j) => g[j] === WHITE)) - Number(!board.neighbors[b].some((j) => g[j] === WHITE)))
  for (const i of order) {
    for (const guess of [BLACK, WHITE]) {
      const t = g.slice()
      t[i] = guess
      if (!settle(board, t)) return { cell: i, value: guess === BLACK ? WHITE : BLACK }
    }
  }
  return null
}

// The next cell a stuck player could be sure of, given what they've marked so
// far (wrong marks are left out). Returns { cell, value: TUBE|SEED, rule } or null.
export function findHint(board, cells, solution) {
  const g = startGrid(board)
  for (let i = 0; i < board.size; i++) {
    if (board.clueAt[i] !== -1) continue
    if (cells[i] === TUBE && solution[i] === TUBE) g[i] = BLACK
    if (cells[i] === SEED && solution[i] === BEDDING) g[i] = WHITE
  }
  const step = basicStep(board, g)
  if (step && !step.contradiction) return { cell: step.cells[0], cells: step.cells, value: step.value === BLACK ? TUBE : SEED, rule: step.rule, room: step.room ?? -1 }
  const t = trialStep(board, g)
  if (t) return { cell: t.cell, cells: [t.cell], value: t.value === BLACK ? TUBE : SEED, rule: 'trial', room: -1 }
  return null
}

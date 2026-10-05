// Flower Patch's board model. A garden is a grid of cells split into beds (the
// regions of Tectonic, or Suguru). A bed of N cells holds one of each seed from
// 1 to N, and the same seed never grows in two cells that touch, not even
// corner to corner. Beds hold at most six cells, so every number is a dice face.
//
// This file holds the rules, a fast solution counter, and a solver that plays
// the way a person does, which the generator uses to grade levels.

export const MAX_SEED = 6

// Techniques from easiest to hardest. See playerSolve.
export const TECHNIQUES = ['single', 'hidden', 'reach', 'subset', 'trial']

const STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]

const digits = (rows) => Int8Array.from(rows.join(''), (ch) => (ch === '.' ? 0 : Number(ch)))
const bits = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n }
const lowest = (m) => 31 - Math.clz32(m & -m)

// A level is { width, height, beds, givens, solution }, each of the last three a
// list of row strings: beds letters name the bed of each cell, and givens and
// solution hold seeds, with '.' for an empty cell.
export function buildBoard(level) {
  const { width, height } = level
  const cells = width * height
  const letters = level.beds.join('')
  const ids = new Map()
  const bedOf = new Int16Array(cells)
  for (let i = 0; i < cells; i++) {
    if (!ids.has(letters[i])) ids.set(letters[i], ids.size)
    bedOf[i] = ids.get(letters[i])
  }
  const beds = Array.from({ length: ids.size }, () => [])
  for (let i = 0; i < cells; i++) beds[bedOf[i]].push(i)
  const around = Array.from({ length: cells }, (_, i) => {
    const r = Math.floor(i / width), c = i % width
    return STEPS.filter(([dr, dc]) => r + dr >= 0 && r + dr < height && c + dc >= 0 && c + dc < width).map(([dr, dc]) => (r + dr) * width + c + dc)
  })
  // every cell a cell can't share a seed with: its bed and the eight around it
  const peers = Array.from({ length: cells }, (_, i) => [...new Set([...beds[bedOf[i]], ...around[i]])].filter((j) => j !== i))
  return {
    level,
    width,
    height,
    cells,
    bedOf,
    beds,
    size: Int8Array.from(bedOf, (b) => beds[b].length),
    around,
    peers,
    givens: level.givens ? digits(level.givens) : new Int8Array(cells),
    solution: level.solution ? digits(level.solution) : null,
  }
}

// The cells breaking a rule: a seed bigger than its bed, a seed twice in a bed,
// or the same seed in two touching cells.
export function conflicts(board, values) {
  const bad = new Set()
  for (let i = 0; i < board.cells; i++) {
    const v = values[i]
    if (!v) continue
    if (v > board.size[i]) bad.add(i)
    for (const j of board.peers[i]) if (values[j] === v) { bad.add(i); bad.add(j) }
  }
  return bad
}

// A bed is complete when every cell holds a seed and none of them breaks a rule,
// so it holds exactly 1 to N.
export function bedComplete(board, values, bed, bad = conflicts(board, values)) {
  return board.beds[bed].every((i) => values[i] && !bad.has(i))
}

export function isSolved(board, values) {
  for (let i = 0; i < board.cells; i++) if (!values[i]) return false
  return conflicts(board, values).size === 0
}

// Counts solutions up to `limit`, always branching on the cell with the fewest options.
export function countSolutions(board, givens = board.givens, limit = 2) {
  const vals = Int8Array.from(givens)
  const full = Int32Array.from(board.size, (n) => ((1 << (n + 1)) - 2))
  for (let i = 0; i < board.cells; i++) {
    const v = vals[i]
    if (!v) continue
    if (v > board.size[i]) return 0
    for (const j of board.peers[i]) if (vals[j] === v) return 0
  }
  const options = (i) => {
    let m = full[i]
    for (const j of board.peers[i]) if (vals[j]) m &= ~(1 << vals[j])
    return m
  }
  let found = 0
  const search = () => {
    let best = -1, bestMask = 0, bestCount = 99
    for (let i = 0; i < board.cells; i++) {
      if (vals[i]) continue
      const m = options(i)
      const n = bits(m)
      if (!n) return
      if (n < bestCount) { best = i; bestMask = m; bestCount = n; if (n === 1) break }
    }
    if (best < 0) { found++; return }
    for (let m = bestMask; m && found < limit; m &= m - 1) {
      vals[best] = lowest(m)
      search()
    }
    vals[best] = 0
  }
  search()
  return found
}

/* ---------- solving like a person ---------- */

// The solver keeps a set of possible seeds for every cell and takes the easiest
// step it can find, over and over:
//   single  a cell has one seed left
//   hidden  a seed has one cell left in its bed
//   reach   every cell of a bed that could take a seed touches some cell
//           outside the bed, so that cell can't take it
//   subset  two or three cells of a bed share just two or three seeds, so the
//           rest of the bed can't take those
//   trial   try a seed in a cell and follow the steps above; if the garden
//           breaks, that seed can't go there
class State {
  constructor(board, givens) {
    this.board = board
    this.vals = new Int8Array(board.cells)
    this.cand = Int32Array.from(board.size, (n) => ((1 << (n + 1)) - 2))
    this.broken = false
    for (let i = 0; i < board.cells; i++) if (givens[i]) this.place(i, givens[i])
  }

  clone() {
    const s = Object.create(State.prototype)
    s.board = this.board
    s.vals = Int8Array.from(this.vals)
    s.cand = Int32Array.from(this.cand)
    s.broken = this.broken
    return s
  }

  place(i, v) {
    if (!(this.cand[i] & (1 << v))) { this.broken = true; return }
    this.vals[i] = v
    this.cand[i] = 1 << v
    for (const j of this.board.peers[i]) {
      if (this.vals[j]) { if (this.vals[j] === v) this.broken = true; continue }
      this.cand[j] &= ~(1 << v)
      if (!this.cand[j]) this.broken = true
    }
  }

  eliminate(i, v) {
    this.cand[i] &= ~(1 << v)
    if (!this.cand[i]) this.broken = true
  }

  done() { return this.vals.every((v) => v) }

  // a bed still needs some seed that no open cell in it can take
  stuck() {
    const { board } = this
    for (const bed of board.beds) {
      let need = (1 << (bed.length + 1)) - 2, can = 0
      for (const i of bed) { if (this.vals[i]) need &= ~(1 << this.vals[i]); else can |= this.cand[i] }
      if (need & ~can) return true
    }
    return false
  }
}

function single(s) {
  for (let i = 0; i < s.board.cells; i++) {
    if (!s.vals[i] && bits(s.cand[i]) === 1) { s.place(i, lowest(s.cand[i])); return { cell: i } }
  }
  return null
}

function hidden(s) {
  const { board } = s
  for (const bed of board.beds) {
    for (let v = 1; v <= bed.length; v++) {
      if (bed.some((i) => s.vals[i] === v)) continue
      const spots = bed.filter((i) => !s.vals[i] && s.cand[i] & (1 << v))
      if (spots.length === 1) { s.place(spots[0], v); return { cell: spots[0] } }
    }
  }
  return null
}

function reach(s) {
  const { board } = s
  let changed = 0
  board.beds.forEach((bed, b) => {
    for (let v = 1; v <= bed.length; v++) {
      if (bed.some((i) => s.vals[i] === v)) continue
      const spots = bed.filter((i) => !s.vals[i] && s.cand[i] & (1 << v))
      if (!spots.length) continue
      for (const x of board.around[spots[0]]) {
        if (board.bedOf[x] === b || s.vals[x] || !(s.cand[x] & (1 << v))) continue
        if (spots.every((i) => board.around[i].includes(x))) { s.eliminate(x, v); changed++ }
      }
    }
  })
  return changed ? { eliminated: changed } : null
}

function subset(s) {
  const { board } = s
  let changed = 0
  for (const bed of board.beds) {
    const open = bed.filter((i) => !s.vals[i])
    if (open.length < 3) continue
    const groups = []
    for (let a = 0; a < open.length; a++) for (let b = a + 1; b < open.length; b++) {
      groups.push([open[a], open[b]])
      for (let c = b + 1; c < open.length; c++) groups.push([open[a], open[b], open[c]])
    }
    for (const group of groups) {
      if (group.length >= open.length) continue
      const union = group.reduce((m, i) => m | s.cand[i], 0)
      if (bits(union) !== group.length) continue
      for (const i of open) {
        if (group.includes(i) || !(s.cand[i] & union)) continue
        s.cand[i] &= ~union
        if (!s.cand[i]) s.broken = true
        changed++
      }
    }
    if (changed) return { eliminated: changed }
  }
  return null
}

const SIMPLE = { single, hidden, reach, subset }

// Follow the simple steps until the garden is done, stuck, or broken.
function propagate(s, allow) {
  for (;;) {
    if (s.broken || s.stuck()) { s.broken = true; return s }
    if (s.done()) return s
    let moved = false
    for (const name of ['single', 'hidden', 'reach', 'subset']) {
      if (!allow.has(name)) continue
      if (SIMPLE[name](s)) { moved = true; break }
    }
    if (!moved) return s
  }
}

function trial(s, allow) {
  const { board } = s
  const order = []
  for (let i = 0; i < board.cells; i++) if (!s.vals[i]) order.push(i)
  order.sort((a, b) => bits(s.cand[a]) - bits(s.cand[b]))
  for (const i of order) {
    for (let m = s.cand[i]; m; m &= m - 1) {
      const v = lowest(m)
      const t = s.clone()
      t.place(i, v)
      propagate(t, allow)
      if (t.broken) { s.eliminate(i, v); return { cell: i, value: v } }
    }
  }
  return null
}

// Solves with only the allowed techniques, always using the easiest one that
// makes progress. Returns whether it finished, how often each technique was
// needed, and the solved values.
export function playerSolve(board, givens = board.givens, allow = TECHNIQUES) {
  const allowed = new Set(allow)
  const s = new State(board, givens)
  const used = Object.fromEntries(TECHNIQUES.map((t) => [t, 0]))
  let steps = 0
  while (!s.broken && !s.done()) {
    let moved = null
    for (const name of TECHNIQUES) {
      if (!allowed.has(name)) continue
      const step = name === 'trial' ? trial(s, new Set([...allowed].filter((t) => t !== 'trial'))) : SIMPLE[name](s)
      if (step) { used[name]++; moved = name; break }
    }
    if (!moved) break
    steps++
    if (s.stuck()) s.broken = true
  }
  return { solved: !s.broken && s.done(), used, steps, values: s.vals }
}

/* ---------- which flower grows in which bed ---------- */

// Single-cell beds always grow a sunflower. Every other bed gets one of nine
// flowers, never the same as a bed it touches (even at a corner), picking
// colours far from its neighbours' and spreading the flowers around evenly.
export const FLOWERS = ['tulip', 'marigold', 'buttercup', 'daisy', 'forgetmenot', 'cornflower', 'lavender', 'pansy', 'rose']
// where each flower's colour sits on the colour wheel, in degrees; the daisy is white
const HUE = { tulip: 350, marigold: 30, buttercup: 52, daisy: 180, forgetmenot: 200, cornflower: 226, lavender: 268, pansy: 285, rose: 325 }

export function bedNeighbors(board) {
  const near = board.beds.map(() => new Set())
  for (let i = 0; i < board.cells; i++) {
    for (const j of board.around[i]) if (board.bedOf[i] !== board.bedOf[j]) near[board.bedOf[i]].add(board.bedOf[j])
  }
  return near.map((set) => [...set])
}

export function assignFlowers(board, seed = 1) {
  let s = (seed * 7919) % 2147483647 || 1
  const rand = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  const near = bedNeighbors(board)
  const flowers = board.beds.map((bed) => (bed.length === 1 ? 'sunflower' : null))
  const count = Object.fromEntries(FLOWERS.map((f) => [f, 0]))
  const gap = (a, b) => { const d = Math.abs(HUE[a] - HUE[b]) % 360; return Math.min(d, 360 - d) }
  const order = board.beds.map((_, b) => b).filter((b) => !flowers[b]).sort((a, b) => near[b].length - near[a].length || a - b)
  for (const b of order) {
    const taken = near[b].map((n) => flowers[n]).filter((f) => f && f !== 'sunflower')
    let best = null, bestScore = -Infinity
    for (const f of FLOWERS) {
      const clash = taken.filter((t) => t === f).length
      const closest = taken.length ? Math.min(...taken.map((t) => gap(f, t))) : 180
      const score = -clash * 1000 + Math.min(closest, 90) - count[f] * 25 + rand() * 20
      if (score > bestScore) { bestScore = score; best = f }
    }
    flowers[b] = best
    count[best]++
  }
  return flowers
}

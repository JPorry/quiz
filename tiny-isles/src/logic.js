// Bunny Burrows is Hashiwokakero dressed as a warren. Burrows are islands, paths are
// bridges, and Grandma's burrow is the source the carrots travel out from.

export const DIRECTIONS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

// Everything that never changes while a level is played: which burrows can see each
// other, which paths would cross, and which paths touch each burrow.
export function buildBoard(level) {
  const burrows = level.burrows.map(([row, column, value], index) => ({ row, column, value, index }))
  const at = new Map(burrows.map((b) => [`${b.row},${b.column}`, b.index]))
  const edges = []
  const neighbors = burrows.map(() => ({}))
  for (const burrow of burrows) {
    for (const [name, [dr, dc]] of Object.entries({ down: DIRECTIONS.down, right: DIRECTIONS.right })) {
      const cells = []
      let row = burrow.row + dr
      let column = burrow.column + dc
      while (row >= 0 && row < level.height && column >= 0 && column < level.width) {
        const other = at.get(`${row},${column}`)
        if (other !== undefined) {
          const index = edges.length
          edges.push({ index, id: `${burrow.index}-${other}`, a: burrow.index, b: other, horizontal: name === 'right', cells })
          neighbors[burrow.index][name] = index
          neighbors[other][name === 'right' ? 'left' : 'up'] = index
          break
        }
        cells.push([row, column])
        row += dr
        column += dc
      }
    }
  }
  const crossings = edges.map(() => [])
  for (const e of edges) {
    for (const f of edges) {
      if (e.index < f.index && edgesCross(e, f, burrows)) {
        crossings[e.index].push(f.index)
        crossings[f.index].push(e.index)
      }
    }
  }
  const byBurrow = burrows.map(() => [])
  for (const e of edges) {
    byBurrow[e.a].push(e.index)
    byBurrow[e.b].push(e.index)
  }
  return { level, width: level.width, height: level.height, source: level.source ?? 0, burrows, edges, crossings, byBurrow, neighbors }
}

function edgesCross(e, f, burrows) {
  if (e.horizontal === f.horizontal) return false
  const [h, v] = e.horizontal ? [e, f] : [f, e]
  const row = burrows[h.a].row
  const column = burrows[v.a].column
  const [c1, c2] = [burrows[h.a].column, burrows[h.b].column].sort((x, y) => x - y)
  const [r1, r2] = [burrows[v.a].row, burrows[v.b].row].sort((x, y) => x - y)
  return column > c1 && column < c2 && row > r1 && row < r2
}

export const otherEnd = (edge, burrow) => (edge.a === burrow ? edge.b : edge.a)

export function degrees(board, counts) {
  const result = board.burrows.map(() => 0)
  for (const e of board.edges) {
    result[e.a] += counts[e.index]
    result[e.b] += counts[e.index]
  }
  return result
}

export function blockedBy(board, counts, edgeIndex) {
  return board.crossings[edgeIndex].find((other) => counts[other] > 0)
}

export function reachable(board, counts, start) {
  const seen = new Map([[start, 0]])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()
    for (const edgeIndex of board.byBurrow[current]) {
      if (!counts[edgeIndex]) continue
      const next = otherEnd(board.edges[edgeIndex], current)
      if (!seen.has(next)) {
        seen.set(next, seen.get(current) + 1)
        queue.push(next)
      }
    }
  }
  return seen
}

// The burrows along the shortest walk from Grandma's to a burrow, for the courier.
export function routeFrom(board, counts, start, goal) {
  const previous = new Map([[start, null]])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()
    if (current === goal) break
    for (const edgeIndex of board.byBurrow[current]) {
      if (!counts[edgeIndex]) continue
      const next = otherEnd(board.edges[edgeIndex], current)
      if (!previous.has(next)) {
        previous.set(next, current)
        queue.push(next)
      }
    }
  }
  if (!previous.has(goal)) return null
  const route = []
  for (let at = goal; at !== null; at = previous.get(at)) route.unshift(at)
  return route
}

function components(board, counts) {
  const seen = new Set()
  const groups = []
  for (const burrow of board.burrows) {
    if (seen.has(burrow.index)) continue
    const group = [...reachable(board, counts, burrow.index).keys()]
    group.forEach((index) => seen.add(index))
    groups.push(group)
  }
  return groups
}

// What the garden looks like right now: which burrows are fed, which have too many
// paths, and which groups have closed themselves off from Grandma's.
export function status(board, counts) {
  const degree = degrees(board, counts)
  const fed = reachable(board, counts, board.source)
  const over = board.burrows.filter((b) => degree[b.index] > b.value).map((b) => b.index)
  const exact = board.burrows.filter((b) => degree[b.index] === b.value).map((b) => b.index)
  const closed = components(board, counts).filter(
    (group) => !group.includes(board.source) && group.length < board.burrows.length && group.every((i) => degree[i] === board.burrows[i].value),
  )
  const complete = exact.length === board.burrows.length && fed.size === board.burrows.length
  return { degree, fed, over, exact, closed, complete }
}

/* ---------- deductions ---------- */

// The solver works on an interval [lo, hi] of path counts for every possible path.
// Each technique is something a player can see, so the same steps drive the hints,
// the difficulty rating, and the uniqueness check.
export const TECHNIQUES = ['crossing', 'capacity', 'isolation', 'trial']

function closedGroupContradiction(board, lo) {
  const n = board.burrows.length
  const degree = board.burrows.map(() => 0)
  for (const e of board.edges) {
    degree[e.a] += lo[e.index]
    degree[e.b] += lo[e.index]
  }
  const seen = new Set()
  for (const burrow of board.burrows) {
    if (seen.has(burrow.index)) continue
    const group = [...reachable(board, lo, burrow.index).keys()]
    group.forEach((i) => seen.add(i))
    if (group.length < n && group.every((i) => degree[i] === board.burrows[i].value)) return true
  }
  return false
}

// Returns the easiest single tightening of the intervals, or a contradiction.
export function nextDeduction(board, lo, hi, { allowTrial = true } = {}) {
  // Crossing: a path cannot be laid across one that already exists.
  for (const e of board.edges) {
    if (hi[e.index] === 0) continue
    const blocker = board.crossings[e.index].find((f) => lo[f] > 0)
    if (blocker !== undefined) {
      if (lo[e.index] > 0) return { contradiction: true }
      return { technique: 'crossing', edge: e.index, lo: 0, hi: 0, blocker }
    }
  }
  // Capacity: a burrow's baskets must be shared out among the paths it can still take.
  for (const burrow of board.burrows) {
    const edges = board.byBurrow[burrow.index]
    const sumLo = edges.reduce((s, i) => s + lo[i], 0)
    const sumHi = edges.reduce((s, i) => s + hi[i], 0)
    if (sumHi < burrow.value || sumLo > burrow.value) return { contradiction: true, burrow: burrow.index }
    for (const i of edges) {
      const newLo = Math.max(lo[i], burrow.value - (sumHi - hi[i]))
      const newHi = Math.min(hi[i], burrow.value - (sumLo - lo[i]))
      if (newLo > newHi) return { contradiction: true, burrow: burrow.index }
      if (newLo !== lo[i] || newHi !== hi[i]) return { technique: 'capacity', edge: i, lo: newLo, hi: newHi, burrow: burrow.index }
    }
  }
  // Isolation: never close a family off from Grandma's carrots.
  const n = board.burrows.length
  for (const e of board.edges) {
    const i = e.index
    if (lo[i] === hi[i]) continue
    const trial = lo.slice()
    trial[i] = hi[i]
    const degree = board.burrows.map(() => 0)
    for (const f of board.edges) {
      degree[f.a] += trial[f.index]
      degree[f.b] += trial[f.index]
    }
    const group = [...reachable(board, trial, e.a).keys()]
    if (group.length < n && group.every((j) => degree[j] === board.burrows[j].value)) {
      return { technique: 'isolation', edge: i, lo: lo[i], hi: hi[i] - 1, burrow: e.a }
    }
  }
  if (closedGroupContradiction(board, lo)) return { contradiction: true }
  if (!allowTrial) return null
  // Trial: try the end of an interval, follow the easy steps, and see if it falls apart.
  for (const e of board.edges) {
    const i = e.index
    if (lo[i] === hi[i]) continue
    for (const [value, apply] of [[lo[i], (l, h) => { h[i] = lo[i] }], [hi[i], (l) => { l[i] = hi[i] }]]) {
      const l = lo.slice()
      const h = hi.slice()
      apply(l, h)
      if (!propagate(board, l, h, { allowTrial: false }).ok) {
        return value === lo[i]
          ? { technique: 'trial', edge: i, lo: lo[i] + 1, hi: hi[i] }
          : { technique: 'trial', edge: i, lo: lo[i], hi: hi[i] - 1 }
      }
    }
  }
  return null
}

export function propagate(board, lo, hi, options = {}) {
  const used = { crossing: 0, capacity: 0, isolation: 0, trial: 0 }
  for (;;) {
    const step = nextDeduction(board, lo, hi, options)
    if (!step) return { ok: true, used }
    if (step.contradiction) return { ok: false, used }
    lo[step.edge] = step.lo
    hi[step.edge] = step.hi
    used[step.technique] += 1
  }
}

export function initialBounds(board) {
  return { lo: board.edges.map(() => 0), hi: board.edges.map(() => 2) }
}

// Counts solutions (up to a limit) by deduction plus branching.
export function solve(board, { limit = 2 } = {}) {
  const solutions = []
  function search(lo, hi) {
    if (solutions.length >= limit) return
    if (!propagate(board, lo, hi, { allowTrial: false }).ok) return
    const open = board.edges.find((e) => lo[e.index] < hi[e.index])
    if (!open) {
      const counts = lo.slice()
      if (reachable(board, counts, 0).size === board.burrows.length) solutions.push(counts)
      return
    }
    for (let value = lo[open.index]; value <= hi[open.index]; value++) {
      const l = lo.slice()
      const h = hi.slice()
      l[open.index] = h[open.index] = value
      search(l, h)
    }
  }
  const { lo, hi } = initialBounds(board)
  search(lo, hi)
  return solutions
}

// How a careful player gets on: always the easiest step available.
export function playerSolve(board) {
  const { lo, hi } = initialBounds(board)
  const result = propagate(board, lo, hi, { allowTrial: true })
  const solved = result.ok && board.edges.every((e) => lo[e.index] === hi[e.index])
  return { solved, used: result.used, counts: lo }
}

/* ---------- hints ---------- */

// A hint names one path and why. Mistakes come first, then the easiest deduction from
// what the player has already laid.
export function findHint(board, counts, solution) {
  for (const e of board.edges) {
    if (counts[e.index] > solution[e.index]) {
      return { edge: e.index, kind: 'remove', text: solution[e.index] === 1 ? 'One path is enough here.' : "This path doesn't belong here." }
    }
  }
  const lo = counts.slice()
  const hi = board.edges.map(() => 2)
  for (let guard = 0; guard < 500; guard++) {
    const step = nextDeduction(board, lo, hi)
    if (!step || step.contradiction) break
    lo[step.edge] = step.lo
    hi[step.edge] = step.hi
    if (step.lo > counts[step.edge]) {
      const burrow = step.burrow ?? board.edges[step.edge].a
      const text = {
        capacity: step.lo === 2 ? 'This burrow needs a double path here: it has no other way to share its baskets.' : 'This burrow can only fill its baskets if a path goes here.',
        crossing: 'Paths are blocked elsewhere, so this one is needed.',
        isolation: 'Without this path, a family would be cut off from Grandma.',
        trial: 'Try leaving this out: soon a burrow runs short of paths. So it must be here.',
      }[step.technique]
      return { edge: step.edge, burrow, kind: 'add', technique: step.technique, text }
    }
  }
  const missing = board.edges.find((e) => counts[e.index] < solution[e.index])
  return missing ? { edge: missing.index, kind: 'add', text: 'A path belongs here.' } : null
}

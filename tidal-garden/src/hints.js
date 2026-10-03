import { getValidBinaryLines, canAppendBinaryRow, isValidBinarySolution } from './binaryLogic.js'

// Edge hints sit between two neighboring tiles. A footbridge always joins two land tiles; a
// shoreline always runs between land and water. Water beside water never carries a hint.
// Each hint is { kind: 'bridge' | 'shore', cells: [[row, col], [row, col]] }.
export const HINT_KINDS = Object.freeze(['bridge', 'shore'])

export const hintKey = ({ cells: [[r1, c1], [r2, c2]] }) => `${Math.min(r1, r2)}:${Math.min(c1, c2)}:${r1 === r2 ? 'h' : 'v'}`

// Whether a hint can still hold, given the tiles placed so far.
export function hintHolds({ kind, cells: [[r1, c1], [r2, c2]] }, grid) {
  const a = grid[r1][c1], b = grid[r2][c2]
  if (kind === 'bridge') return a !== 0 && b !== 0
  return a === null || b === null || a !== b
}

// Tiles that break a hint, as "row:col" keys, so they can be marked like any other mistake.
export function hintViolations(grid, hints = []) {
  const broken = new Set()
  for (const hint of hints) {
    if (hintHolds(hint, grid)) continue
    for (const [r, c] of hint.cells) if (grid[r][c] !== null) broken.add(`${r}:${c}`)
  }
  return broken
}

export const hintsHold = (grid, hints = []) => hints.every((hint) => hintHolds(hint, grid))

// The hints a finished garden could carry: every land pair could take a bridge, and every
// land and water pair a shoreline.
export function possibleHints(solution) {
  const size = solution.length
  const found = []
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    for (const [r, c] of [[row, col + 1], [row + 1, col]]) {
      if (r >= size || c >= size) continue
      const a = solution[row][col], b = solution[r][c]
      if (a === 0 && b === 0) continue
      found.push({ kind: a === 1 && b === 1 ? 'bridge' : 'shore', cells: [[row, col], [r, c]] })
    }
  }
  return found
}

// Counts the gardens that fit both the starting tiles and the hints, up to `limit`.
export function countSolutions(puzzle, hints = [], limit = 2) {
  const size = puzzle.length
  const clues = puzzle.map((row) => [...row])
  // A footbridge's tiles are land, whatever else is known.
  for (const hint of hints) if (hint.kind === 'bridge') for (const [r, c] of hint.cells) clues[r][c] = 1
  const within = (row) => hints.filter((hint) => hint.cells[0][0] === row && hint.cells[1][0] === row)
  const between = (row) => hints.filter((hint) => hint.kind === 'shore' && hint.cells[1][0] === row && hint.cells[0][0] === row - 1)
  const valid = getValidBinaryLines(size)
  const candidates = clues.map((row, index) => valid.filter((line) =>
    line.every((value, col) => row[col] === null || row[col] === value)
    && within(index).every((hint) => hint.kind === 'bridge' || line[hint.cells[0][1]] !== line[hint.cells[1][1]])))
  let found = 0
  const rows = []
  const search = () => {
    if (found >= limit) return
    if (rows.length === size) { if (isValidBinarySolution(rows)) found++; return }
    const index = rows.length
    for (const line of candidates[index]) {
      if (!canAppendBinaryRow(rows, line, size)) continue
      if (index && between(index).some((hint) => rows[index - 1][hint.cells[0][1]] === line[hint.cells[1][1]])) continue
      rows.push(line)
      search()
      rows.pop()
    }
  }
  search()
  return found
}

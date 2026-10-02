const DEFAULT_SIZE = 10
const DEFAULT_SOLUTION_LIMIT = 2
const validLineCache = new Map()

export function hasBinaryTriple(values) {
  return values.some(
    (value, index) =>
      index <= values.length - 3 &&
      value === values[index + 1] &&
      value === values[index + 2],
  )
}

export function isValidBinaryLine(values) {
  const half = values.length / 2

  return (
    values.length > 0 &&
    values.length % 2 === 0 &&
    values.every((value) => value === 0 || value === 1) &&
    values.filter((value) => value === 0).length === half &&
    values.filter((value) => value === 1).length === half &&
    !hasBinaryTriple(values)
  )
}

export function getValidBinaryLines(size = DEFAULT_SIZE) {
  if (!Number.isInteger(size) || size <= 0 || size % 2 !== 0) {
    throw new Error(`Binary puzzle size must be a positive even integer, received ${size}`)
  }

  if (!validLineCache.has(size)) {
    const lines = Array.from({ length: 2 ** size }, (_, number) =>
      number
        .toString(2)
        .padStart(size, '0')
        .split('')
        .map(Number),
    ).filter(isValidBinaryLine)

    validLineCache.set(size, lines)
  }

  return validLineCache.get(size)
}

function assertBinaryGrid(grid, { allowEmpty }) {
  const size = grid.length

  if (!size || size % 2 !== 0 || grid.some((row) => row.length !== size)) {
    throw new Error('Binary puzzles must be non-empty, even-sized square grids')
  }

  const allowedValues = allowEmpty ? [null, 0, 1] : [0, 1]
  if (grid.some((row) => row.some((value) => !allowedValues.includes(value)))) {
    throw new Error(`Binary grid contains an invalid value`)
  }

  return size
}

function matchesBinaryClues(line, clues) {
  return line.every((value, column) => {
    const clue = clues[column]
    return clue === null || clue === value
  })
}

export function canAppendBinaryRow(rows, candidate, size = candidate.length) {
  const half = size / 2

  if (rows.some((row) => row.every((value, index) => value === candidate[index]))) {
    return false
  }

  return candidate.every((_, column) => {
    const values = [...rows.map((row) => row[column]), candidate[column]]
    const zeros = values.filter((value) => value === 0).length
    const ones = values.length - zeros
    return zeros <= half && ones <= half && !hasBinaryTriple(values)
  })
}

export function isValidBinarySolution(grid) {
  let size

  try {
    size = assertBinaryGrid(grid, { allowEmpty: false })
  } catch {
    return false
  }

  const columns = Array.from({ length: size }, (_, column) =>
    grid.map((row) => row[column]),
  )
  const rowsAreUnique = new Set(grid.map((row) => row.join(''))).size === size
  const columnsAreUnique =
    new Set(columns.map((column) => column.join(''))).size === size

  return (
    rowsAreUnique &&
    columnsAreUnique &&
    grid.every(isValidBinaryLine) &&
    columns.every(isValidBinaryLine)
  )
}

export function solveBinaryPuzzle(
  puzzle,
  { maxSolutions = DEFAULT_SOLUTION_LIMIT } = {},
) {
  const size = assertBinaryGrid(puzzle, { allowEmpty: true })

  if (!Number.isInteger(maxSolutions) || maxSolutions < 1) {
    throw new Error(`maxSolutions must be a positive integer, received ${maxSolutions}`)
  }

  const validLines = getValidBinaryLines(size)
  const candidates = puzzle.map((clues) =>
    validLines.filter((line) => matchesBinaryClues(line, clues)),
  )
  const solutions = []

  function search(rows) {
    if (solutions.length >= maxSolutions) return

    if (rows.length === size) {
      if (isValidBinarySolution(rows)) {
        solutions.push(rows.map((row) => [...row]))
      }
      return
    }

    for (const candidate of candidates[rows.length]) {
      if (canAppendBinaryRow(rows, candidate, size)) {
        search([...rows, candidate])
      }
    }
  }

  search([])
  return solutions
}

export function countBinarySolutions(
  puzzle,
  maxSolutions = DEFAULT_SOLUTION_LIMIT,
) {
  return solveBinaryPuzzle(puzzle, { maxSolutions }).length
}

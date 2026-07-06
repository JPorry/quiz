import { PUZZLES, SIZE } from '../src/puzzles.js'

const HALF = SIZE / 2
const MAX_SOLUTIONS = 2

function hasTriple(values) {
  return values.some(
    (value, index) =>
      index <= values.length - 3 &&
      value === values[index + 1] &&
      value === values[index + 2],
  )
}

function isValidLine(values) {
  return (
    values.length === SIZE &&
    values.filter((value) => value === 0).length === HALF &&
    values.filter((value) => value === 1).length === HALF &&
    !hasTriple(values)
  )
}

const validRows = Array.from({ length: 2 ** SIZE }, (_, number) =>
  number
    .toString(2)
    .padStart(SIZE, '0')
    .split('')
    .map(Number),
).filter(isValidLine)

function matchesClues(row, clues) {
  return row.every((value, column) => {
    const clue = clues[column]
    return clue === null || clue === value
  })
}

function canAppendRow(rows, candidate) {
  if (rows.some((row) => row.every((value, index) => value === candidate[index]))) {
    return false
  }

  return candidate.every((_, column) => {
    const values = [...rows.map((row) => row[column]), candidate[column]]
    const zeros = values.filter((value) => value === 0).length
    const ones = values.length - zeros
    return zeros <= HALF && ones <= HALF && !hasTriple(values)
  })
}

export function countSolutions(puzzle) {
  const candidates = puzzle.map((clues) =>
    validRows.filter((row) => matchesClues(row, clues)),
  )
  let solutions = 0

  function search(rows) {
    if (solutions >= MAX_SOLUTIONS) return

    if (rows.length === SIZE) {
      const columns = Array.from({ length: SIZE }, (_, column) =>
        rows.map((row) => row[column]),
      )
      const uniqueColumns = new Set(columns.map((column) => column.join('')))

      if (
        uniqueColumns.size === SIZE &&
        columns.every((column) => isValidLine(column))
      ) {
        solutions += 1
      }
      return
    }

    for (const candidate of candidates[rows.length]) {
      if (canAppendRow(rows, candidate)) search([...rows, candidate])
    }
  }

  search([])
  return solutions
}

function verifyPuzzle({ name, puzzle, solution }) {
  const columns = Array.from({ length: SIZE }, (_, column) =>
    solution.map((row) => row[column]),
  )
  const rowsAreUnique = new Set(solution.map((row) => row.join(''))).size === SIZE
  const columnsAreUnique =
    new Set(columns.map((column) => column.join(''))).size === SIZE
  const cluesMatch = puzzle.every((row, rowIndex) =>
    row.every(
      (value, columnIndex) =>
        value === null || value === solution[rowIndex][columnIndex],
    ),
  )
  const solutionIsValid =
    solution.every(isValidLine) &&
    columns.every(isValidLine) &&
    rowsAreUnique &&
    columnsAreUnique
  const solutionCount = countSolutions(puzzle)

  if (!cluesMatch || !solutionIsValid || solutionCount !== 1) {
    throw new Error(
      `${name} failed: cluesMatch=${cluesMatch}, solutionIsValid=${solutionIsValid}, solutions=${solutionCount}`,
    )
  }

  console.log(`✓ ${name}: exactly 1 solution`)
}

PUZZLES.forEach(verifyPuzzle)

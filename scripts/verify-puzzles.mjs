import { PUZZLES, SIZE } from '../src/puzzles.js'
import {
  countBinarySolutions,
  isValidBinarySolution,
} from '../src/binaryLogic.js'
import { HASHI_PUZZLES } from '../src/hashiPuzzles.js'
import { countHashiSolutions } from '../src/hashiLogic.js'
import { TECTONIC_PUZZLES } from '../src/tectonicPuzzles.js'
import {
  countTectonicSolutions,
  findTectonicViolations,
  getTectonicRegionSizes,
} from '../src/tectonicLogic.js'

export { countBinarySolutions as countSolutions }

const unconstrainedBinaryPuzzle = Array.from({ length: SIZE }, () =>
  Array(SIZE).fill(null),
)

if (countBinarySolutions(unconstrainedBinaryPuzzle, 2) !== 2) {
  throw new Error('Binary solver failed to detect multiple solutions')
}

console.log('✓ Binary solver detects puzzles with multiple solutions')

function verifyPuzzle({ name, puzzle, solution }) {
  const cluesMatch = puzzle.every((row, rowIndex) =>
    row.every(
      (value, columnIndex) =>
        value === null || value === solution[rowIndex][columnIndex],
    ),
  )
  const solutionIsValid =
    solution.length === SIZE && isValidBinarySolution(solution)
  const solutionCount = countBinarySolutions(puzzle, 2)

  if (!cluesMatch || !solutionIsValid || solutionCount !== 1) {
    throw new Error(
      `${name} failed: cluesMatch=${cluesMatch}, solutionIsValid=${solutionIsValid}, solutions=${solutionCount}`,
    )
  }

  console.log(`✓ ${name}: exactly 1 solution`)
}

PUZZLES.forEach(verifyPuzzle)

function verifyHashiPuzzle(level) {
  const solutionCount = countHashiSolutions(level)

  if (solutionCount !== 1) {
    throw new Error(`${level.name} failed: Hashi solutions=${solutionCount}`)
  }

  console.log(`✓ Hashi ${level.name}: exactly 1 solution`)
}

HASHI_PUZZLES.forEach(verifyHashiPuzzle)

function verifyTectonicPuzzle(level) {
  const regionSizes = getTectonicRegionSizes(level)
  const cluesMatch = level.puzzle.every((row, rowIndex) =>
    row.every(
      (value, columnIndex) =>
        value === null || value === level.solution[rowIndex][columnIndex],
    ),
  )
  const solutionValuesMatchRegions = level.solution.every((row, rowIndex) =>
    row.every((value, columnIndex) => {
      const regionSize = regionSizes[level.regionGrid[rowIndex][columnIndex]]
      return value >= 1 && value <= regionSize
    }),
  )
  const solutionIsValid =
    solutionValuesMatchRegions &&
    findTectonicViolations(level, level.solution).size === 0
  const solutionCount = countTectonicSolutions(level)

  if (!cluesMatch || !solutionIsValid || solutionCount !== 1) {
    throw new Error(
      `${level.name} failed: Tectonic cluesMatch=${cluesMatch}, solutionIsValid=${solutionIsValid}, solutions=${solutionCount}`,
    )
  }

  console.log(`✓ Tectonic ${level.name}: exactly 1 solution`)
}

TECTONIC_PUZZLES.forEach(verifyTectonicPuzzle)

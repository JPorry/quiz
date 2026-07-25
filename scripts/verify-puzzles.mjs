import { PUZZLES, SIZE } from '../src/puzzles.js'
import {
  countBinarySolutions,
  isValidBinarySolution,
} from '../src/binaryLogic.js'
import {
  BIOME_SYMBOLS,
  analyzeBiomesPuzzle,
  countBiomesSolutions,
  findBiomesLogicalPlacements,
  hasTrappedBiomesPrey,
  isValidBiomesSolution,
} from '../src/biomesLogic.js'
import { BIOMES_PUZZLES } from '../src/biomesPuzzles.js'
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

const unconstrainedBiomesPuzzle = Array.from({ length: 6 }, () =>
  Array(6).fill(null),
)

if (countBiomesSolutions(unconstrainedBiomesPuzzle, 2) !== 2) {
  throw new Error('Biomes solver failed to detect multiple solutions')
}

if (
  !hasTrappedBiomesPrey([
    BIOME_SYMBOLS.WORM,
    BIOME_SYMBOLS.PLANT,
    BIOME_SYMBOLS.WORM,
  ]) ||
  !hasTrappedBiomesPrey([
    BIOME_SYMBOLS.BIRD,
    BIOME_SYMBOLS.WORM,
    BIOME_SYMBOLS.BIRD,
  ]) ||
  hasTrappedBiomesPrey([
    BIOME_SYMBOLS.PLANT,
    BIOME_SYMBOLS.BIRD,
    BIOME_SYMBOLS.PLANT,
  ])
) {
  throw new Error('Biomes food-chain asymmetry is incorrect')
}

const separatedPredatorsGrid = Array.from({ length: 6 }, () =>
  Array(6).fill(null),
)
separatedPredatorsGrid[0][0] = BIOME_SYMBOLS.BIRD
separatedPredatorsGrid[0][2] = BIOME_SYMBOLS.BIRD
separatedPredatorsGrid[1][0] = BIOME_SYMBOLS.WORM
separatedPredatorsGrid[1][2] = BIOME_SYMBOLS.WORM

const separatedPredatorPlacements =
  findBiomesLogicalPlacements(separatedPredatorsGrid)
if (
  !separatedPredatorPlacements.some(
    (placement) =>
      placement.row === 0 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.PLANT &&
      placement.technique === 'E1',
  ) ||
  !separatedPredatorPlacements.some(
    (placement) =>
      placement.row === 1 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.BIRD &&
      placement.technique === 'E1',
  )
) {
  throw new Error('Biomes E1 separated-predator technique is incorrect')
}

console.log('✓ Biomes food-chain asymmetry and E1 deductions')

const uniqueBiomesPuzzles = new Set(
  BIOMES_PUZZLES.map((level) => JSON.stringify(level.puzzle)),
)
const uniqueBiomesSolutions = new Set(
  BIOMES_PUZZLES.map((level) => JSON.stringify(level.solution)),
)
if (
  uniqueBiomesPuzzles.size !== BIOMES_PUZZLES.length ||
  uniqueBiomesSolutions.size !== BIOMES_PUZZLES.length
) {
  throw new Error('Biomes level set contains duplicate puzzles or solutions')
}

function verifyBiomesPuzzle(level) {
  const cluesMatch = level.puzzle.every((row, rowIndex) =>
    row.every(
      (value, columnIndex) =>
        value === null || value === level.solution[rowIndex][columnIndex],
    ),
  )
  const solutionIsValid = isValidBiomesSolution(level.solution)
  const solutionCount = countBiomesSolutions(level.puzzle, 2)
  const analysis = analyzeBiomesPuzzle(level.puzzle)
  const e1Count = analysis.techniqueCounts.E1 ?? 0

  if (
    !cluesMatch ||
    !solutionIsValid ||
    solutionCount !== 1 ||
    !analysis.solved ||
    e1Count < 1 ||
    analysis.techniqueDiversity < 4 ||
    analysis.pureBalanceRatio > 0.5
  ) {
    throw new Error(
      `${level.name} failed: Biomes cluesMatch=${cluesMatch}, solutionIsValid=${solutionIsValid}, solutions=${solutionCount}, logical=${analysis.solved}, E1=${e1Count}, diversity=${analysis.techniqueDiversity}, pureBalanceRatio=${analysis.pureBalanceRatio}`,
    )
  }

  console.log(
    `✓ Biomes ${level.name}: unique, logical, E1=${e1Count}, techniques=${analysis.techniqueDiversity}`,
  )
}

BIOMES_PUZZLES.forEach(verifyBiomesPuzzle)

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

import { PUZZLES, SIZE } from '../src/puzzles.js'
import {
  countBinarySolutions,
  isValidBinarySolution,
} from '../src/binaryLogic.js'
import {
  BIOME_SYMBOLS,
  analyzeBiomesPuzzle,
  assertBiomesSize,
  countBiomesSolutions,
  findBiomesLogicalPlacements,
  findBiomesViolations,
  getBiomesMode,
  getValidBiomesLines,
  hasDominatedElementTrap,
  isValidBiomesLine,
  isValidBiomesSolution,
  solveBiomesPuzzleDetailed,
} from '../src/biomesLogic.js'
import { BIOMES_PUZZLES } from '../src/biomesPuzzles.js'
import { BIOMES_9X9_PUZZLES } from '../src/biomes9Puzzles.js'
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
  !hasDominatedElementTrap([
    BIOME_SYMBOLS.WATER,
    BIOME_SYMBOLS.FIRE,
    BIOME_SYMBOLS.WATER,
  ]) ||
  !hasDominatedElementTrap([
    BIOME_SYMBOLS.FIRE,
    BIOME_SYMBOLS.NATURE,
    BIOME_SYMBOLS.FIRE,
  ]) ||
  !hasDominatedElementTrap([
    BIOME_SYMBOLS.NATURE,
    BIOME_SYMBOLS.WATER,
    BIOME_SYMBOLS.NATURE,
  ])
) {
  throw new Error('Elemental dominance cycle is incorrect')
}

const separatedDominatorsGrid = Array.from({ length: 6 }, () =>
  Array(6).fill(null),
)
separatedDominatorsGrid[0][0] = BIOME_SYMBOLS.WATER
separatedDominatorsGrid[0][2] = BIOME_SYMBOLS.WATER
separatedDominatorsGrid[1][0] = BIOME_SYMBOLS.FIRE
separatedDominatorsGrid[1][2] = BIOME_SYMBOLS.FIRE
separatedDominatorsGrid[2][0] = BIOME_SYMBOLS.NATURE
separatedDominatorsGrid[2][2] = BIOME_SYMBOLS.NATURE

const separatedDominatorPlacements =
  findBiomesLogicalPlacements(separatedDominatorsGrid)
if (
  !separatedDominatorPlacements.some(
    (placement) =>
      placement.row === 0 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.NATURE &&
      placement.technique === 'E1',
  ) ||
  !separatedDominatorPlacements.some(
    (placement) =>
      placement.row === 1 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.WATER &&
      placement.technique === 'E1',
  ) ||
  !separatedDominatorPlacements.some(
    (placement) =>
      placement.row === 2 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.FIRE &&
      placement.technique === 'E1',
  )
) {
  throw new Error('E1 separated-dominator technique is incorrect')
}

console.log('✓ Elemental dominance cycle and all E1 deductions')

const compactMode = getBiomesMode('compact')
const standardMode = getBiomesMode('standard')
if (
  compactMode.boardSize !== 6 ||
  compactMode.targetPerSymbol !== 2 ||
  standardMode.boardSize !== 9 ||
  standardMode.targetPerSymbol !== 3
) {
  throw new Error('Biomes mode balance configuration is incorrect')
}

let invalidSizeRejected = false
try {
  assertBiomesSize(8)
} catch {
  invalidSizeRejected = true
}
if (!invalidSizeRejected) {
  throw new Error('Biomes accepted a size not divisible by its symbol count')
}

const validNineCellLine = [0, 0, 1, 1, 0, 2, 1, 2, 2]
if (
  !isValidBiomesLine(validNineCellLine) ||
  isValidBiomesLine([0, 0, 0, 1, 1, 1, 2, 2, 2]) ||
  getValidBiomesLines(9).some((line) => !isValidBiomesLine(line))
) {
  throw new Error('Biomes 9x9 legal-line precomputation is incorrect')
}

const nineByNineRuleGrid = Array.from({ length: 9 }, () =>
  Array(9).fill(null),
)
nineByNineRuleGrid[0][0] = BIOME_SYMBOLS.NATURE
nineByNineRuleGrid[0][1] = BIOME_SYMBOLS.NATURE
nineByNineRuleGrid[0][2] = BIOME_SYMBOLS.NATURE
nineByNineRuleGrid[1][4] = BIOME_SYMBOLS.NATURE
nineByNineRuleGrid[2][4] = BIOME_SYMBOLS.WATER
nineByNineRuleGrid[3][4] = BIOME_SYMBOLS.NATURE
const nineByNineViolations = findBiomesViolations(nineByNineRuleGrid)
if (
  !nineByNineViolations.has('0-0') ||
  !nineByNineViolations.has('0-2') ||
  !nineByNineViolations.has('1-4') ||
  !nineByNineViolations.has('3-4')
) {
  throw new Error('Biomes 9x9 horizontal or vertical rule validation failed')
}

const verticalE1Grid = Array.from({ length: 9 }, () => Array(9).fill(null))
verticalE1Grid[0][0] = BIOME_SYMBOLS.WATER
verticalE1Grid[2][0] = BIOME_SYMBOLS.WATER
verticalE1Grid[0][1] = BIOME_SYMBOLS.FIRE
verticalE1Grid[2][1] = BIOME_SYMBOLS.FIRE
verticalE1Grid[0][2] = BIOME_SYMBOLS.NATURE
verticalE1Grid[2][2] = BIOME_SYMBOLS.NATURE
const verticalE1Placements = findBiomesLogicalPlacements(verticalE1Grid)
if (
  !verticalE1Placements.some(
    (placement) =>
      placement.row === 1 &&
      placement.column === 0 &&
      placement.value === BIOME_SYMBOLS.NATURE &&
      placement.technique === 'E1',
  ) ||
  !verticalE1Placements.some(
    (placement) =>
      placement.row === 1 &&
      placement.column === 1 &&
      placement.value === BIOME_SYMBOLS.WATER &&
      placement.technique === 'E1',
  ) ||
  !verticalE1Placements.some(
    (placement) =>
      placement.row === 1 &&
      placement.column === 2 &&
      placement.value === BIOME_SYMBOLS.FIRE &&
      placement.technique === 'E1',
  )
) {
  throw new Error('Biomes 9x9 vertical E1 recognition failed')
}

console.log('✓ Biomes 6x6 and 9x9 configuration, rules, and E1 behavior')

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

const uniqueNineByNinePuzzles = new Set(
  BIOMES_9X9_PUZZLES.map((level) => JSON.stringify(level.puzzle)),
)
const uniqueNineByNineSolutions = new Set(
  BIOMES_9X9_PUZZLES.map((level) => JSON.stringify(level.solution)),
)
if (
  uniqueNineByNinePuzzles.size !== BIOMES_9X9_PUZZLES.length ||
  uniqueNineByNineSolutions.size !== BIOMES_9X9_PUZZLES.length
) {
  throw new Error('Biomes 9x9 level set contains duplicates')
}

function verifyNineByNineBiomesPuzzle(level) {
  const cluesMatch = level.puzzle.every((row, rowIndex) =>
    row.every(
      (value, columnIndex) =>
        value === null || value === level.solution[rowIndex][columnIndex],
    ),
  )
  const solutionIsValid =
    level.solution.length === 9 &&
    level.solution.flat().length === 81 &&
    isValidBiomesSolution(level.solution)
  const solveResult = solveBiomesPuzzleDetailed(level.puzzle, {
    maxSolutions: 2,
    nodeLimit: 750_000,
    timeoutMs: 8_000,
  })
  const analysis = analyzeBiomesPuzzle(level.puzzle)
  const solvedToIntendedSolution =
    solveResult.solutions.length === 1 &&
    solveResult.solutions[0].every((row, rowIndex) =>
      row.every(
        (value, columnIndex) =>
          value === level.solution[rowIndex][columnIndex],
      ),
    )

  if (
    !cluesMatch ||
    !solutionIsValid ||
    solveResult.limitReached ||
    !solvedToIntendedSolution ||
    !analysis.solved ||
    analysis.initialAvailablePlacements < 2 ||
    analysis.r2PlacementCount < 2 ||
    analysis.immediatePlacementRate < 0.35 ||
    !['easy', 'medium', 'hard'].includes(level.difficulty.classification)
  ) {
    throw new Error(
      `${level.name} failed: Biomes 9x9 cluesMatch=${cluesMatch}, solutionIsValid=${solutionIsValid}, solutions=${solveResult.solutions.length}, limit=${solveResult.limitReached}, logical=${analysis.solved}, initial=${analysis.initialAvailablePlacements}, R2=${analysis.r2PlacementCount}, IPR=${analysis.immediatePlacementRate}`,
    )
  }

  console.log(
    `✓ Biomes 9x9 ${level.name}: unique, logical, initial=${analysis.initialAvailablePlacements}, E1=${analysis.e1Count}, R2=${analysis.r2PlacementCount}`,
  )
}

BIOMES_9X9_PUZZLES.forEach(verifyNineByNineBiomesPuzzle)

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

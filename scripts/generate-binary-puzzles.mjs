import { pathToFileURL } from 'node:url'
import {
  canAppendBinaryRow,
  countBinarySolutions,
  getValidBinaryLines,
  isValidBinarySolution,
} from '../src/binaryLogic.js'

const DEFAULT_CLUES = 34
const DEFAULT_COUNT = 1
const DEFAULT_SEED = 20260724
const SIZE = 10

function createSeededRandom(seed) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(values, random) {
  const shuffled = [...values]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export function generateBinarySolution(random = Math.random) {
  const validLines = getValidBinaryLines(SIZE)

  function search(rows) {
    if (rows.length === SIZE) {
      return isValidBinarySolution(rows) ? rows.map((row) => [...row]) : null
    }

    for (const candidate of shuffle(validLines, random)) {
      if (!canAppendBinaryRow(rows, candidate, SIZE)) continue

      const solution = search([...rows, candidate])
      if (solution) return solution
    }

    return null
  }

  const solution = search([])
  if (!solution) throw new Error('Could not generate a valid Binary solution')
  return solution
}

export function carveUniqueBinaryPuzzle(
  solution,
  { random = Math.random, targetClues = DEFAULT_CLUES } = {},
) {
  if (!isValidBinarySolution(solution)) {
    throw new Error('Cannot create a puzzle from an invalid Binary solution')
  }

  const size = solution.length
  const totalCells = size * size
  if (!Number.isInteger(targetClues) || targetClues < 1 || targetClues > totalCells) {
    throw new Error(`targetClues must be between 1 and ${totalCells}`)
  }

  const puzzle = solution.map((row) => [...row])
  const positions = shuffle(
    Array.from({ length: totalCells }, (_, index) => index),
    random,
  )
  let clueCount = totalCells

  for (const position of positions) {
    if (clueCount <= targetClues) break

    const row = Math.floor(position / size)
    const column = position % size
    const clue = puzzle[row][column]
    puzzle[row][column] = null

    if (countBinarySolutions(puzzle, 2) !== 1) {
      puzzle[row][column] = clue
    } else {
      clueCount -= 1
    }
  }

  if (countBinarySolutions(puzzle, 2) !== 1) {
    throw new Error('Generated Binary puzzle is not uniquely solvable')
  }

  return puzzle
}

export function generateUniqueBinaryPuzzle({
  seed = DEFAULT_SEED,
  targetClues = DEFAULT_CLUES,
} = {}) {
  const random = createSeededRandom(seed)
  const solution = generateBinarySolution(random)
  const puzzle = carveUniqueBinaryPuzzle(solution, { random, targetClues })

  return { puzzle, solution }
}

function readIntegerArgument(name, fallback) {
  const prefix = `--${name}=`
  const argument = process.argv.find((value) => value.startsWith(prefix))
  if (!argument) return fallback

  const value = Number(argument.slice(prefix.length))
  if (!Number.isInteger(value)) {
    throw new Error(`--${name} must be an integer`)
  }
  return value
}

function main() {
  const count = readIntegerArgument('count', DEFAULT_COUNT)
  const seed = readIntegerArgument('seed', DEFAULT_SEED)
  const targetClues = readIntegerArgument('clues', DEFAULT_CLUES)
  const verifyOnly = process.argv.includes('--verify')

  const levels = Array.from({ length: count }, (_, index) => {
    const level = generateUniqueBinaryPuzzle({
      seed: seed + index,
      targetClues,
    })
    const solutionCount = countBinarySolutions(level.puzzle, 2)

    if (solutionCount !== 1) {
      throw new Error(`Generated Binary puzzle ${index + 1} has ${solutionCount} solutions`)
    }

    return {
      id: `generated-${String(index + 1).padStart(2, '0')}`,
      name: `Generated ${index + 1}`,
      ...level,
    }
  })

  if (verifyOnly) {
    console.log(`✓ Generated ${levels.length} Binary puzzle(s), each with exactly 1 solution`)
    return
  }

  console.log(JSON.stringify(levels, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

import { isValidBinaryLine } from './binaryLogic.js'

// Every full row and column that obeys the rules: balanced, no runs of three,
// and unlike any other full line on the same axis. Keys are `row:3` or `col:7`.
export function balancedLines(grid) {
  const axes = {
    row: grid.map((values) => values),
    col: grid[0].map((_, col) => grid.map((row) => row[col])),
  }
  const keys = new Set()
  for (const [axis, lines] of Object.entries(axes)) {
    const patterns = lines.map((values) => (values.includes(null) ? null : values.join('')))
    lines.forEach((values, index) => {
      if (patterns[index] === null || !isValidBinaryLine(values)) return
      if (patterns.some((pattern, other) => other !== index && pattern === patterns[index])) return
      keys.add(`${axis}:${index}`)
    })
  }
  return keys
}

// Lines that have just clicked into place, comparing the grid before and after a move.
export function newlyBalanced(before, after) {
  const previous = balancedLines(before)
  return [...balancedLines(after)].filter((key) => !previous.has(key)).map((key) => {
    const [axis, index] = key.split(':')
    return { axis, index: Number(index) }
  })
}

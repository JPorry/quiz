import test from 'node:test'
import assert from 'node:assert/strict'
import { balancedLines, newlyBalanced } from '../src/lines.js'
import { TUTORIAL } from '../src/tutorialGarden.js'

const solution = TUTORIAL.solution

test('a finished garden has every row and column balanced', () => {
  assert.equal(balancedLines(solution).size, 20)
})

test('placing the last tile of a row and column reports both, once', () => {
  const before = solution.map((row) => [...row])
  before[3][4] = null
  const lines = newlyBalanced(before, solution)
  assert.deepEqual(lines.sort((a, b) => a.axis.localeCompare(b.axis)), [{ axis: 'col', index: 4 }, { axis: 'row', index: 3 }])
  assert.deepEqual(newlyBalanced(solution, solution), [], 'nothing new without a change')
})

test('a full line that breaks a rule does not flourish', () => {
  const grid = solution.map((row) => [...row])
  grid[0] = [0, 0, 0, 1, 1, 0, 1, 1, 0, 1]
  assert.equal(balancedLines(grid).has('row:0'), false, 'three in a row')
  const twin = solution.map((row) => [...row])
  twin[1] = [...twin[0]]
  assert.equal(balancedLines(twin).has('row:0'), false, 'identical rows')
  assert.equal(balancedLines(twin).has('row:1'), false)
})

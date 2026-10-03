import test from 'node:test'
import assert from 'node:assert/strict'
import { PUZZLES } from '../src/puzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { LEVELS, measure, difficulty } from '../scripts/generate-gardens.mjs'

test('every garden can be solved by always taking the easiest move, without comparing lines', () => {
  for (const [index, garden] of PUZZLES.entries()) {
    const { solved, grid } = solveLikeAPlayer(garden.puzzle)
    assert.ok(solved, `Garden ${index + 1} stalls`)
    assert.deepEqual(grid, garden.solution)
  }
})

test('gardens introduce one technique at a time and only ever grow harder', () => {
  assert.equal(PUZZLES.length, LEVELS.length)
  const stats = PUZZLES.map((garden) => measure(garden.puzzle))
  stats.forEach((s, i) => {
    const { allowed } = LEVELS[i]
    if (!allowed.includes('count')) assert.equal(s.count + s.line, 0, `Garden ${i + 1} needs only pairs and gaps`)
    if (!allowed.includes('line')) assert.equal(s.line, 0, `Garden ${i + 1} needs no whole-line reasoning`)
    else assert.ok(s.line > 0, `Garden ${i + 1} asks for whole-line reasoning`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(difficulty(s) > difficulty(stats[i]), `Garden ${i + 2} is harder than garden ${i + 1}`))
  assert.ok(stats[0].givens > stats.at(-1).givens + 20, 'Early gardens start with far more terrain in place')
})

test('the next move is rarely hard to find', () => {
  for (const [index, garden] of PUZZLES.entries()) {
    const s = measure(garden.puzzle)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${index + 1} stalls too often`)
    assert.ok(s.flow >= 2.5, `Garden ${index + 1} rarely offers a choice of moves`)
  }
})

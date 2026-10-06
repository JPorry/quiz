import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBoard } from '../src/logic.js'
import { puzzle, TIERS } from '../src/puzzles.js'
import { findLesson, options, Tutorial } from '../src/tutorial.js'

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } }

test('every lesson the coach finds matches the garden and its rule', () => {
  for (let day = 1; day <= 40; day++) {
    for (const tier of TIERS) {
      const board = buildBoard(puzzle(day, tier))
      const values = Int8Array.from(board.givens)
      for (const rule of ['bed', 'touch']) {
        const m = findLesson(board, values, rule)
        if (!m) continue
        assert.equal(values[m.cell], 0)
        assert.equal(m.value, board.solution[m.cell], `${day}-${tier} ${rule}`)
        assert.equal(options(board, values)[m.cell] & (1 << m.value), 1 << m.value)
        for (const j of m.because) assert.ok(values[j])
      }
      const f = findLesson(board, values, 'flags')
      if (f) {
        assert.equal(f.cells.length, 2)
        assert.ok(f.cells.some((i) => board.solution[i] === f.value))
      }
    }
  }
})

test('every easy garden can start its first lessons straight away', () => {
  for (let day = 1; day <= 60; day++) {
    const board = buildBoard(puzzle(day, 'easy'))
    assert.ok(findLesson(board, board.givens, 'bed') || findLesson(board, board.givens, 'touch'), `day ${day}`)
  }
})

test('the coach walks from the welcome through every lesson, and remembers', () => {
  const storage = memory()
  const tutorial = new Tutorial(storage)
  const board = buildBoard(puzzle(1, 'easy'))
  const values = Int8Array.from(board.givens)
  const marks = new Uint8Array(board.cells)
  let play = { board, values, marks, seed: 1, marking: false, won: false }
  assert.equal(tutorial.card(play).step, 'welcome')
  tutorial.next()
  const seen = new Set()
  for (let k = 0; k < 200 && tutorial.step !== 'outro'; k++) {
    const card = tutorial.card(play)
    seen.add(card.step)
    const m = tutorial.lesson
    if (card.step === 'putaway') play = { ...play, marking: false }
    else if (card.step === 'flags') { play = { ...play, marking: true, seed: m.value }; for (const i of m.cells) marks[i] |= 1 << (m.value - 1) }
    else if (m) { values[m.cell] = m.value; play = { ...play, seed: m.value } }
    else { const i = values.findIndex((v) => !v); values[i] = board.solution[i] }
  }
  assert.ok(['bed', 'touch', 'flags', 'putaway'].every((s) => seen.has(s)), [...seen].join())
  assert.equal(tutorial.card(play).step, 'outro')
  tutorial.next()
  assert.equal(tutorial.card(play), null)
  assert.equal(new Tutorial(storage).card(play), null)
  const again = new Tutorial(storage)
  again.restart()
  assert.equal(again.card(play).step, 'welcome')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { TIERS, LAST_DAY, today, dayOf, dateOf, puzzle, gardenName } from '../src/daily.js'
import { FIRST_DAY } from '../src/days.js'
import { checkDay } from '../src/dayCheck.js'
import { GardenGame, findHint, copyGrid } from '../src/game.js'
import { GARDEN_WORDS } from '../src/gardenNames.js'

const MONTH = 30
const water = (grid) => grid.flatMap((row, r) => row.map((v, c) => (v === 0 ? [r, c] : null))).filter(Boolean)

test('four hundred days of an easy, a medium and a hard garden', () => {
  assert.equal(LAST_DAY, 400)
  assert.deepEqual(TIERS, ['easy', 'medium', 'hard'])
  assert.equal(dateOf(1).toISOString().slice(0, 10), FIRST_DAY)
  assert.equal(dayOf(new Date(2026, 9, 7)), 1)
  assert.equal(dayOf(new Date(2026, 9, 8, 23, 59)), 2, 'a new day starts at local midnight')
  assert.equal(today(new Date(2026, 0, 1)), 1, 'before the first day, today is day 1')
  assert.equal(today(new Date(2030, 0, 1)), LAST_DAY, 'after the last day, today stays on it')
})

test('easy gardens are balance alone, medium ones take turns through the clues, hard ones mix them', () => {
  const medium = new Set()
  for (let day = 1; day <= 8; day++) {
    assert.deepEqual(puzzle(day, 'easy').kinds, [])
    const kinds = puzzle(day, 'medium').kinds
    assert.equal(kinds.length, 1)
    medium.add(kinds[0])
    assert.ok(puzzle(day, 'hard').kinds.length >= 2)
  }
  assert.deepEqual([...medium].sort(), ['ferries', 'lighthouses', 'pilgrims', 'villages'])
})

test('the first month of gardens is sound, solvable by easy steps and true to its difficulty', () => {
  for (let day = 1; day <= MONTH; day++) for (const tier of TIERS) assert.deepEqual(checkDay(day, tier), [], `day ${day} ${tier}`)
})

test('every clue stands on starting land, and each pair of docks or shrines has its own color', () => {
  for (let day = 1; day <= MONTH; day++) for (const tier of TIERS) {
    const p = puzzle(day, tier)
    const cells = [...p.signs.map((x) => x.cell), ...p.lights.map((x) => x.cell), ...p.ferries.flatMap((x) => x.docks), ...p.pilgrims.flatMap((x) => x.shrines)]
    for (const [r, c] of cells) assert.equal(p.puzzle[r][c], 1, `day ${day} ${tier}: the clue at ${r},${c} stands on land`)
    assert.equal(new Set(p.ferries.map((x) => x.color)).size, p.ferries.length)
    assert.equal(new Set(p.pilgrims.map((x) => x.color)).size, p.pilgrims.length)
  }
})

test('a garden only counts as finished when every clue holds', () => {
  const game = new GardenGame(null)
  for (let day = 1; day <= 4; day++) {
    game.start(puzzle(day, 'medium'))
    game.grid = copyGrid(game.puzzle.solution)
    assert.equal(game.complete, true)
    const [kind] = game.puzzle.kinds
    const broken = {
      villages: { signs: game.puzzle.signs.map((s, i) => (i ? s : { ...s, size: s.size + 1 })) },
      lighthouses: { lights: game.puzzle.lights.map((l, i) => (i ? l : { ...l, sees: l.sees + 1 })) },
      ferries: { ferries: [{ color: 'coral', docks: [[-5, -5], [-5, -5]] }] },
      // Two shrines on water can never share an island.
      pilgrims: { pilgrims: [{ color: 'rose', shrines: water(game.puzzle.solution).slice(0, 2) }] },
    }[kind]
    game.puzzle = { ...game.puzzle, ...broken }
    assert.equal(game.complete, false, `a ${kind} garden with a broken clue isn't finished`)
  }
})

test('hints explain each clue and walk its gardens to their answers', () => {
  const technique = { villages: ['seal', 'apart', 'grow'], lighthouses: ['block', 'shine'], ferries: ['channel'], pilgrims: ['trail'] }
  for (let day = 1; day <= 4; day++) {
    const p = puzzle(day, 'medium')
    const working = copyGrid(p.puzzle)
    const used = new Set()
    for (let move = findHint(working, p.solution, p); move; move = findHint(working, p.solution, p)) {
      working[move.row][move.col] = move.value
      used.add(move.technique)
    }
    assert.deepEqual(working, p.solution)
    assert.ok(technique[p.kinds[0]].some((t) => used.has(t)), `the ${p.kinds[0]} hints come up`)
  }
})

test('every garden has a name in every language, the same idea in each', () => {
  for (const code of Object.keys(GARDEN_WORDS)) {
    for (const tier of TIERS) {
      const { first, second } = GARDEN_WORDS[code][tier]
      assert.equal(first.length, GARDEN_WORDS.en[tier].first.length, `${code} ${tier} first words line up`)
      assert.equal(second.length, GARDEN_WORDS.en[tier].second.length, `${code} ${tier} second words line up`)
    }
  }
  const names = new Set()
  for (let day = 1; day <= MONTH; day++) for (const tier of TIERS) names.add(gardenName(day, tier, 'en'))
  assert.ok(names.size >= MONTH * 3 * 0.9, 'names rarely repeat within a month')
  assert.equal(gardenName(5, 'hard', 'es').length > 0, true)
})

// What makes a daily garden sound, shared by the tests and scripts/verify-days.mjs.
import { puzzle } from './daily.js'
import { solveLikeAPlayer, VILLAGE_TECHNIQUES, LIGHT_TECHNIQUES, FERRY_TECHNIQUES, PILGRIM_TECHNIQUES } from './solver.js'
import { isValidBinarySolution, countBinarySolutions } from './binaryLogic.js'
import { censusHolds } from './census.js'
import { lighthousesHold } from './lighthouses.js'
import { ferriesHold } from './ferries.js'
import { pilgrimsHold } from './pilgrims.js'

const CLUE_MOVES = { villages: VILLAGE_TECHNIQUES, lighthouses: LIGHT_TECHNIQUES, ferries: FERRY_TECHNIQUES, pilgrims: PILGRIM_TECHNIQUES }

export function checkDay(day, tier) {
  const problems = []
  const p = puzzle(day, tier)
  const clues = { signs: p.signs, lights: p.lights, ferries: p.ferries, pilgrims: p.pilgrims }
  const { solved, steps } = solveLikeAPlayer(p.puzzle, undefined, clues)
  if (!solved) problems.push('a player can’t finish it')
  if (!isValidBinarySolution(p.solution)) problems.push('its answer is out of balance')
  if (!censusHolds(p.solution, p.signs) || !lighthousesHold(p.solution, p.lights) || !ferriesHold(p.solution, p.ferries) || !pilgrimsHold(p.solution, p.pilgrims)) problems.push('its answer breaks a clue')
  p.puzzle.forEach((row, r) => row.forEach((v, c) => { if (v !== null && v !== p.solution[r][c]) problems.push(`tile ${r},${c} disagrees with the answer`) }))
  const used = (techniques) => steps.some((step) => techniques.includes(step.technique))
  const lines = steps.filter((step) => step.technique === 'line').length
  if (tier === 'easy') {
    if (p.kinds.length) problems.push('an easy garden has clues')
    if (lines) problems.push('an easy garden needs whole-line reasoning')
    if (countBinarySolutions(p.puzzle) !== 1) problems.push('it has more than one answer')
  } else {
    if (tier === 'medium' && p.kinds.length !== 1) problems.push('a medium garden should have one kind of clue')
    if (tier === 'medium' && lines) problems.push('a medium garden needs whole-line reasoning')
    if (tier === 'hard' && p.kinds.length < 2) problems.push('a hard garden should mix clues')
    if (tier === 'hard' && lines < 2) problems.push('a hard garden should need whole-line reasoning')
    for (const kind of p.kinds) if (!used(CLUE_MOVES[kind])) problems.push(`its ${kind} never decide a tile`)
    if (solveLikeAPlayer(p.puzzle, ['pair', 'gap', 'count', 'line']).solved) problems.push('it can be finished without its clues')
  }
  return problems
}

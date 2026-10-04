import { isValidBinarySolution } from './binaryLogic.js'
import { easiestDeductions } from './solver.js'
import { PUZZLES } from './puzzles.js'
import { VILLAGE_PUZZLES } from './villagePuzzles.js'
import { censusViolations, censusHolds } from './census.js'
import { LIGHTHOUSE_PUZZLES } from './lighthousePuzzles.js'
import { lighthouseViolations, lighthousesHold } from './lighthouses.js'
import { FERRY_PUZZLES } from './ferryPuzzles.js'
import { ferryViolations, ferriesHold } from './ferries.js'
import { PILGRIM_PUZZLES } from './pilgrimPuzzles.js'
import { CROSSING_PUZZLES } from './crossingPuzzles.js'
import { ARCHIPELAGO_PUZZLES } from './archipelagoPuzzles.js'
import { pilgrimViolations, pilgrimsHold } from './pilgrims.js'

// v3: every chapter was regenerated at thirty gardens, so progress saved for the old ones no
// longer applies.
const STORAGE_KEY = 'tidal-garden.v3'
const DEV_KEY = 'tidal-garden.dev'
// Thirty names per chapter, in chapter order.
export const GARDEN_NAMES = [
  // Shallows
  'First light', 'Quiet currents', 'Emerald shallows', 'Soft horizons', 'Stillwater',
  'The jade coast', 'Morning dew', 'Hidden springs', 'A little wild', 'Gentle tides',
  'Silver ripples', 'Salt & sunlight', 'Green sanctuary', 'Drifting clouds', 'Low tide',
  'Sea glass', 'Secret garden', 'Distant shores', 'Moon pool', 'Tide line',
  'Kelp forest', 'Saltmarsh', 'Pebble cove', 'Still harbor', 'Coral garden',
  'Morning fog', 'Sandpiper', 'Driftwood', 'High water', 'A world in balance',
  // Villages
  'First hearth', 'Two chimneys', 'Fishing hamlet', 'Lantern row', 'Mossy roofs',
  'Market day', 'Hill cottages', 'Harbor lights', 'Kindling', 'Thatch and reed',
  'Bread oven', 'Little well', 'Goat path', 'Hay bales', 'Woodsmoke',
  'Weaving day', 'Garden plots', 'Rope swing', 'Village green', 'Bonfire night',
  'Apple store', 'Clay pots', 'Neighbors', 'Morning bell', 'Duck pond',
  'Long table', 'Sleepy lane', 'Warm windows', 'Gathering', 'Home',
  // Lighthouses
  'First light, again', 'Harbor watch', 'Long beam', 'Night ferry', 'Foghorn',
  'Keeper\'s isle', 'Two lamps', 'Starboard', 'Safe passage', 'Lamp oil',
  'Spiral stair', 'Gull rock', 'Watchtower', 'Tide clock', 'Lantern room',
  'Storm glass', 'Beacon hill', 'Port and starboard', 'North star', 'Signal fire',
  'Salt spray', 'Lens and prism', 'Hidden reef', 'Calm night', 'Keeper\'s log',
  'Far shore', 'Moonlit bay', 'Weathervane', 'Last watch', 'The guiding light',
  // Ferries
  'First crossing', 'Morning ferry', 'Island hopping', 'Two harbors', 'Slow waters',
  'The long way round', 'Ferry bells', 'Narrow straits', 'All aboard', 'Gangplank',
  'Ticket hut', 'Paddle steamer', 'Wake and foam', 'Sea breeze', 'Ropes and knots',
  'Upper deck', 'Ferryman', 'Tide tables', 'Crossing time', 'Harbor master',
  'Lifebuoy', 'Mooring', 'Little tugboat', 'Channel markers', 'Passenger list',
  'Calm crossing', 'Sound the horn', 'Evening run', 'Last sailing', 'Homeward bound',
  // Pilgrims
  'First steps', 'Lantern walk', 'Mossy steps', 'Two shrines', 'Quiet devotion',
  'The winding path', 'Temple bells', 'Pine needles', 'Long road', 'Straw hat',
  'Walking staff', 'Prayer flags', 'Stone steps', 'Bamboo grove', 'Incense',
  'Red gate', 'Mountain pass', 'Hermit\'s rest', 'Wayside shrine', 'Cherry petals',
  'Pilgrim\'s bundle', 'Tea stop', 'Morning chant', 'Stepping stones', 'Wind chimes',
  'Old cedar', 'Quiet valley', 'Dusk lanterns', 'Summit', 'Journey\'s end',
  // Crossings
  'Over land and sea', 'Bells and horns', 'Market crossing', 'Tea house', 'Harbor shrine',
  'Paper lanterns', 'Ferry and footpath', 'The old ways', 'Many paths', 'Two journeys',
  'Bridge of boats', 'Shore path', 'Landing stage', 'Sea and stone', 'Pier lanterns',
  'Foot and keel', 'Tidal causeway', 'Market boats', 'Crossroads', 'Salt road',
  'Lantern ferry', 'Busy harbor', 'Travelers', 'Sail and sandal', 'Waymarks',
  'Inn by the sea', 'Dock and shrine', 'Long voyage', 'Meeting point', 'All together',
  // Archipelago
  'Landfall', 'Busy waters', 'Smoke and lanterns', 'Island life', 'Beacon village',
  'The whole map', 'Fair winds', 'Old friends', 'Every shore', 'Chart room',
  'Compass rose', 'Island chain', 'Many hearths', 'Tidewater', 'Far isles',
  'Spice route', 'Island post', 'Seafarers', 'Bright harbor', 'Village lights',
  'Sea lanes', 'Atoll', 'Hidden cove', 'Sun and sail', 'Grand tour',
  'Lantern festival', 'Homecoming', 'The long summer', 'Twilight isles', 'The archipelago',
]
const GARDENS_BEFORE_ARCHIPELAGO = PUZZLES.length + VILLAGE_PUZZLES.length + LIGHTHOUSE_PUZZLES.length + FERRY_PUZZLES.length + PILGRIM_PUZZLES.length + CROSSING_PUZZLES.length
// The gardens come in chapters; later chapters add something new to read in the garden.
export const CHAPTERS = Object.freeze([
  { name: 'The Shallows', start: 0, count: PUZZLES.length },
  { name: 'The Villages', start: PUZZLES.length, count: VILLAGE_PUZZLES.length,
    intro: 'Each sign counts the land tiles of its island. Grow every village to its number.' },
  { name: 'The Lighthouses', start: PUZZLES.length + VILLAGE_PUZZLES.length, count: LIGHTHOUSE_PUZZLES.length,
    intro: 'Each lighthouse counts the water its light reaches before land. Light every one.' },
  { name: 'The Ferries', start: PUZZLES.length + VILLAGE_PUZZLES.length + LIGHTHOUSE_PUZZLES.length, count: FERRY_PUZZLES.length,
    intro: 'Docks with matching roofs must be joined by water, so their ferry can sail between them.' },
  { name: 'The Pilgrims', start: PUZZLES.length + VILLAGE_PUZZLES.length + LIGHTHOUSE_PUZZLES.length + FERRY_PUZZLES.length, count: PILGRIM_PUZZLES.length,
    intro: 'Shrines with matching lanterns must stand on the same island, so their pilgrim can walk between them.' },
  { name: 'The Crossings', start: PUZZLES.length + VILLAGE_PUZZLES.length + LIGHTHOUSE_PUZZLES.length + FERRY_PUZZLES.length + PILGRIM_PUZZLES.length, count: CROSSING_PUZZLES.length,
    intro: 'Ferries need water between their docks, and pilgrims need land between their shrines.' },
  { name: 'The Archipelago', start: GARDENS_BEFORE_ARCHIPELAGO, count: ARCHIPELAGO_PUZZLES.length,
    intro: 'Villages, lighthouses, ferries and pilgrims, all in one garden. Every clue still holds.' },
])
// Every garden carries its clues: census signs, lighthouses, ferry docks and shrines, any of which may be empty.
const withClues = (garden) => ({ signs: [], lights: [], ferries: [], pilgrims: [], ...garden })
export const GARDENS = Object.freeze([...PUZZLES, ...VILLAGE_PUZZLES, ...LIGHTHOUSE_PUZZLES, ...FERRY_PUZZLES, ...PILGRIM_PUZZLES, ...CROSSING_PUZZLES, ...ARCHIPELAGO_PUZZLES].map(withClues))
export const chapterOf = (level) => CHAPTERS.findLast((chapter) => level >= chapter.start) ?? CHAPTERS[0]
export const copyGrid = (grid) => grid.map((row) => [...row])

export function findViolations(grid, { signs = [], lights = [], ferries = [], pilgrims = [] } = {}) {
  const invalid = new Set([...censusViolations(grid, signs), ...lighthouseViolations(grid, lights), ...ferryViolations(grid, ferries), ...pilgrimViolations(grid, pilgrims)])
  const size = grid.length
  const lines = [
    ...grid.map((values, row) => ({ values, cells: values.map((_, col) => [row, col]) })),
    ...grid.map((_, col) => ({ values: grid.map((row) => row[col]), cells: grid.map((_, row) => [row, col]) })),
  ]
  const add = (cell) => invalid.add(cell.join(':'))
  for (const line of lines) {
    for (const value of [0, 1]) {
      if (line.values.filter((v) => v === value).length > size / 2) {
        line.values.forEach((v, i) => { if (v === value) add(line.cells[i]) })
      }
    }
    for (let i = 0; i <= size - 3; i++) {
      if (line.values[i] !== null && line.values[i] === line.values[i + 1] && line.values[i] === line.values[i + 2]) {
        line.cells.slice(i, i + 3).forEach(add)
      }
    }
  }
  for (let axis = 0; axis < 2; axis++) {
    const group = lines.slice(axis * size, (axis + 1) * size)
    for (let a = 0; a < size; a++) {
      if (group[a].values.includes(null)) continue
      for (let b = a + 1; b < size; b++) {
        if (group[a].values.every((v, i) => v === group[b].values[i])) {
          group[a].cells.forEach(add)
          group[b].cells.forEach(add)
        }
      }
    }
  }
  return invalid
}

// The easiest move available right now, matching the garden's solution, and why it works.
export function findHint(grid, solution, { signs = [], lights = [], ferries = [], pilgrims = [] } = {}) {
  const next = easiestDeductions(grid, undefined, { signs, lights, ferries, pilgrims })
  if (!next) return null
  const move = next.deductions.find(({ row, col, value }) => !solution || solution[row][col] === value)
  if (!move) return null
  return { row: move.row, col: move.col, value: move.value, technique: move.technique, axis: move.line.axis }
}

export class GardenGame {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    this.level = 0
    this.selected = 0
    this.history = []
    this.completed = []
    this.seconds = 0
    this.grids = {}
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')
      if (saved && saved.version === 1) {
        this.completed = Array.isArray(saved.completed) ? saved.completed.filter((v) => Number.isInteger(v) && v >= 0 && v < GARDENS.length) : []
        this.grids = saved.grids && typeof saved.grids === 'object' ? saved.grids : {}
        this.level = Number.isInteger(saved.level) && saved.level >= 0 && saved.level < GARDENS.length ? saved.level : 0
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
    this.load(this.level)
  }

  load(level) {
    this.level = level
    this.puzzle = GARDENS[level]
    const saved = this.grids[level]
    const isValidSavedGrid = (grid) => Array.isArray(grid) && grid.length === 10 && grid.every((row, r) => Array.isArray(row) && row.length === 10 && row.every((v, c) => [null, 0, 1].includes(v) && (this.puzzle.puzzle[r][c] === null || this.puzzle.puzzle[r][c] === v)))
    const validGrid = isValidSavedGrid(saved?.grid)
    this.grid = copyGrid(validGrid ? saved.grid : this.puzzle.puzzle)
    this.seconds = validGrid && Number.isFinite(saved.seconds) ? Math.max(0, saved.seconds) : 0
    this.history = validGrid && Array.isArray(saved.history)
      ? saved.history.filter(isValidSavedGrid).map(copyGrid)
      : []
    this.save()
  }

  // Gardens open in order: the first is always open, and finishing one opens the next. A garden
  // already finished, or the one being played, stays open. A hidden developer switch opens them all.
  isOpen(level) {
    return level === 0 || level === this.level || this.completed.includes(level) || this.completed.includes(level - 1)
  }

  isUnlocked(level) { return this.unlockAll || this.isOpen(level) }

  get unlockAll() {
    try { return this.storage?.getItem(DEV_KEY) === 'all' } catch { return false }
  }

  set unlockAll(on) {
    try { if (on) this.storage?.setItem(DEV_KEY, 'all'); else this.storage?.removeItem(DEV_KEY) } catch { /* Fine without. */ }
  }

  // The newest garden open to play the ordinary way: the furthest one along the map that isn't
  // finished yet. (Gardens opened by the developer switch don't move it.)
  get frontier() {
    for (let level = GARDENS.length - 1; level >= 0; level--) if (this.isOpen(level) && !this.completed.includes(level)) return level
    return GARDENS.length - 1
  }

  // Finished means a balanced garden whose every village and lighthouse matches its number, and
  // whose every pair of docks is joined by water and every pair of shrines by land.
  get complete() { return isValidBinarySolution(this.grid) && censusHolds(this.grid, this.puzzle.signs) && lighthousesHold(this.grid, this.puzzle.lights) && ferriesHold(this.grid, this.puzzle.ferries) && pilgrimsHold(this.grid, this.puzzle.pilgrims) }
  get filled() { return this.grid.flat().filter((v) => v !== null).length }
  get placed() { return this.filled - this.puzzle.puzzle.flat().filter((v) => v !== null).length }
  get remaining() { return 100 - this.filled }

  place(row, col, value = this.selected) {
    if (this.complete || this.puzzle.puzzle[row][col] !== null || this.grid[row][col] === value) return false
    this.history.push(copyGrid(this.grid))
    this.grid[row][col] = value
    if (this.complete && !this.completed.includes(this.level)) this.completed.push(this.level)
    this.save()
    return true
  }

  undo() {
    if (!this.history.length) return false
    this.grid = this.history.pop()
    this.save()
    return true
  }

  reset() {
    this.grid = copyGrid(this.puzzle.puzzle)
    this.history = []
    this.seconds = 0
    this.save()
  }

  // Clears every garden: nothing finished, no tiles, no times, back to the first garden.
  resetAll() {
    this.completed = []
    this.grids = {}
    this.selected = 0
    this.load(0)
  }

  save() {
    this.grids[this.level] = { grid: this.grid, history: this.history, seconds: this.seconds }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, level: this.level, completed: this.completed, grids: this.grids }))
    } catch { /* Playing does not depend on storage access. */ }
  }
}

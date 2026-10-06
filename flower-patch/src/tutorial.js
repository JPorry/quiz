// The guided garden, after Tidal Garden's coach. A card above the garden walks
// a new player through the rules one at a time, each shown on a real plot of
// their own board: one of each seed in a bed, never the same seed side by side,
// then flags for notes. The coach points at what to pick (a seed bag, the Flags
// button, a flag), makes the plot to tap glow, and rings the plots that decide it.
import { t } from './i18n.js'

const STORAGE_KEY = 'flower-patch.tutorial'
const LESSONS = ['bed', 'touch', 'flags', 'putaway']

const bit = (v) => 1 << v
const count = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n }
const lowest = (m) => 31 - Math.clz32(m & -m)

// The seeds each empty plot could still take, given what is planted around it.
export function options(board, values) {
  return Array.from({ length: board.cells }, (_, i) => {
    if (values[i]) return 0
    let m = bit(board.size[i] + 1) - 2
    for (const j of board.peers[i]) if (values[j]) m &= ~bit(values[j])
    return m
  })
}

// The coach shows each idea in a plot near the middle of the garden, where it's
// easiest to see and tap.
const nearest = (board, moves) => {
  const away = ({ cell }) => Math.hypot((cell % board.width) - (board.width - 1) / 2, Math.floor(cell / board.width) - (board.height - 1) / 2)
  return [...moves].sort((a, b) => away(a) - away(b))[0] ?? null
}
// every move matches the garden's solution, so the coach never teaches a mistake
const right = (board) => (m) => !board.solution || board.solution[m.cell] === m.value

// A plot one rule decides right now, with the plots that decide it.
//   bed    the last seed missing from a bed has one plot left for it
//   touch  the plot's bed allows more than one seed, but the seeds next to it
//          rule out all but one
//   flags  a seed that can only go in one of two plots of a bed: both get a flag
export function findLesson(board, values, rule) {
  const can = options(board, values)
  const moves = []
  if (rule === 'bed') {
    board.beds.forEach((bed) => {
      const open = bed.filter((i) => !values[i])
      if (!open.length) return
      for (let v = 1; v <= bed.length; v++) {
        if (bed.some((i) => values[i] === v)) continue
        const spots = open.filter((i) => can[i] & bit(v))
        if (spots.length !== 1) continue
        const last = open.length === 1
        // the bed's own seeds say what's missing; otherwise the seeds next door
        // that keep this one out of the bed's other open plots
        const because = last ? bed.filter((i) => values[i])
          : [...new Set(open.filter((i) => i !== spots[0]).flatMap((i) => board.peers[i].filter((j) => values[j] === v)))]
        moves.push({ cell: spots[0], value: v, because, last, size: bed.length })
      }
    })
    // best of all, a bed with a single plot left: the rule at its plainest
    const last = moves.filter((m) => m.last && right(board)(m))
    if (last.length) return nearest(board, last)
  }
  if (rule === 'touch') {
    for (let i = 0; i < board.cells; i++) {
      if (values[i] || count(can[i]) !== 1) continue
      // what the bed alone would allow
      let inBed = bit(board.size[i] + 1) - 2
      for (const j of board.beds[board.bedOf[i]]) if (values[j]) inBed &= ~bit(values[j])
      if (count(inBed) < 2) continue
      const because = board.around[i].filter((j) => board.bedOf[j] !== board.bedOf[i] && values[j] && inBed & bit(values[j]))
      if (because.length) moves.push({ cell: i, value: lowest(can[i]), because })
    }
  }
  if (rule === 'flags') {
    board.beds.forEach((bed) => {
      for (let v = 1; v <= bed.length; v++) {
        if (bed.some((i) => values[i] === v)) continue
        const spots = bed.filter((i) => !values[i] && can[i] & bit(v))
        if (spots.length === 2) moves.push({ cell: spots[0], value: v, cells: spots, because: [] })
      }
    })
    const pairs = moves.filter((m) => !board.solution || m.cells.some((i) => board.solution[i] === m.value))
    return nearest(board, pairs)
  }
  return nearest(board, moves.filter(right(board)))
}

export class Tutorial {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    try { this.finished = storage?.getItem(STORAGE_KEY) === 'done' } catch { this.finished = false }
    this.step = 'welcome'
    this.lesson = null
  }

  get active() { return !this.finished }

  finish() {
    this.finished = true
    this.step = 'done'
    this.lesson = null
    try { this.storage?.setItem(STORAGE_KEY, 'done') } catch { /* Shown again, which is harmless. */ }
  }

  // From the welcome again, in the next garden opened.
  restart() {
    this.finished = false
    this.step = 'welcome'
    this.lesson = null
    try { this.storage?.removeItem(STORAGE_KEY) } catch { /* Fine without. */ }
  }

  // The coach's button: past the welcome, or done after the last word.
  next() {
    if (this.step === 'welcome') this.step = LESSONS[0]
    else if (this.step === 'outro') this.finish()
  }

  // A garden opened part way through the lessons picks up the current one
  // afresh, on its own board.
  forget() { this.lesson = null }

  // What the coach shows now, or null. `play` is the garden as it stands: the
  // board, the seeds and flags planted, the number picked, whether the tray
  // holds flags, and whether the garden is finished.
  card({ board, values, marks, seed, marking, won }) {
    if (this.finished) return null
    if (won) { this.finish(); return null }
    if (this.step === 'welcome') return { step: 'welcome', title: t('coach.welcome'), text: t('coach.welcomeText'), action: t('coach.begin') }
    // a lesson ends once its plot holds the right seed (or both plots their flags)
    while (LESSONS.includes(this.step)) {
      const m = this.lesson
      const learnt = this.step === 'putaway' ? !marking
        : m && (this.step === 'flags' ? m.cells.every((i) => marks[i] & bit(m.value - 1) || values[i]) : values[m.cell] === m.value)
      if (learnt) {
        this.lesson = null
        this.step = LESSONS[LESSONS.indexOf(this.step) + 1] ?? 'outro'
        continue
      }
      if (!m && this.step !== 'putaway') this.lesson = findLesson(board, values, this.step)
      break
    }
    if (this.step === 'outro') return { step: 'outro', title: t('coach.outro'), text: t('coach.outroText'), action: t('coach.gotIt') }
    if (this.step === 'putaway') return { step: 'putaway', title: t('coach.putaway'), text: t('coach.putawayText'), instruction: t('coach.tapSeeds'), pick: 'markers' }
    const m = this.lesson
    // the board doesn't show the idea yet: plant on until it does
    if (!m) return { step: 'practice', title: t('coach.keepGoing'), text: t('coach.keepGoingText') }
    const text = t(`coach.${this.step}${this.step === 'bed' && !m.last ? 'Hidden' : ''}Text`, { n: m.value, size: m.size })
    if (this.step === 'flags') {
      // first the Flags button, then the flag, then each plot still without one
      const left = m.cells.filter((i) => !(marks[i] & bit(m.value - 1)) && !values[i])
      const instruction = !marking ? t('coach.tapFlags') : seed !== m.value ? t('coach.pickFlag', { n: m.value }) : t('coach.tapPlots')
      const pick = !marking ? 'markers' : seed !== m.value ? m.value : null
      return { step: 'flags', title: t('coach.flags'), text, instruction, pick, target: left, because: m.cells.filter((i) => !left.includes(i)) }
    }
    const wrong = values[m.cell] && values[m.cell] !== m.value
    const instruction = wrong ? t('coach.wrong') : marking ? t('coach.tapSeeds') : seed !== m.value ? t('coach.pick', { n: m.value }) : t('coach.tap')
    const pick = wrong ? null : marking ? 'markers' : seed !== m.value ? m.value : null
    return { step: this.step, title: t(`coach.${this.step}`), text, instruction, pick, target: [m.cell], because: m.because }
  }
}

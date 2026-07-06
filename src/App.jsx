import { useEffect, useMemo, useState } from 'react'
import './App.css'

const PUZZLES = [
  {
    name: 'Apricot',
    solution: [
      [1, 0, 1, 0, 1, 0],
      [0, 0, 1, 1, 0, 1],
      [0, 1, 0, 1, 1, 0],
      [1, 1, 0, 0, 1, 0],
      [1, 0, 1, 0, 0, 1],
      [0, 1, 0, 1, 0, 1],
    ],
    puzzle: [
      [1, null, null, 0, null, null],
      [0, null, null, 1, 0, null],
      [0, 1, null, 1, 1, null],
      [null, 1, 0, null, null, 0],
      [null, null, null, 0, null, null],
      [0, null, null, null, null, 1],
    ],
  },
  {
    name: 'Lagoon',
    solution: [
      [1, 1, 0, 0, 1, 0],
      [1, 0, 0, 1, 0, 1],
      [0, 0, 1, 1, 0, 1],
      [0, 1, 1, 0, 1, 0],
      [1, 1, 0, 1, 0, 0],
      [0, 0, 1, 0, 1, 1],
    ],
    puzzle: [
      [1, null, 0, null, null, null],
      [null, 0, null, 1, 0, null],
      [0, null, 1, 1, null, null],
      [null, null, 1, null, 1, null],
      [null, 1, null, 1, null, 0],
      [null, 0, null, null, null, 1],
    ],
  },
  {
    name: 'Mulberry',
    solution: [
      [0, 1, 0, 0, 1, 1],
      [1, 0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 1],
      [0, 1, 0, 1, 1, 0],
      [1, 0, 1, 1, 0, 0],
      [1, 0, 1, 0, 0, 1],
    ],
    puzzle: [
      [0, null, null, null, 1, null],
      [null, 0, null, 1, null, 0],
      [null, 1, 1, null, null, null],
      [0, null, null, 1, null, 0],
      [null, null, 1, null, 0, 0],
      [1, null, null, 0, null, null],
    ],
  },
]

const SIZE = 6

function copyGrid(grid) {
  return grid.map((row) => [...row])
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function findViolations(grid) {
  const invalid = new Set()
  const add = (row, column) => invalid.add(`${row}-${column}`)

  for (let index = 0; index < SIZE; index += 1) {
    const row = grid[index]
    const column = grid.map((line) => line[index])

    for (const [values, isColumn] of [
      [row, false],
      [column, true],
    ]) {
      for (const value of [0, 1]) {
        if (values.filter((item) => item === value).length > SIZE / 2) {
          values.forEach((item, position) => {
            if (item === value) {
              if (isColumn) add(position, index)
              else add(index, position)
            }
          })
        }
      }

      for (let start = 0; start <= SIZE - 3; start += 1) {
        const trio = values.slice(start, start + 3)
        if (trio[0] !== null && trio.every((value) => value === trio[0])) {
          trio.forEach((_, offset) => {
            if (isColumn) add(start + offset, index)
            else add(index, start + offset)
          })
        }
      }
    }
  }

  const completedRows = grid
    .map((row, index) => ({ index, value: row.join('') }))
    .filter(({ value }) => value.length === SIZE)
  const completedColumns = Array.from({ length: SIZE }, (_, column) => ({
    index: column,
    value: grid.map((row) => row[column]).join(''),
  })).filter(({ value }) => value.length === SIZE)

  for (const [lines, isColumn] of [
    [completedRows, false],
    [completedColumns, true],
  ]) {
    lines.forEach((line, position) => {
      const duplicate = lines.find(
        (candidate, candidatePosition) =>
          candidatePosition !== position && candidate.value === line.value,
      )
      if (duplicate) {
        for (let cell = 0; cell < SIZE; cell += 1) {
          if (isColumn) add(cell, line.index)
          else add(line.index, cell)
        }
      }
    })
  }

  return invalid
}

function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [grid, setGrid] = useState(() => copyGrid(PUZZLES[0].puzzle))
  const [seconds, setSeconds] = useState(0)
  const [showRules, setShowRules] = useState(false)
  const currentPuzzle = PUZZLES[puzzleIndex]
  const invalidCells = useMemo(() => findViolations(grid), [grid])
  const filledCells = grid.flat().filter((value) => value !== null).length
  const isComplete =
    filledCells === SIZE * SIZE &&
    invalidCells.size === 0 &&
    grid.every((row, rowIndex) =>
      row.every(
        (value, columnIndex) =>
          value === currentPuzzle.solution[rowIndex][columnIndex],
      ),
    )

  useEffect(() => {
    if (isComplete) return undefined
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isComplete, puzzleIndex])

  const loadPuzzle = (index) => {
    setPuzzleIndex(index)
    setGrid(copyGrid(PUZZLES[index].puzzle))
    setSeconds(0)
  }

  const cycleCell = (row, column) => {
    if (currentPuzzle.puzzle[row][column] !== null || isComplete) return

    setGrid((currentGrid) => {
      const nextGrid = copyGrid(currentGrid)
      const value = nextGrid[row][column]
      nextGrid[row][column] = value === null ? 0 : value === 0 ? 1 : null
      return nextGrid
    })
  }

  const resetPuzzle = () => {
    setGrid(copyGrid(currentPuzzle.puzzle))
    setSeconds(0)
  }

  const nextPuzzle = () => {
    loadPuzzle((puzzleIndex + 1) % PUZZLES.length)
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Twofold home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>Twofold</span>
        </a>
        <button
          className="icon-button"
          type="button"
          aria-label="How to play"
          aria-expanded={showRules}
          onClick={() => setShowRules((visible) => !visible)}
        >
          ?
        </button>
      </header>

      <section className="game-card" aria-labelledby="game-title">
        <div className="title-row">
          <div>
            <p className="kicker">Binary puzzle · 6 × 6</p>
            <h1 id="game-title">Daily balance</h1>
          </div>
          <div className="timer" aria-label={`Elapsed time ${formatTime(seconds)}`}>
            <span aria-hidden="true">◷</span>
            {formatTime(seconds)}
          </div>
        </div>

        {showRules && (
          <aside className="rules-panel">
            <div>
              <strong>Keep it balanced</strong>
              <p>Each row and column needs three 0s and three 1s.</p>
            </div>
            <div>
              <strong>Pairs only</strong>
              <p>Never place three matching numbers next to each other.</p>
            </div>
            <div>
              <strong>Make every line unique</strong>
              <p>No two completed rows or columns can be identical.</p>
            </div>
          </aside>
        )}

        <div className="progress-block">
          <div className="progress-label">
            <span>{currentPuzzle.name}</span>
            <span>{filledCells} / {SIZE * SIZE}</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${(filledCells / (SIZE * SIZE)) * 100}%` }} />
          </div>
        </div>

        <div
          className={`puzzle-grid${isComplete ? ' is-complete' : ''}`}
          role="grid"
          aria-label="Six by six binary puzzle"
        >
          {grid.map((row, rowIndex) =>
            row.map((value, columnIndex) => {
              const isGiven =
                currentPuzzle.puzzle[rowIndex][columnIndex] !== null
              const isInvalid = invalidCells.has(`${rowIndex}-${columnIndex}`)

              return (
                <button
                  className={[
                    'cell',
                    value === 0 ? 'zero' : '',
                    value === 1 ? 'one' : '',
                    isGiven ? 'given' : '',
                    isInvalid ? 'invalid' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  role="gridcell"
                  key={`${rowIndex}-${columnIndex}`}
                  disabled={isGiven || isComplete}
                  aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: ${
                    value === null ? 'empty' : value
                  }${isGiven ? ', fixed' : ''}${isInvalid ? ', rule conflict' : ''}`}
                  onClick={() => cycleCell(rowIndex, columnIndex)}
                >
                  {value}
                  {isGiven && <span className="given-dot" aria-hidden="true" />}
                </button>
              )
            }),
          )}
        </div>

        <p className={`game-message${invalidCells.size ? ' has-error' : ''}`} aria-live="polite">
          {isComplete
            ? 'Beautifully balanced — puzzle complete!'
            : invalidCells.size
              ? 'A rule is being bent. Check the highlighted cells.'
              : 'Tap a square to cycle through 0, 1, and empty.'}
        </p>

        <div className="actions">
          <button className="secondary-button" type="button" onClick={resetPuzzle}>
            <span aria-hidden="true">↺</span>
            Reset
          </button>
          <button className="primary-button" type="button" onClick={nextPuzzle}>
            {isComplete ? 'Next puzzle' : 'New puzzle'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <footer>
        <span>Three simple rules.</span>
        <span>One logical solution.</span>
      </footer>
    </main>
  )
}

export default App

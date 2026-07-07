import { useCallback, useEffect, useMemo, useState } from 'react'
import { Grid } from './components/Grid.jsx'
import { PUZZLES, SIZE } from './puzzles.js'
import './App.css'

const QUOTA = SIZE / 2

function copyGrid(grid) {
  return grid.map((row) => [...row])
}

function cellKey(row, column) {
  return `${row}-${column}`
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function countValue(values, target) {
  return values.filter((value) => value === target).length
}

function lineValue(grid, index, isColumn) {
  return isColumn ? grid.map((row) => row[index]) : grid[index]
}

function addLineCells(targetSet, lineIndex, isColumn) {
  for (let position = 0; position < SIZE; position += 1) {
    targetSet.add(isColumn ? cellKey(position, lineIndex) : cellKey(lineIndex, position))
  }
}

function analyzeBoard(grid) {
  const invalidCells = new Set()
  const adjacencyCells = new Set()
  const hintedCells = new Map()

  const add = (targetSet, row, column) => targetSet.add(cellKey(row, column))
  const addHint = (row, column, value) => {
    const key = cellKey(row, column)
    const existingValue = hintedCells.get(key)

    if (existingValue === undefined || existingValue === value) {
      hintedCells.set(key, value)
    }
  }

  for (let index = 0; index < SIZE; index += 1) {
    for (const isColumn of [false, true]) {
      const values = lineValue(grid, index, isColumn)

      for (const value of [0, 1]) {
        const total = countValue(values, value)

        if (total > QUOTA) {
          values.forEach((item, position) => {
            if (item === value) {
              if (isColumn) add(invalidCells, position, index)
              else add(invalidCells, index, position)
            }
          })
        }

        if (total === QUOTA) {
          values.forEach((item, position) => {
            if (item === null) {
              if (isColumn) addHint(position, index, value === 0 ? 1 : 0)
              else addHint(index, position, value === 0 ? 1 : 0)
            }
          })
        }
      }

      for (let start = 0; start <= SIZE - 3; start += 1) {
        const trio = values.slice(start, start + 3)

        if (trio[0] !== null && trio.every((value) => value === trio[0])) {
          trio.forEach((_, offset) => {
            if (isColumn) {
              add(invalidCells, start + offset, index)
              add(adjacencyCells, start + offset, index)
            } else {
              add(invalidCells, index, start + offset)
              add(adjacencyCells, index, start + offset)
            }
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
        addLineCells(invalidCells, line.index, isColumn)
      }
    })
  }

  return { invalidCells, adjacencyCells, hintedCells }
}

function selectorLabel(value) {
  if (value === 0) return 'Log'
  if (value === 1) return 'Water'
  return 'Eraser'
}

function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [grid, setGrid] = useState(() => copyGrid(PUZZLES[0].puzzle))
  const [seconds, setSeconds] = useState(0)
  const [showRules, setShowRules] = useState(false)
  const [selectedValue, setSelectedValue] = useState(0)
  const currentPuzzle = PUZZLES[puzzleIndex]
  const { invalidCells, adjacencyCells, hintedCells } = useMemo(
    () => analyzeBoard(grid),
    [grid],
  )
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

    const timer = window.setInterval(() => {
      setSeconds((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isComplete, puzzleIndex])

  const loadPuzzle = useCallback((index) => {
    setPuzzleIndex(index)
    setGrid(copyGrid(PUZZLES[index].puzzle))
    setSeconds(0)
  }, [])

  const fillCell = useCallback(
    (row, column) => {
      if (currentPuzzle.puzzle[row][column] !== null || isComplete) return

      setGrid((currentGrid) => {
        if (currentGrid[row][column] === selectedValue) return currentGrid

        const nextGrid = copyGrid(currentGrid)
        nextGrid[row][column] = selectedValue
        return nextGrid
      })
    },
    [currentPuzzle.puzzle, isComplete, selectedValue],
  )

  const resetPuzzle = useCallback(() => {
    setGrid(copyGrid(currentPuzzle.puzzle))
    setSeconds(0)
  }, [currentPuzzle.puzzle])

  const nextPuzzle = useCallback(() => {
    loadPuzzle((puzzleIndex + 1) % PUZZLES.length)
  }, [loadPuzzle, puzzleIndex])

  return (
    <main className="game-shell">
      <header className="flex shrink-0 items-center justify-between">
        <a
          className="inline-flex items-center gap-3 text-sm font-black tracking-[0.28em] text-teal-950 no-underline dark:text-emerald-50"
          href="./"
          aria-label="Hydro Logic home"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          HYDRO LOGIC
        </a>
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-teal-950/10 bg-white/55 text-lg font-black text-teal-950 shadow-sm backdrop-blur transition hover:bg-white/80 dark:border-emerald-100/15 dark:bg-emerald-50/10 dark:text-emerald-50"
          type="button"
          aria-label="How to play"
          aria-expanded={showRules}
          onClick={() => setShowRules((visible) => !visible)}
        >
          ?
        </button>
      </header>

      <section
        className="game-card"
        aria-labelledby="game-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.68rem] font-black uppercase tracking-[0.2em] text-teal-700/70 dark:text-cyan-100/65">
              Cozy Takuzu · {SIZE} × {SIZE}
            </p>
            <h1
              id="game-title"
              className="m-0 font-serif text-[clamp(1.95rem,8vw,3.4rem)] font-medium leading-none tracking-[-0.06em] text-teal-950 dark:text-emerald-50"
            >
              Balance the river
            </h1>
          </div>
          <div
            className="flex shrink-0 items-center gap-2 rounded-full bg-teal-950/5 px-3 py-2 text-sm font-extrabold tabular-nums text-teal-900/65 dark:bg-emerald-50/10 dark:text-emerald-50/70"
            aria-label={`Elapsed time ${formatTime(seconds)}`}
          >
            <span aria-hidden="true">◷</span>
            {formatTime(seconds)}
          </div>
        </div>

        {showRules && (
          <aside className="rules-panel">
            <div>
              <strong>Balanced banks</strong>
              <p>Each row and column needs five Logs and five Water Streams.</p>
            </div>
            <div>
              <strong>No pileups</strong>
              <p>Never place three matching ecosystem pieces side by side.</p>
            </div>
            <div>
              <strong>Natural variety</strong>
              <p>No two completed rows or columns can share the same pattern.</p>
            </div>
          </aside>
        )}

        <div className="mt-3 shrink-0">
          <div className="mb-2 flex justify-between text-[0.72rem] font-extrabold text-teal-800/60 dark:text-cyan-100/60">
            <span>{currentPuzzle.name} watershed</span>
            <span>
              {filledCells} / {SIZE * SIZE}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-teal-950/10 dark:bg-emerald-50/10" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-amber-700 via-emerald-500 to-sky-500 transition-[width] duration-300"
              style={{ width: `${(filledCells / (SIZE * SIZE)) * 100}%` }}
            />
          </div>
        </div>

        <Grid
          grid={grid}
          givens={currentPuzzle.puzzle}
          invalidCells={invalidCells}
          adjacencyCells={adjacencyCells}
          hintedCells={hintedCells}
          isComplete={isComplete}
          onCellPress={fillCell}
        />

        <div className="input-palette" role="group" aria-label="Choose a river piece">
          <span className="hidden px-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-teal-800/55 sm:block dark:text-cyan-100/55">
            Place
          </span>
          <button
            className={`value-button is-log${selectedValue === 0 ? ' selected' : ''}`}
            type="button"
            aria-label="Place a Log"
            aria-pressed={selectedValue === 0}
            onClick={() => setSelectedValue(0)}
          >
            <span aria-hidden="true" className="selector-icon selector-log" />
            Log
          </button>
          <button
            className={`value-button is-water${selectedValue === 1 ? ' selected' : ''}`}
            type="button"
            aria-label="Place a Water Stream"
            aria-pressed={selectedValue === 1}
            onClick={() => setSelectedValue(1)}
          >
            <span aria-hidden="true" className="selector-icon selector-water" />
            Water
          </button>
          <button
            className={`erase-button${selectedValue === null ? ' selected' : ''}`}
            type="button"
            aria-label="Erase a river piece"
            aria-pressed={selectedValue === null}
            onClick={() => setSelectedValue(null)}
          >
            <span aria-hidden="true">⌫</span>
            Erase
          </button>
        </div>

        <p
          className={`min-h-10 shrink-0 text-center text-sm leading-snug ${
            invalidCells.size
              ? 'font-bold text-rose-700 dark:text-rose-300'
              : 'text-teal-900/62 dark:text-cyan-100/62'
          }`}
          aria-live="polite"
        >
          {isComplete
            ? 'The watershed is beautifully balanced.'
            : invalidCells.size
              ? 'Something is crowding the river. Check the glowing cells.'
              : selectedValue === null
                ? 'Eraser ready. Tap any open square to clear it.'
                : `Placing ${selectorLabel(selectedValue)}. Tap an open river slot.`}
        </p>

        <div className="grid shrink-0 grid-cols-[0.85fr_1.25fr] gap-3">
          <button className="secondary-button" type="button" onClick={resetPuzzle}>
            <span aria-hidden="true">↺</span>
            Reset
          </button>
          <button className="primary-button" type="button" onClick={nextPuzzle}>
            {isComplete ? 'Next river' : 'New puzzle'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <footer className="flex shrink-0 justify-between px-2 pt-3 text-[0.68rem] font-semibold text-teal-900/45 dark:text-cyan-100/45">
        <span>Logs are 0.</span>
        <span>Water is 1.</span>
      </footer>
    </main>
  )
}

export default App

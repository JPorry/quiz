import { useEffect, useMemo, useRef, useState } from 'react'
import { HASHI_PUZZLES } from './hashiPuzzles.js'
import {
  edgeId,
  getHashiDegrees,
  getHashiEdges,
  hasCrossingBridge,
  isHashiComplete,
  isHashiConnected,
} from './hashiLogic.js'
import { PUZZLES, SIZE } from './puzzles.js'
import './App.css'

const BINARY_COMPLETED_STORAGE_KEY = 'twofold.completedLevels'
const HASHI_COMPLETED_STORAGE_KEY = 'twofold.hashi.completedLevels'

function copyGrid(grid) {
  return grid.map((row) => [...row])
}

function readCompletedLevels(storageKey, validIds) {
  try {
    const savedValue = window.localStorage.getItem(storageKey)
    const parsedValue = savedValue ? JSON.parse(savedValue) : []
    return Array.isArray(parsedValue)
      ? parsedValue.filter((id) => validIds.includes(id))
      : []
  } catch {
    return []
  }
}

function saveCompletedLevels(storageKey, completedLevelIds) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(completedLevelIds))
  } catch {
    // Progress persistence is helpful, but the puzzles should still work if storage is unavailable.
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function findBinaryViolations(grid) {
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

function LevelList({ levels, currentIndex, completedLevelSet, onSelect }) {
  return (
    <div className="level-list" aria-label="Choose a level">
      {levels.map((level, index) => {
        const isCurrent = index === currentIndex
        const isSolved = completedLevelSet.has(level.id)

        return (
          <button
            className={[
              'level-button',
              isCurrent ? 'current' : '',
              isSolved ? 'solved' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            type="button"
            key={level.id}
            aria-current={isCurrent ? 'true' : undefined}
            aria-label={`${level.name}${isSolved ? ', completed' : ''}`}
            onClick={() => onSelect(index)}
          >
            <span>{index + 1}</span>
            {isSolved && <span aria-hidden="true">✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function BinaryGame({ showRules }) {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [grid, setGrid] = useState(() => copyGrid(PUZZLES[0].puzzle))
  const [seconds, setSeconds] = useState(0)
  const [selectedValue, setSelectedValue] = useState(0)
  const [completedLevelIds, setCompletedLevelIds] = useState(() =>
    readCompletedLevels(
      BINARY_COMPLETED_STORAGE_KEY,
      PUZZLES.map((puzzle) => puzzle.id),
    ),
  )
  const currentPuzzle = PUZZLES[puzzleIndex]
  const completedLevelSet = useMemo(
    () => new Set(completedLevelIds),
    [completedLevelIds],
  )
  const invalidCells = useMemo(() => findBinaryViolations(grid), [grid])
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

  useEffect(() => {
    if (!isComplete || completedLevelSet.has(currentPuzzle.id)) return

    setCompletedLevelIds((currentIds) => {
      if (currentIds.includes(currentPuzzle.id)) return currentIds

      const nextIds = [...currentIds, currentPuzzle.id]
      saveCompletedLevels(BINARY_COMPLETED_STORAGE_KEY, nextIds)
      return nextIds
    })
  }, [completedLevelSet, currentPuzzle.id, isComplete])

  const loadPuzzle = (index) => {
    setPuzzleIndex(index)
    setGrid(copyGrid(PUZZLES[index].puzzle))
    setSeconds(0)
  }

  const fillCell = (row, column) => {
    if (currentPuzzle.puzzle[row][column] !== null || isComplete) return

    setGrid((currentGrid) => {
      const nextGrid = copyGrid(currentGrid)
      nextGrid[row][column] = selectedValue
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
    <section className="game-card" aria-labelledby="game-title">
      <div className="title-row">
        <div>
          <p className="kicker">Binary puzzle · 10 × 10</p>
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
            <p>Each row and column needs five 0s and five 1s.</p>
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
          <span>
            {completedLevelIds.length} / {PUZZLES.length} complete
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${(filledCells / (SIZE * SIZE)) * 100}%` }} />
        </div>
      </div>

      <LevelList
        levels={PUZZLES}
        currentIndex={puzzleIndex}
        completedLevelSet={completedLevelSet}
        onSelect={loadPuzzle}
      />

      <div
        className={`puzzle-grid${isComplete ? ' is-complete' : ''}`}
        role="grid"
        aria-label="Ten by ten binary puzzle"
      >
        {grid.map((row, rowIndex) =>
          row.map((value, columnIndex) => {
            const isGiven = currentPuzzle.puzzle[rowIndex][columnIndex] !== null
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
                onClick={() => fillCell(rowIndex, columnIndex)}
              >
                {value}
                {isGiven && <span className="given-dot" aria-hidden="true" />}
              </button>
            )
          }),
        )}
      </div>

      <div className="input-palette" role="group" aria-label="Choose a value">
        <span className="palette-label">Place</span>
        <button
          className={`value-button zero${selectedValue === 0 ? ' selected' : ''}`}
          type="button"
          aria-label="Place zero"
          aria-pressed={selectedValue === 0}
          onClick={() => setSelectedValue(0)}
        >
          0
        </button>
        <button
          className={`value-button one${selectedValue === 1 ? ' selected' : ''}`}
          type="button"
          aria-label="Place one"
          aria-pressed={selectedValue === 1}
          onClick={() => setSelectedValue(1)}
        >
          1
        </button>
        <button
          className={`erase-button${selectedValue === null ? ' selected' : ''}`}
          type="button"
          aria-label="Erase a value"
          aria-pressed={selectedValue === null}
          onClick={() => setSelectedValue(null)}
        >
          <span aria-hidden="true">⌫</span>
          Erase
        </button>
      </div>

      <p className={`game-message${invalidCells.size ? ' has-error' : ''}`} aria-live="polite">
        {isComplete
          ? 'Beautifully balanced — level complete!'
          : invalidCells.size
            ? 'A rule is being bent. Check the highlighted cells.'
            : selectedValue === null
              ? 'Erase mode. Tap a filled square to clear it.'
              : `Placing ${selectedValue}. Tap any open square.`}
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
  )
}

function HashiGame({ showRules }) {
  const [levelIndex, setLevelIndex] = useState(0)
  const [bridgeCounts, setBridgeCounts] = useState(() => new Map())
  const [selectedIsland, setSelectedIsland] = useState(null)
  const [dragStartIsland, setDragStartIsland] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const suppressClickRef = useRef(false)
  const [completedLevelIds, setCompletedLevelIds] = useState(() =>
    readCompletedLevels(
      HASHI_COMPLETED_STORAGE_KEY,
      HASHI_PUZZLES.map((puzzle) => puzzle.id),
    ),
  )
  const level = HASHI_PUZZLES[levelIndex]
  const edges = useMemo(() => getHashiEdges(level), [level])
  const completedLevelSet = useMemo(
    () => new Set(completedLevelIds),
    [completedLevelIds],
  )
  const degrees = useMemo(
    () => getHashiDegrees(level, bridgeCounts),
    [bridgeCounts, level],
  )
  const isConnected = useMemo(
    () => isHashiConnected(level, bridgeCounts),
    [bridgeCounts, level],
  )
  const hasCrossing = useMemo(
    () => hasCrossingBridge(level, bridgeCounts),
    [bridgeCounts, level],
  )
  const completeIslands = degrees.filter(
    (degree, index) => degree === level.islands[index].value,
  ).length
  const isComplete = useMemo(
    () => isHashiComplete(level, bridgeCounts),
    [bridgeCounts, level],
  )

  useEffect(() => {
    if (isComplete) return undefined
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isComplete, levelIndex])

  useEffect(() => {
    if (!isComplete || completedLevelSet.has(level.id)) return

    setCompletedLevelIds((currentIds) => {
      if (currentIds.includes(level.id)) return currentIds

      const nextIds = [...currentIds, level.id]
      saveCompletedLevels(HASHI_COMPLETED_STORAGE_KEY, nextIds)
      return nextIds
    })
  }, [completedLevelSet, isComplete, level.id])

  const loadLevel = (index) => {
    setLevelIndex(index)
    setBridgeCounts(new Map())
    setSelectedIsland(null)
    setDragStartIsland(null)
    setSeconds(0)
  }

  const resetLevel = () => {
    setBridgeCounts(new Map())
    setSelectedIsland(null)
    setDragStartIsland(null)
    setSeconds(0)
  }

  const nextLevel = () => {
    loadLevel((levelIndex + 1) % HASHI_PUZZLES.length)
  }

  const validEdgeFor = (from, to) => edges.find((edge) => edge.id === edgeId(from, to))

  const cycleBridge = (from, to) => {
    const edge = validEdgeFor(from, to)
    if (!edge || isComplete) return false

    setBridgeCounts((currentCounts) => {
      const nextCounts = new Map(currentCounts)
      const currentValue = nextCounts.get(edge.id) ?? 0
      const nextValue = (currentValue + 1) % 3

      if (nextValue === 0) nextCounts.delete(edge.id)
      else nextCounts.set(edge.id, nextValue)

      return nextCounts
    })
    return true
  }

  const chooseIsland = (islandIndex) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (isComplete) return

    if (selectedIsland === null || selectedIsland === islandIndex) {
      setSelectedIsland(selectedIsland === islandIndex ? null : islandIndex)
      return
    }

    const didBridge = cycleBridge(selectedIsland, islandIndex)
    setSelectedIsland(didBridge ? null : islandIndex)
  }

  const bridgeLines = edges
    .map((edge) => ({ ...edge, count: bridgeCounts.get(edge.id) ?? 0 }))
    .filter((edge) => edge.count > 0)
  const bridgeCount = bridgeLines.reduce((total, edge) => total + edge.count, 0)
  const boardStyle = {
    '--hashi-width': level.width,
    '--hashi-height': level.height,
  }

  return (
    <section className="game-card" aria-labelledby="game-title">
      <div className="title-row">
        <div>
          <p className="kicker">Hashi · Bridges</p>
          <h1 id="game-title">Connect islands</h1>
        </div>
        <div className="timer" aria-label={`Elapsed time ${formatTime(seconds)}`}>
          <span aria-hidden="true">◷</span>
          {formatTime(seconds)}
        </div>
      </div>

      {showRules && (
        <aside className="rules-panel">
          <div>
            <strong>Match numbers</strong>
            <p>Each island needs exactly as many bridges as its number.</p>
          </div>
          <div>
            <strong>Two max</strong>
            <p>Only one or two bridges may connect the same pair of islands.</p>
          </div>
          <div>
            <strong>No crossings</strong>
            <p>Bridges are straight, horizontal or vertical, and all islands must connect.</p>
          </div>
        </aside>
      )}

      <div className="progress-block">
        <div className="progress-label">
          <span>{level.name}</span>
          <span>
            {completedLevelIds.length} / {HASHI_PUZZLES.length} complete
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${(completeIslands / level.islands.length) * 100}%` }} />
        </div>
      </div>

      <LevelList
        levels={HASHI_PUZZLES}
        currentIndex={levelIndex}
        completedLevelSet={completedLevelSet}
        onSelect={loadLevel}
      />

      <div className="hashi-board" style={boardStyle}>
        <svg className="hashi-bridges" viewBox={`0 0 ${level.width - 1} ${level.height - 1}`} aria-hidden="true">
          {bridgeLines.map((edge) => {
            const from = level.islands[edge.from]
            const to = level.islands[edge.to]
            const offset = edge.count === 2 ? 0.07 : 0
            const lines =
              edge.count === 2
                ? [-offset, offset]
                : [0]

            return lines.map((lineOffset) => (
              <line
                key={`${edge.id}-${lineOffset}`}
                x1={from.column + (edge.horizontal ? 0 : lineOffset)}
                y1={from.row + (edge.horizontal ? lineOffset : 0)}
                x2={to.column + (edge.horizontal ? 0 : lineOffset)}
                y2={to.row + (edge.horizontal ? lineOffset : 0)}
              />
            ))
          })}
        </svg>

        {level.islands.map((island, index) => {
          const degree = degrees[index]
          const isSatisfied = degree === island.value
          const isOverfull = degree > island.value
          const isSelected = selectedIsland === index

          return (
            <button
              className={[
                'hashi-island',
                isSelected ? 'selected' : '',
                isSatisfied ? 'satisfied' : '',
                isOverfull ? 'overfull' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              key={`${island.row}-${island.column}`}
              style={{
                gridColumn: island.column + 1,
                gridRow: island.row + 1,
              }}
              aria-label={`Island ${index + 1}, needs ${island.value} bridges, currently has ${degree}`}
              onPointerDown={() => setDragStartIsland(index)}
              onPointerUp={() => {
                if (dragStartIsland !== null && dragStartIsland !== index) {
                  const didBridge = cycleBridge(dragStartIsland, index)
                  setSelectedIsland(didBridge ? null : index)
                  suppressClickRef.current = true
                }
                setDragStartIsland(null)
              }}
              onClick={() => chooseIsland(index)}
            >
              {island.value}
              <span aria-hidden="true">{degree}</span>
            </button>
          )
        })}
      </div>

      <p className={`game-message${hasCrossing ? ' has-error' : ''}`} aria-live="polite">
        {isComplete
          ? 'All islands are connected — level complete!'
          : hasCrossing
            ? 'A bridge is crossing another bridge. Remove one crossing path.'
            : !isConnected && bridgeCount > 0
              ? 'Good start. Keep joining every island into one network.'
              : selectedIsland !== null
                ? 'Tap or drag to a visible island in the same row or column.'
                : 'Tap an island, then tap or drag to a visible neighbor to cycle 1, 2, or 0 bridges.'}
      </p>

      <div className="actions">
        <button className="secondary-button" type="button" onClick={resetLevel}>
          <span aria-hidden="true">↺</span>
          Reset
        </button>
        <button className="primary-button" type="button" onClick={nextLevel}>
          {isComplete ? 'Next bridge' : 'New puzzle'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}

function App() {
  const [gameType, setGameType] = useState('binary')
  const [showRules, setShowRules] = useState(false)

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

        <div className="topbar-actions">
          <div className="game-tabs" role="tablist" aria-label="Choose puzzle type">
            <button
              className={gameType === 'binary' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={gameType === 'binary'}
              onClick={() => setGameType('binary')}
            >
              Binary
            </button>
            <button
              className={gameType === 'hashi' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={gameType === 'hashi'}
              onClick={() => setGameType('hashi')}
            >
              Bridges
            </button>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="How to play"
            aria-expanded={showRules}
            onClick={() => setShowRules((visible) => !visible)}
          >
            ?
          </button>
        </div>
      </header>

      {gameType === 'binary' ? (
        <BinaryGame showRules={showRules} />
      ) : (
        <HashiGame showRules={showRules} />
      )}

      <footer>
        <span>{gameType === 'binary' ? 'Three simple rules.' : 'No crossing bridges.'}</span>
        <span>One logical solution.</span>
      </footer>
    </main>
  )
}

export default App

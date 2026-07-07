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
import { TECTONIC_PUZZLES } from './tectonicPuzzles.js'
import {
  cellKey as tectonicCellKey,
  findTectonicViolations,
  getTectonicMaxValue,
  isTectonicComplete,
} from './tectonicLogic.js'
import './App.css'

const BINARY_COMPLETED_STORAGE_KEY = 'twofold.completedLevels'
const HASHI_COMPLETED_STORAGE_KEY = 'twofold.hashi.completedLevels'
const TECTONIC_COMPLETED_STORAGE_KEY = 'twofold.tectonic.completedLevels'
const TECTONIC_REGION_COLORS = [
  '#f4dfd8',
  '#dceee9',
  '#e7e1f3',
  '#f2e7c8',
  '#dce8f4',
  '#eadfd4',
  '#dcebd0',
  '#f0dce8',
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

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

function orientation(left, middle, right) {
  return (
    (middle.y - left.y) * (right.x - middle.x) -
    (middle.x - left.x) * (right.y - middle.y)
  )
}

function pointIsOnSegment(start, point, end) {
  return (
    point.x <= Math.max(start.x, end.x) + 0.001 &&
    point.x >= Math.min(start.x, end.x) - 0.001 &&
    point.y <= Math.max(start.y, end.y) + 0.001 &&
    point.y >= Math.min(start.y, end.y) - 0.001
  )
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstTurn = orientation(firstStart, firstEnd, secondStart)
  const secondTurn = orientation(firstStart, firstEnd, secondEnd)
  const thirdTurn = orientation(secondStart, secondEnd, firstStart)
  const fourthTurn = orientation(secondStart, secondEnd, firstEnd)

  if (
    ((firstTurn > 0 && secondTurn < 0) || (firstTurn < 0 && secondTurn > 0)) &&
    ((thirdTurn > 0 && fourthTurn < 0) || (thirdTurn < 0 && fourthTurn > 0))
  ) {
    return true
  }

  return (
    (Math.abs(firstTurn) < 0.001 && pointIsOnSegment(firstStart, secondStart, firstEnd)) ||
    (Math.abs(secondTurn) < 0.001 && pointIsOnSegment(firstStart, secondEnd, firstEnd)) ||
    (Math.abs(thirdTurn) < 0.001 && pointIsOnSegment(secondStart, firstStart, secondEnd)) ||
    (Math.abs(fourthTurn) < 0.001 && pointIsOnSegment(secondStart, firstEnd, secondEnd))
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
  const [dragGesture, setDragGesture] = useState(null)
  const [hoverIsland, setHoverIsland] = useState(null)
  const [changedEdgeId, setChangedEdgeId] = useState(null)
  const [cutEdgeIds, setCutEdgeIds] = useState(() => new Set())
  const [cutSegments, setCutSegments] = useState([])
  const [seconds, setSeconds] = useState(0)
  const boardRef = useRef(null)
  const effectTimerRef = useRef(null)
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

  useEffect(() => () => window.clearTimeout(effectTimerRef.current), [])

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
    setDragGesture(null)
    setHoverIsland(null)
    setChangedEdgeId(null)
    setCutEdgeIds(new Set())
    setCutSegments([])
    setSeconds(0)
  }

  const resetLevel = () => {
    setBridgeCounts(new Map())
    setDragGesture(null)
    setHoverIsland(null)
    setChangedEdgeId(null)
    setCutEdgeIds(new Set())
    setCutSegments([])
    setSeconds(0)
  }

  const nextLevel = () => {
    loadLevel((levelIndex + 1) % HASHI_PUZZLES.length)
  }

  const validEdgeFor = (from, to) => edges.find((edge) => edge.id === edgeId(from, to))

  const showBridgeEffect = (nextChangedEdgeId, nextCutEdges = []) => {
    window.clearTimeout(effectTimerRef.current)
    setChangedEdgeId(nextChangedEdgeId)
    setCutEdgeIds(new Set(nextCutEdges.map((edge) => edge.id)))
    setCutSegments(
      nextCutEdges.flatMap((edge) => {
        const segment = bridgeSegment(edge)
        const offset = edge.count === 2 ? 0.07 : 0
        const offsets = edge.count === 2 ? [-offset, offset] : [0]

        return offsets.map((lineOffset) => ({
          id: `${edge.id}-${lineOffset}`,
          horizontal: edge.horizontal,
          start: segment.start,
          end: segment.end,
          offset: lineOffset,
        }))
      }),
    )
    effectTimerRef.current = window.setTimeout(() => {
      setChangedEdgeId(null)
      setCutEdgeIds(new Set())
      setCutSegments([])
    }, 360)
  }

  const addBridge = (from, to) => {
    const edge = validEdgeFor(from, to)
    if (!edge || isComplete) return false

    const currentValue = bridgeCounts.get(edge.id) ?? 0
    if (currentValue >= 2) return false

    setBridgeCounts((currentCounts) => {
      const nextCounts = new Map(currentCounts)
      nextCounts.set(edge.id, Math.min((nextCounts.get(edge.id) ?? 0) + 1, 2))
      return nextCounts
    })

    showBridgeEffect(edge.id)
    return true
  }

  const bridgeSegment = (edge) => {
    const from = level.islands[edge.from]
    const to = level.islands[edge.to]
    return {
      start: { x: from.column, y: from.row },
      end: { x: to.column, y: to.row },
    }
  }

  const deleteCrossedBridges = (start, end) => {
    if (isComplete) return false

    const crossedEdges = bridgeLines.filter((edge) => {
      const segment = bridgeSegment(edge)
      return segmentsIntersect(start, end, segment.start, segment.end)
    })

    if (!crossedEdges.length) return false

    setBridgeCounts((currentCounts) => {
      const nextCounts = new Map(currentCounts)
      crossedEdges.forEach((edge) => nextCounts.delete(edge.id))
      return nextCounts
    })
    showBridgeEffect(null, crossedEdges)
    return true
  }

  const pointFromEvent = (event) => {
    const board = boardRef.current
    if (!board) return { x: 0, y: 0 }

    const bounds = board.getBoundingClientRect()
    const cellSize = bounds.width / level.width

    return {
      x: clamp((event.clientX - bounds.left - cellSize / 2) / cellSize, 0, level.width - 1),
      y: clamp((event.clientY - bounds.top - cellSize / 2) / cellSize, 0, level.height - 1),
    }
  }

  const islandIndexFromTarget = (target) => {
    const islandElement = target.closest?.('.hashi-island')
    if (!islandElement || !boardRef.current?.contains(islandElement)) return null
    return Number(islandElement.dataset.islandIndex)
  }

  const islandIndexAtPoint = (point) => {
    const hitRadius = 0.9

    const nearestIsland = level.islands.reduce(
      (bestMatch, island, index) => {
        const distance = Math.hypot(island.column - point.x, island.row - point.y)

        if (distance > hitRadius || distance >= bestMatch.distance) {
          return bestMatch
        }

        return { distance, index }
      },
      { distance: Number.POSITIVE_INFINITY, index: null },
    )

    return nearestIsland.index
  }

  const startDrag = (event) => {
    if (isComplete) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const pointerPoint = pointFromEvent(event)
    const islandIndex = islandIndexFromTarget(event.target) ?? islandIndexAtPoint(pointerPoint)
    const startPoint =
      islandIndex === null
        ? pointerPoint
        : {
            x: level.islands[islandIndex].column,
            y: level.islands[islandIndex].row,
          }

    setDragGesture({
      mode: islandIndex === null ? 'cut' : 'bridge',
      startIsland: islandIndex,
      startPoint,
      currentPoint: startPoint,
    })
    setHoverIsland(islandIndex)
  }

  const moveDrag = (event) => {
    if (!dragGesture) return

    const pointerPoint = pointFromEvent(event)
    const islandIndex = islandIndexAtPoint(pointerPoint)
    const currentPoint =
      islandIndex !== null
        ? {
            x: level.islands[islandIndex].column,
            y: level.islands[islandIndex].row,
          }
        : pointerPoint

    setDragGesture((currentGesture) =>
      currentGesture ? { ...currentGesture, currentPoint } : currentGesture,
    )
    setHoverIsland(islandIndex)
  }

  const finishDrag = (event) => {
    if (!dragGesture) return

    const pointerPoint = pointFromEvent(event)
    const endIsland = islandIndexAtPoint(pointerPoint)
    const endPoint =
      endIsland === null
        ? pointerPoint
        : {
            x: level.islands[endIsland].column,
            y: level.islands[endIsland].row,
          }

    if (
      dragGesture.mode === 'bridge' &&
      dragGesture.startIsland !== null &&
      endIsland !== null &&
      endIsland !== dragGesture.startIsland
    ) {
      addBridge(dragGesture.startIsland, endIsland)
    } else if (dragGesture.mode === 'cut') {
      deleteCrossedBridges(dragGesture.startPoint, endPoint)
    }

    setDragGesture(null)
    setHoverIsland(null)
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

      <div
        className={[
          'hashi-board',
          dragGesture?.mode === 'bridge' ? 'drawing-bridge' : '',
          dragGesture?.mode === 'cut' ? 'cutting-bridge' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={boardStyle}
        ref={boardRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          setDragGesture(null)
          setHoverIsland(null)
        }}
      >
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
                className={[
                  edge.id === changedEdgeId ? 'bridge-added' : '',
                  cutEdgeIds.has(edge.id) ? 'bridge-cut' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                x1={from.column + (edge.horizontal ? 0 : lineOffset)}
                y1={from.row + (edge.horizontal ? lineOffset : 0)}
                x2={to.column + (edge.horizontal ? 0 : lineOffset)}
                y2={to.row + (edge.horizontal ? lineOffset : 0)}
              />
            ))
          })}
          {dragGesture && (
            <line
              className={`bridge-preview ${dragGesture.mode === 'cut' ? 'cut-preview' : ''}`}
              x1={dragGesture.startPoint.x}
              y1={dragGesture.startPoint.y}
              x2={dragGesture.currentPoint.x}
              y2={dragGesture.currentPoint.y}
            />
          )}
          {cutSegments.map((segment) => (
            <line
              className="bridge-cut-ghost"
              key={segment.id}
              x1={segment.start.x + (segment.horizontal ? 0 : segment.offset)}
              y1={segment.start.y + (segment.horizontal ? segment.offset : 0)}
              x2={segment.end.x + (segment.horizontal ? 0 : segment.offset)}
              y2={segment.end.y + (segment.horizontal ? segment.offset : 0)}
            />
          ))}
        </svg>

        {level.islands.map((island, index) => {
          const degree = degrees[index]
          const isSatisfied = degree === island.value
          const isOverfull = degree > island.value
          const isDragStart = dragGesture?.startIsland === index
          const isHoverTarget =
            dragGesture?.mode === 'bridge' &&
            hoverIsland === index &&
            dragGesture.startIsland !== index

          return (
            <button
              className={[
                'hashi-island',
                isDragStart ? 'selected' : '',
                isHoverTarget ? 'targeted' : '',
                isSatisfied ? 'satisfied' : '',
                isOverfull ? 'overfull' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              key={`${island.row}-${island.column}`}
              data-island-index={index}
              style={{
                gridColumn: island.column + 1,
                gridRow: island.row + 1,
              }}
              aria-label={`Island ${index + 1}, needs ${island.value} bridges, currently has ${degree}`}
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
              : dragGesture?.mode === 'bridge'
                ? 'Drag to a visible island in the same row or column.'
                : dragGesture?.mode === 'cut'
                  ? 'Cross a bridge to erase it.'
                  : 'Drag from one island to another to draw. Swipe across a bridge to delete.'}
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

function TectonicGame({ showRules }) {
  const [levelIndex, setLevelIndex] = useState(0)
  const [grid, setGrid] = useState(() => copyGrid(TECTONIC_PUZZLES[0].puzzle))
  const [seconds, setSeconds] = useState(0)
  const [selectedValue, setSelectedValue] = useState(1)
  const [completedLevelIds, setCompletedLevelIds] = useState(() =>
    readCompletedLevels(
      TECTONIC_COMPLETED_STORAGE_KEY,
      TECTONIC_PUZZLES.map((puzzle) => puzzle.id),
    ),
  )
  const level = TECTONIC_PUZZLES[levelIndex]
  const completedLevelSet = useMemo(
    () => new Set(completedLevelIds),
    [completedLevelIds],
  )
  const maxValue = useMemo(() => getTectonicMaxValue(level), [level])
  const invalidCells = useMemo(() => findTectonicViolations(level, grid), [grid, level])
  const filledCells = grid.flat().filter((value) => value !== null).length
  const isComplete = useMemo(() => isTectonicComplete(level, grid), [grid, level])

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
      saveCompletedLevels(TECTONIC_COMPLETED_STORAGE_KEY, nextIds)
      return nextIds
    })
  }, [completedLevelSet, isComplete, level.id])

  const loadLevel = (index) => {
    setLevelIndex(index)
    setGrid(copyGrid(TECTONIC_PUZZLES[index].puzzle))
    setSeconds(0)
    setSelectedValue(1)
  }

  const resetLevel = () => {
    setGrid(copyGrid(level.puzzle))
    setSeconds(0)
  }

  const nextLevel = () => {
    loadLevel((levelIndex + 1) % TECTONIC_PUZZLES.length)
  }

  const fillCell = (row, column) => {
    if (level.puzzle[row][column] !== null || isComplete) return

    setGrid((currentGrid) => {
      const nextGrid = copyGrid(currentGrid)
      nextGrid[row][column] = selectedValue
      return nextGrid
    })
  }

  const regionBorderSegments = useMemo(() => {
    const segments = []

    for (let row = 0; row < level.height; row += 1) {
      for (let column = 0; column < level.width; column += 1) {
        const region = level.regionGrid[row][column]

        if (row === 0 || level.regionGrid[row - 1][column] !== region) {
          segments.push({
            id: `top-${row}-${column}`,
            x1: column,
            y1: row,
            x2: column + 1,
            y2: row,
          })
        }

        if (column === 0 || level.regionGrid[row][column - 1] !== region) {
          segments.push({
            id: `left-${row}-${column}`,
            x1: column,
            y1: row,
            x2: column,
            y2: row + 1,
          })
        }

        if (row === level.height - 1) {
          segments.push({
            id: `bottom-${row}-${column}`,
            x1: column,
            y1: row + 1,
            x2: column + 1,
            y2: row + 1,
          })
        }

        if (column === level.width - 1) {
          segments.push({
            id: `right-${row}-${column}`,
            x1: column + 1,
            y1: row,
            x2: column + 1,
            y2: row + 1,
          })
        }
      }
    }

    return segments
  }, [level])

  return (
    <section className="game-card" aria-labelledby="game-title">
      <div className="title-row">
        <div>
          <p className="kicker">Tectonic · Suguru</p>
          <h1 id="game-title">Number blocks</h1>
        </div>
        <div className="timer" aria-label={`Elapsed time ${formatTime(seconds)}`}>
          <span aria-hidden="true">◷</span>
          {formatTime(seconds)}
        </div>
      </div>

      {showRules && (
        <aside className="rules-panel">
          <div>
            <strong>Fill each block</strong>
            <p>A block of N cells must contain every number from 1 to N.</p>
          </div>
          <div>
            <strong>No touching twins</strong>
            <p>The same number cannot touch horizontally, vertically, or diagonally.</p>
          </div>
          <div>
            <strong>Use the palette</strong>
            <p>Choose a number below, then tap editable cells to place it.</p>
          </div>
        </aside>
      )}

      <div className="progress-block">
        <div className="progress-label">
          <span>{level.name}</span>
          <span>
            {completedLevelIds.length} / {TECTONIC_PUZZLES.length} complete
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${(filledCells / (level.width * level.height)) * 100}%` }} />
        </div>
      </div>

      <LevelList
        levels={TECTONIC_PUZZLES}
        currentIndex={levelIndex}
        completedLevelSet={completedLevelSet}
        onSelect={loadLevel}
      />

      <div
        className="tectonic-board"
        style={{
          '--tectonic-width': level.width,
          '--tectonic-height': level.height,
        }}
      >
        <div
          className={`tectonic-grid${isComplete ? ' is-complete' : ''}`}
          role="grid"
          aria-label="Six by six Tectonic puzzle"
        >
          {grid.map((row, rowIndex) =>
            row.map((value, columnIndex) => {
              const isGiven = level.puzzle[rowIndex][columnIndex] !== null
              const isInvalid = invalidCells.has(tectonicCellKey(rowIndex, columnIndex))

              return (
                <button
                  className={[
                    'tectonic-cell',
                    value !== null ? `value-${value}` : '',
                    isGiven ? 'given' : '',
                    isInvalid ? 'invalid' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  role="gridcell"
                  key={`${rowIndex}-${columnIndex}`}
                  disabled={isGiven || isComplete}
                  style={{
                    '--region-bg':
                      TECTONIC_REGION_COLORS[
                        level.regionGrid[rowIndex][columnIndex] %
                          TECTONIC_REGION_COLORS.length
                      ],
                  }}
                  aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: ${
                    value === null ? 'empty' : value
                  }${isGiven ? ', fixed' : ''}${isInvalid ? ', rule conflict' : ''}`}
                  onClick={() => fillCell(rowIndex, columnIndex)}
                >
                  {value}
                </button>
              )
            }),
          )}
        </div>
        <svg
          className="tectonic-region-borders"
          viewBox={`0 0 ${level.width} ${level.height}`}
          aria-hidden="true"
        >
          {regionBorderSegments.map((segment) => (
            <line
              key={segment.id}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
            />
          ))}
        </svg>
      </div>

      <div className="input-palette tectonic-palette" role="group" aria-label="Choose a number">
        <span className="palette-label">Place</span>
        {Array.from({ length: maxValue }, (_, index) => index + 1).map((value) => (
          <button
            className={`number-button value-${value}${
              selectedValue === value ? ' selected' : ''
            }`}
            type="button"
            key={value}
            aria-label={`Place ${value}`}
            aria-pressed={selectedValue === value}
            onClick={() => setSelectedValue(value)}
          >
            {value}
          </button>
        ))}
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
          ? 'Every block fits — level complete!'
          : invalidCells.size
            ? 'Two matching numbers are touching or repeating in a block.'
            : selectedValue === null
              ? 'Erase mode. Tap a filled square to clear it.'
              : `Placing ${selectedValue}. Tap any open square.`}
      </p>

      <div className="actions">
        <button className="secondary-button" type="button" onClick={resetLevel}>
          <span aria-hidden="true">↺</span>
          Reset
        </button>
        <button className="primary-button" type="button" onClick={nextLevel}>
          {isComplete ? 'Next block' : 'New puzzle'}
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
            <button
              className={gameType === 'tectonic' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={gameType === 'tectonic'}
              onClick={() => setGameType('tectonic')}
            >
              Tectonic
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
      ) : gameType === 'hashi' ? (
        <HashiGame showRules={showRules} />
      ) : (
        <TectonicGame showRules={showRules} />
      )}

      <footer>
        <span>
          {gameType === 'binary'
            ? 'Three simple rules.'
            : gameType === 'hashi'
              ? 'No crossing bridges.'
              : 'No touching twins.'}
        </span>
        <span>One logical solution.</span>
      </footer>
    </main>
  )
}

export default App

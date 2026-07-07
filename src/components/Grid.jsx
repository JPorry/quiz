import { memo } from 'react'
import { SIZE } from '../puzzles.js'
import { Cell } from './Cell.jsx'

function GridComponent({
  grid,
  givens,
  invalidCells,
  adjacencyCells,
  hintedCells,
  isComplete,
  onCellPress,
}) {
  return (
    <div
      className={`hydro-grid${isComplete ? ' is-complete' : ''}`}
      role="grid"
      aria-label={`${SIZE} by ${SIZE} Hydro Logic puzzle grid`}
    >
      {grid.map((row, rowIndex) =>
        row.map((value, columnIndex) => {
          const key = `${rowIndex}-${columnIndex}`

          return (
            <Cell
              key={key}
              row={rowIndex}
              column={columnIndex}
              value={value}
              isGiven={givens[rowIndex][columnIndex] !== null}
              isInvalid={invalidCells.has(key)}
              isAdjacentInvalid={adjacencyCells.has(key)}
              hintedValue={hintedCells.get(key)}
              isComplete={isComplete}
              onCellPress={onCellPress}
            />
          )
        }),
      )}
    </div>
  )
}

export const Grid = memo(GridComponent)

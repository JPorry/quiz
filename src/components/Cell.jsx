import { memo, useCallback } from 'react'

function LogIcon() {
  return (
    <svg
      className="h-[72%] w-[82%] drop-shadow-sm"
      viewBox="0 0 72 44"
      role="img"
      aria-label="Log"
    >
      <defs>
        <linearGradient id="log-grain" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#b8793d" />
          <stop offset="58%" stopColor="#7c4723" />
          <stop offset="100%" stopColor="#543018" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="10"
        width="56"
        height="24"
        rx="12"
        fill="url(#log-grain)"
      />
      <ellipse cx="12" cy="22" rx="10" ry="12" fill="#d39a5a" />
      <ellipse cx="12" cy="22" rx="5.8" ry="7.2" fill="#8a5028" opacity="0.75" />
      <path
        d="M27 16c6 3 12 3 19 0M25 24c8 2 17 2 25-1M31 30c6-2 13-2 19 0"
        fill="none"
        stroke="#f1c27a"
        strokeLinecap="round"
        strokeWidth="2"
        opacity="0.58"
      />
      <path
        d="M60 13c-2 5-2 12 0 18"
        fill="none"
        stroke="#3d2414"
        strokeLinecap="round"
        strokeWidth="2.4"
        opacity="0.35"
      />
    </svg>
  )
}

function WaterIcon() {
  return (
    <svg
      className="h-[76%] w-[76%] drop-shadow-sm"
      viewBox="0 0 56 56"
      role="img"
      aria-label="Water Stream"
    >
      <defs>
        <linearGradient id="water-flow" x1="0.12" x2="0.86" y1="0.04" y2="0.94">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="56%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <path
        d="M28 4c9 11 17 21 17 32 0 9-7.2 16-17 16S11 45 11 36C11 25 19 15 28 4Z"
        fill="url(#water-flow)"
      />
      <path
        d="M21 34c3.8 4.5 9.5 5.8 15.5 2.8"
        fill="none"
        stroke="#e0f2fe"
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.78"
      />
      <ellipse cx="22" cy="25" rx="4.5" ry="7" fill="#e0f2fe" opacity="0.48" />
    </svg>
  )
}

function CellComponent({
  row,
  column,
  value,
  isGiven,
  isInvalid,
  isAdjacentInvalid,
  hintedValue,
  isComplete,
  onCellPress,
}) {
  const handlePress = useCallback(() => {
    onCellPress(row, column)
  }, [column, onCellPress, row])

  const label =
    value === null
      ? `Row ${row + 1}, column ${column + 1}: empty river slot`
      : `Row ${row + 1}, column ${column + 1}: ${value === 0 ? 'Log' : 'Water Stream'}`

  return (
    <button
      className={[
        'hydro-cell',
        value === null ? 'is-empty' : '',
        value === 0 ? 'is-log' : '',
        value === 1 ? 'is-water' : '',
        isGiven ? 'is-given' : '',
        isInvalid ? 'is-invalid' : '',
        isAdjacentInvalid ? 'is-shaking' : '',
        hintedValue === 0 ? 'is-hint-log' : '',
        hintedValue === 1 ? 'is-hint-water' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      role="gridcell"
      disabled={isGiven || isComplete}
      aria-label={`${label}${isGiven ? ', fixed clue' : ''}${
        isInvalid ? ', ecosystem rule conflict' : ''
      }${hintedValue !== undefined ? `, hint suggests ${hintedValue === 0 ? 'Log' : 'Water'}` : ''}`}
      onClick={handlePress}
    >
      <span className="cell-pop grid h-full w-full place-items-center" aria-hidden="true">
        {value === 0 && <LogIcon />}
        {value === 1 && <WaterIcon />}
        {value === null && hintedValue !== undefined && (
          <span className="hint-symbol">
            {hintedValue === 0 ? <LogIcon /> : <WaterIcon />}
          </span>
        )}
      </span>
      {isGiven && <span className="given-pin" aria-hidden="true" />}
    </button>
  )
}

export const Cell = memo(CellComponent)

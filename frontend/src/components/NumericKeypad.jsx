import React, { useMemo } from 'react'

export default function NumericKeypad({
  open,
  value,
  onChange,
  onDone,
  allowDecimal = false,
  allowPlus = false,
  preserveLeadingZeros = false,
  maxLength,
  variant = 'overlay',
}) {
  const keys = useMemo(() => {
    const base = [
      '1','2','3',
      '4','5','6',
      '7','8','9',
      allowPlus ? '+' : (allowDecimal ? '.' : null),
      '0',
      '⌫',
    ].filter(Boolean)
    return base
  }, [allowDecimal, allowPlus])

  if (!open) return null

  const bottomOffset = 'calc(env(safe-area-inset-bottom, 0px) + 72px)'

  const safeSet = (next) => {
    let v = String(next ?? '')
    if (typeof maxLength === 'number' && maxLength > 0) {
      v = v.slice(0, maxLength)
    }
    onChange?.(v)
  }

  const press = (k) => {
    const current = String(value ?? '')

    if (k === '⌫') {
      safeSet(current.slice(0, -1))
      return
    }

    if (k === '.') {
      if (!allowDecimal) return
      if (current.includes('.')) return
      safeSet(current ? `${current}.` : '0.')
      return
    }

    if (k === '+') {
      if (!allowPlus) return
      if (current.includes('+')) return
      safeSet(current ? current : '+')
      return
    }

    if (!/^[0-9]$/.test(String(k))) return

    // prevent leading zeros for amount, but keep them for phone entry
    let next = current + k
    if (!preserveLeadingZeros) {
      if (!allowDecimal) {
        if (/^0\d+/.test(next)) next = String(Number(next))
      } else {
        if (next.startsWith('00') && !next.startsWith('0.')) {
          next = next.replace(/^0+/, '0')
        }
      }
    }

    safeSet(next)
  }

  const Panel = (
    <div className={`mx-auto max-w-xl bg-white border border-slate-200 shadow-sm ${variant === 'overlay' ? 'border-t rounded-t-3xl' : 'rounded-2xl'} p-3`}>
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="text-xs text-slate-500">Numeric keypad</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50"
            onClick={() => safeSet('')}
          >
            Clear
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => onDone?.()}
          >
            Done
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`h-12 rounded-2xl text-base font-semibold border active:scale-[0.99] transition ${k === '⌫' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white border-slate-200 text-slate-900'}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )

  if (variant === 'embedded') {
    return <div className="w-full">{Panel}</div>
  }

  return (
    <div className="fixed inset-x-0 z-[70]" style={{ bottom: bottomOffset }}>
      <div className="fixed inset-x-0 top-0 bg-black/30" style={{ bottom: bottomOffset }} onClick={() => onDone?.()} />
      {Panel}
    </div>
  )
}

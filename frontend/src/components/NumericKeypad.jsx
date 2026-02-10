import React, { useMemo } from 'react'
import { Delete, X, Check } from 'lucide-react'

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
    <div className={`mx-auto max-w-xl ${variant === 'overlay' ? 'rounded-t-[28px] border-t' : 'rounded-[28px]'} border border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-elevated overflow-hidden`}>
      {variant === 'overlay' && (
        <div className="pt-2 pb-1 grid place-items-center">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Keypad</div>
          <div className="text-[11px] text-slate-500 truncate">Tap digits to fill the selected field</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] transition"
            onClick={() => safeSet('')}
          >
            <X className="h-4 w-4" />
            Clear
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-sky-600 shadow-soft hover:to-sky-500 active:scale-[0.99] transition"
            onClick={() => onDone?.()}
          >
            <Check className="h-4 w-4" />
            Done
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => {
            const isBackspace = k === '⌫'
            const isAlt = k === '.' || k === '+'
            return (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className={`h-14 rounded-2xl text-base font-semibold border border-slate-200/80 bg-white shadow-soft hover:bg-slate-50 active:scale-[0.99] transition select-none ${isAlt ? 'text-slate-700' : 'text-slate-900'} ${isBackspace ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' : ''}`}
              >
                {isBackspace ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Delete className="h-5 w-5" />
                  </span>
                ) : (
                  k
                )}
              </button>
            )
          })}
        </div>
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

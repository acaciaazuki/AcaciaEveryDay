import { useEffect, useRef } from 'react'

/**
 * 三態勾選框：全選（✓）、半選（－，indeterminate）、未選。
 * 用原生 checkbox，螢幕閱讀器會念出「已勾選／部分勾選／未勾選」；點擊時：未選或半選 → 全選，全選 → 未選。
 */
export function TriCheckbox({ state, label, onChange, className = '' }: { state: 'all' | 'some' | 'none'; label: string; onChange: (checked: boolean) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === 'all'}
      onChange={() => onChange(state !== 'all')}
      // 放在可點的日期格子裡：不讓點擊冒泡成「打開這一天」
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`size-3.5 cursor-pointer accent-sage ${className}`}
    />
  )
}

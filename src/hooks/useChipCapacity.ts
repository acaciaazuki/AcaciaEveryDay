import { useEffect, useState, type RefObject } from 'react'

/** 桌面滿版月曆的斷點（跟 Layout、CalendarPage 的 min-[1001px] 一致） */
export const FILL_QUERY = '(min-width: 1001px)'
/**
 * 一列標籤與格子外框的高度，用根字級（rem）換算，因為 leading-4、size-6、p-2 都是 rem：
 * - 標籤：行高 1rem ＋ 上下 1px 內距 ＋ 1px 間距
 * - 外框：日期圓 1.5rem ＋ 間距 0.25rem ＋ 上下內距 1rem ＋ 邊框 2px
 */
export const chipRowPx = (rem: number) => rem + 3
export const cellChromePx = (rem: number) => rem * 2.75 + 2

/**
 * 依格子高度算出放得下幾個標籤；保留一列給「還有 X 個」。
 * 很矮的視窗可能是 0：只顯示「還有 X 個」，不會把標籤切一半。
 */
export const chipsThatFit = (cellHeight: number, rem = 16) => Math.max(0, Math.floor((cellHeight - cellChromePx(rem)) / chipRowPx(rem)) - 1)

/**
 * 桌面滿版時依日期格子的實際高度決定每天顯示幾個標籤（視窗越高顯示越多）。
 * 手機、平板或量不到高度（測試環境）時維持 fallback。
 * weeks 變了（切換月份）也要重新量：網格總高度不變，ResizeObserver 不會觸發，但每列高度變了。
 */
export function useChipCapacity(grid: RefObject<HTMLElement | null>, fallback: number, weeks: number): number {
  const [capacity, setCapacity] = useState(fallback)
  useEffect(() => {
    const el = grid.current
    if (!el || typeof ResizeObserver === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(FILL_QUERY)
    const measure = () => {
      const cell = el.querySelector<HTMLElement>('[role="gridcell"]')
      const h = cell?.getBoundingClientRect().height ?? 0
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setCapacity(mq.matches && h > 0 ? chipsThatFit(h, rem) : fallback)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener('change', measure)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', measure)
    }
  }, [grid, fallback, weeks])
  return capacity
}

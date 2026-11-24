import { useMemo } from 'react'
import { visibleCalendar, type VisibleCalendar } from '../core/calendarView'
import { useSpacesStore } from '../store/useSpacesStore'

/**
 * 畫面取得共享行程的唯一入口：依目前的檢視身份與篩選，經過權限引擎過濾。
 * 行事曆、今日頁、⌘K 搜尋都用這個 hook，不直接讀 useSpacesStore 的行程資料（有掃描測試把關）。
 */
export function useVisibleCalendar(): VisibleCalendar & { selfId: string } {
  const data = useSpacesStore((s) => s.data)
  const selfId = useSpacesStore((s) => s.selfId)
  const viewerId = useSpacesStore((s) => s.viewerId)
  const filter = useSpacesStore((s) => s.filter)
  return useMemo(() => ({ ...visibleCalendar(data, selfId, viewerId, filter), selfId }), [data, selfId, viewerId, filter])
}

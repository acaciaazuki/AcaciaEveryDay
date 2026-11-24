import { useMemo } from 'react'
import { busyConflicts, visibleCalendar, type SharedEntry, type VisibleCalendar } from '../core/calendarView'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'

/** 個人行程 id → 標題：自己從「我的行事曆」投射出去的區塊用來顯示真實標題（只在本機使用） */
function usePersonalTitles(): ReadonlyMap<string, string> {
  const events = useAppStore((s) => s.events)
  return useMemo(() => new Map(events.map((e) => [e.id, e.title])), [events])
}

/**
 * 畫面取得共享行程的唯一入口：依目前的檢視身份與篩選，經過權限引擎過濾。
 * 行事曆、今日頁、⌘K 搜尋都用這個 hook，不直接讀 useSpacesStore 的行程資料（有掃描測試把關）。
 */
export function useVisibleCalendar(): VisibleCalendar & { selfId: string } {
  const data = useSpacesStore((s) => s.data)
  const selfId = useSpacesStore((s) => s.selfId)
  const viewerId = useSpacesStore((s) => s.viewerId)
  const filter = useSpacesStore((s) => s.filter)
  const personalTitles = usePersonalTitles()
  return useMemo(() => ({ ...visibleCalendar(data, selfId, viewerId, filter, { personalTitles }), selfId }), [data, selfId, viewerId, filter, personalTitles])
}

/**
 * 新增／修改行程時的重疊提醒：要放進的行事曆（target：空間 id 或「我的行事曆」）在這段時間有哪些忙碌區塊。
 * 一律用自己的視角計算（新增行程的人就是自己），結果同樣經過權限引擎過濾，只有忙碌區塊、不含任何內容。
 */
export function useBusyConflicts(target: string, dateISO: string, start: string, end: string): SharedEntry[] {
  const data = useSpacesStore((s) => s.data)
  const selfId = useSpacesStore((s) => s.selfId)
  const entries = useMemo(() => visibleCalendar(data, selfId, selfId, target).shared, [data, selfId, target])
  return useMemo(() => busyConflicts(entries, dateISO, start, end), [entries, dateISO, start, end])
}

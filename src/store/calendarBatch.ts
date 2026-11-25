import type { CalendarEvent } from '../core/schema'
import { useAppStore } from './useAppStore'

/** 行事曆「批次管理」可以選取的一筆：我的行事曆的行程 */
export type BatchSelectable = { key: string; event: CalendarEvent }

export const personalKey = (id: string) => `p:${id}`

/** 批次刪除：移到「最近刪除」；回傳實際刪除的筆數與復原函式 */
export function deleteSelection(selection: readonly BatchSelectable[]): { count: number; undo: () => void } {
  const events = selection.map((x) => x.event)
  if (events.length) useAppStore.getState().removeEvents(events.map((e) => e.id))
  return {
    count: events.length,
    undo: () => {
      if (events.length) useAppStore.getState().restoreEvents(events)
    },
  }
}

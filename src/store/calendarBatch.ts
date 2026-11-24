import type { SharedEntry } from '../core/calendarView'
import type { CalendarEvent } from '../core/schema'
import { orderedKinds, PERSONAL_CALENDAR_ID, type Space } from '../core/sharing'
import { useAppStore } from './useAppStore'
import { useSpacesStore } from './useSpacesStore'

/**
 * 行事曆「批次管理」的操作：批次刪除、批次移到其他行事曆，都附上復原。
 *
 * 可以選取的只有「原生行程」：
 * - 我的行事曆的個人行程
 * - 共享空間裡自己可以編輯、內容完整（沒有被遮罩）的行程
 * 忙碌投射、唯讀、部分隱藏、購物連動、國定假日都不能選。
 */
export type BatchSelectable = { key: string; kind: 'personal'; event: CalendarEvent } | { key: string; kind: 'shared'; entry: SharedEntry }

export const personalKey = (id: string) => `p:${id}`
export const sharedKey = (id: string) => `s:${id}`

/** 共享行程可以批次操作的條件 */
export const canBatchShared = (e: SharedEntry) => e.canEdit && !e.projected && e.access === 'full'

/** 這筆目前在哪個行事曆（PERSONAL_CALENDAR_ID 或空間 id） */
const sourceOf = (x: BatchSelectable) => (x.kind === 'personal' ? PERSONAL_CALENDAR_ID : x.entry.space.id)

/** 批次刪除；回傳實際刪除的筆數與復原函式 */
export function deleteSelection(selection: readonly BatchSelectable[]): { count: number; undo: () => void } {
  const app = useAppStore.getState()
  const spaces = useSpacesStore.getState()
  const personal = selection.flatMap((x) => (x.kind === 'personal' ? [x.event] : []))
  const shared = selection.flatMap((x) => (x.kind === 'shared' ? [x.entry.id] : []))
  if (personal.length) app.removeEvents(personal.map((e) => e.id))
  for (const id of shared) spaces.removeItem(id)
  return {
    count: personal.length + shared.length,
    undo: () => {
      if (personal.length) useAppStore.getState().restoreEvents(personal)
      for (const id of shared) useSpacesStore.getState().restoreItem(id)
    },
  }
}

/**
 * 批次移到其他行事曆（target：PERSONAL_CALENDAR_ID 或空間 id）。
 * 做法：在目標建立一筆內容相同的原生行程（自己是建立者，可以直接編輯刪除），再刪掉原本那筆；已經在目標的略過。
 * - 個人 → 空間：類型用目標空間建議的第一個
 * - 空間 → 空間：保留類型、地點、細節；可見性改用目標空間的預設（原本的成員名單不適用）
 * - 空間 → 我的行事曆：個人行程沒有地點與細節欄位，地點寫進備註；跨日行程只保留第一天
 * 忙碌投射是即時算出來的，移動後會自動跟著更新。
 */
export function moveSelection(selection: readonly BatchSelectable[], target: string, targetSpace?: Space): { count: number; undo: () => void } {
  const created: { personal: string[]; shared: string[] } = { personal: [], shared: [] }
  const removed: { personal: CalendarEvent[]; shared: string[] } = { personal: [], shared: [] }

  for (const x of selection) {
    if (sourceOf(x) === target) continue
    if (target === PERSONAL_CALENDAR_ID) {
      if (x.kind !== 'shared') continue
      const i = x.entry.item
      const note = [i.note, i.location].filter(Boolean).join(' · ')
      created.personal.push(...useAppStore.getState().addEvents([{ title: i.title, dateISO: i.dateISO, start: i.start, end: i.end, note, titleColor: i.titleColor, bgColor: i.bgColor, icon: i.icon }]))
      useSpacesStore.getState().removeItem(i.id)
      removed.shared.push(i.id)
      continue
    }
    if (!targetSpace) continue
    if (x.kind === 'personal') {
      const e = x.event
      created.shared.push(
        useSpacesStore.getState().addItem(targetSpace.id, {
          title: e.title,
          dateISO: e.dateISO,
          start: e.start,
          end: e.end,
          note: e.note,
          titleColor: e.titleColor,
          bgColor: e.bgColor,
          icon: e.icon,
          kind: orderedKinds(targetSpace.kind)[0]!,
        }),
      )
      useAppStore.getState().removeEvent(e.id)
      removed.personal.push(e)
    } else {
      const i = x.entry.item
      created.shared.push(
        useSpacesStore.getState().addItem(targetSpace.id, {
          kind: i.kind,
          title: i.title,
          dateISO: i.dateISO,
          endDateISO: i.endDateISO,
          start: i.start,
          end: i.end,
          location: i.location,
          note: i.note,
          details: i.details,
          titleColor: i.titleColor,
          bgColor: i.bgColor,
          icon: i.icon,
        }),
      )
      useSpacesStore.getState().removeItem(i.id)
      removed.shared.push(i.id)
    }
  }

  return {
    count: created.personal.length + created.shared.length,
    undo: () => {
      if (created.personal.length) useAppStore.getState().removeEvents(created.personal)
      for (const id of created.shared) useSpacesStore.getState().removeItem(id)
      if (removed.personal.length) useAppStore.getState().restoreEvents(removed.personal)
      for (const id of removed.shared) useSpacesStore.getState().restoreItem(id)
    },
  }
}

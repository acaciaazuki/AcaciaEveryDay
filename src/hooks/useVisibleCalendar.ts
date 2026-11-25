import { useMemo } from 'react'
import { busyConflicts, visibleCalendar, type SharedEntry, type VisibleCalendar } from '../core/calendarView'
import { resolveCalendarItemForViewer } from '../core/permissions'
import type { SharedCalendarItem, Space } from '../core/sharing'
import { liveEvents, trashEntries, type TrashEntry } from '../core/trash'
import type { IcsEvent } from '../core/ics'
import { buildViewerExport } from '../core/syncEnvelope'
import { useSharedTitle } from './useSharedTitle'
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

/**
 * 「最近刪除」的清單：只有本人（不是預覽其他成員）看得到。
 * 共享行程只列出自己有編輯權、還有內容的（經過權限引擎判斷），刪除者顯示空間裡的成員名稱。
 */
export function useTrashEntries(): (TrashEntry & { deletedByName?: string })[] {
  const events = useAppStore((s) => s.events)
  const data = useSpacesStore((s) => s.data)
  const selfId = useSpacesStore((s) => s.selfId)
  const isSelf = useSpacesStore((s) => s.viewerId === s.selfId)
  return useMemo(() => {
    if (!isSelf) return []
    const canEdit = (item: SharedCalendarItem, space: Space) => !!resolveCalendarItemForViewer(item, selfId, { space })?.canEdit
    return trashEntries(events, data, selfId, canEdit).map((e) => {
      if (e.kind !== 'shared') return e
      const member = data.spaces.find((s) => s.id === e.spaceId)?.members.find((m) => m.userId === e.deletedBy)
      return { ...e, deletedByName: member?.displayName ?? '' }
    })
  }, [isSelf, events, data, selfId])
}

/**
 * 匯出用的資料（設定頁的「匯出行事曆（.ics）」「匯出共享空間（JSON）」）：
 * 一律以本人視角、經過權限引擎過濾，只匯出自己看得到的內容——別人的忙碌區塊只有時間、遮罩的欄位維持空白。
 * - icsEvents：我的行事曆（不含最近刪除）＋所有共享空間裡看得到的行程
 * - spacesExport：共享空間的同步封包（自己看得到的版本，跟 Drive 同步檔同一套過濾）
 */
export function useCalendarExport() {
  const sharedTitle = useSharedTitle()
  return {
    icsEvents: (): IcsEvent[] => {
      const { data, selfId } = useSpacesStore.getState()
      const personal = liveEvents(useAppStore.getState().events).map(
        (e): IcsEvent => ({ uid: `${e.id}@personal.acacia-everyday`, title: e.title, dateISO: e.dateISO, endDateISO: e.endDateISO ?? '', start: e.start, end: e.end, note: e.note }),
      )
      const shared = visibleCalendar(data, selfId, selfId, 'all').shared.map(
        (e): IcsEvent => ({
          uid: `${e.id}@shared.acacia-everyday`,
          title: sharedTitle(e),
          dateISO: e.dateISO,
          endDateISO: e.lastDateISO === e.dateISO ? '' : e.lastDateISO,
          start: e.start,
          end: e.end,
          location: e.access === 'busy' ? '' : e.item.location,
          note: e.access === 'busy' ? '' : e.item.note,
          category: e.space.name,
        }),
      )
      return [...personal, ...shared].filter((e) => e.dateISO).sort((a, b) => (a.dateISO + a.start).localeCompare(b.dateISO + b.start))
    },
    spacesExport: () => {
      const { data, selfId } = useSpacesStore.getState()
      return { format: 'acacia-spaces-export', exportedAt: Date.now(), viewerId: selfId, spaces: buildViewerExport(data, selfId, Date.now()), busyProjectionRules: data.busyProjectionRules.filter((r) => r.userId === selfId) }
    },
  }
}

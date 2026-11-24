import { projectBusyBlocks, resolveCalendarItemForViewer, type ViewAccess } from './permissions'
import { roleOf, type ItemKind, type MaskableField, type SharedCalendarData, type SharedCalendarItem, type SpaceKind } from './sharing'

/**
 * 行事曆畫面用的共享行程（已經過權限解析）。
 *
 * 畫面、今日頁、⌘K 搜尋只能拿到這裡的資料：item 是 resolveCalendarItemForViewer 過濾後的副本，
 * busy_only 與被遮罩的欄位已經是空字串，不會有原文。
 */
export interface SharedEntry {
  id: string
  dateISO: string
  /** 跨日行程的最後一天；同一天就跟 dateISO 相同 */
  lastDateISO: string
  start: string
  end: string
  access: ViewAccess
  item: SharedCalendarItem
  kind: ItemKind
  busyLabel: string
  maskedFields: MaskableField[]
  space: { id: string; name: string; kind: SpaceKind; color?: string }
  /** 建立者在空間裡的顯示名稱（自己時是空字串，由畫面顯示「我」） */
  creatorName: string
  isOwnItem: boolean
  /** 檢視者本人時才可能為 true；模擬視角一律唯讀 */
  canEdit: boolean
  canManageVisibility: boolean
  /** 由忙閒投射規則產生 */
  projected: boolean
}

/** 篩選：全部／只看我的行事曆（個人行程）／某個空間 */
export type CalendarFilter = 'all' | 'personal' | (string & {})

export interface VisibleCalendar {
  viewerId: string
  isSelf: boolean
  /** 是否顯示「我的行事曆」個人行程與購物連動（只有本人視角、篩選為全部或個人時） */
  showPersonal: boolean
  shared: SharedEntry[]
}

/**
 * 算出某位檢視者在目前篩選下看得到的共享行程。
 * - 已刪除的空間、檢視者不是成員的空間：全部略過
 * - 忙閒投射：其他成員看到忙碌區塊；本人已經看得到原始行程，不重複顯示
 * - 模擬其他成員的視角時，一律唯讀
 */
export function visibleCalendar(data: SharedCalendarData, selfId: string, viewerId: string, filter: CalendarFilter): VisibleCalendar {
  const isSelf = viewerId === selfId
  const showPersonal = isSelf && (filter === 'all' || filter === 'personal')
  if (filter === 'personal') return { viewerId, isSelf, showPersonal, shared: [] }

  const spaces = data.spaces.filter((s) => roleOf(s, viewerId) && (filter === 'all' || s.id === filter))
  const projected = spaces.flatMap((s) => projectBusyBlocks({ rules: data.busyProjectionRules, spaces: data.spaces, items: data.items, targetSpaceId: s.id }))
  const candidates = [...data.items, ...projected.filter((b) => b.createdBy !== viewerId)]

  const shared: SharedEntry[] = []
  for (const space of spaces) {
    const nameOf = (userId: string) => (userId === selfId ? '' : (space.members.find((m) => m.userId === userId)?.displayName ?? ''))
    for (const raw of candidates) {
      if (raw.spaceId !== space.id) continue
      const r = resolveCalendarItemForViewer(raw, viewerId, { space })
      if (!r) continue
      const item = r.item
      shared.push({
        id: item.id,
        dateISO: item.dateISO,
        lastDateISO: item.endDateISO && item.endDateISO > item.dateISO ? item.endDateISO : item.dateISO,
        start: item.start,
        end: item.end,
        access: r.access,
        item,
        kind: item.kind,
        busyLabel: item.visibility.busyLabel,
        maskedFields: r.access === 'masked' ? item.visibility.maskedFields : [],
        space: { id: space.id, name: space.name, kind: space.kind, color: space.color },
        creatorName: nameOf(item.createdBy),
        isOwnItem: r.isOwnItem,
        canEdit: isSelf && r.canEdit,
        canManageVisibility: isSelf && r.canManageVisibility,
        projected: raw.projection !== undefined,
      })
    }
  }
  return { viewerId, isSelf, showPersonal, shared: shared.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.start.localeCompare(b.start)) }
}

/** 某一天的共享行程（含跨日行程的中間日），依開始時間排序 */
export const sharedOn = (entries: readonly SharedEntry[], iso: string) =>
  entries.filter((e) => e.dateISO <= iso && iso <= e.lastDateISO).sort((a, b) => a.start.localeCompare(b.start))

/** 給搜尋用：忙碌區塊不能被搜尋，遮罩的欄位本來就是空字串 */
export interface SearchableShared {
  id: string
  title: string
  note: string
  location: string
  /** 依類型填寫的細節（沒被遮罩的才有值），用空白串起來給搜尋 */
  details: string
  dateISO: string
  start: string
  spaceName: string
}

export const searchableShared = (entries: readonly SharedEntry[]): SearchableShared[] =>
  entries
    .filter((e) => e.access !== 'busy')
    .map((e) => ({ id: e.id, title: e.item.title, note: e.item.note, location: e.item.location, details: Object.values(e.item.details).join(' '), dateISO: e.dateISO, start: e.start, spaceName: e.space.name }))

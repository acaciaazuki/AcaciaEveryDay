import { projectBusyBlocks, resolveCalendarItemForViewer, type ViewAccess } from './permissions'
import { PERSONAL_CALENDAR_ID, roleOf, type BusyDisplay, type ItemKind, type MaskableField, type SharedCalendarData, type SharedCalendarItem, type SpaceKind } from './sharing'

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
  /** 忙碌區塊的顯示方式：busy 顯示文字（busyLabel，空字串用「忙碌」）；time_only 只顯示時間區間 */
  busyDisplay: BusyDisplay
  /**
   * 只有「自己投射出去的區塊」才有：來源行事曆（id 為空間 id 或 PERSONAL_CALENDAR_ID；name 空字串時由畫面顯示「我的行事曆」）。
   * 其他成員看到的區塊永遠不帶來源。
   */
  projectedFrom?: { id: string; name: string }
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

export interface VisibleCalendarOptions {
  /**
   * 個人行程 id → 標題：來源是「我的行事曆」的投射區塊要顯示真實標題時使用。
   * 只在本機顯示用，不會寫入共享資料或同步出去。
   */
  personalTitles?: ReadonlyMap<string, string>
}

/**
 * 算出某位檢視者在目前篩選下看得到的共享行程。
 * - 已刪除的空間、檢視者不是成員的空間：全部略過
 * - 忙閒投射：其他成員看到忙碌區塊（不知道來源）
 * - 自己投射出去的區塊：「全部」不顯示（原始行程已經看得到，避免重複）；
 *   切到某個空間或「我的行事曆」時顯示，唯讀，並帶上來源（projectedFrom）與來源行程的真實標題，方便確認同步結果
 * - 模擬其他成員的視角時，一律唯讀
 */
export function visibleCalendar(data: SharedCalendarData, selfId: string, viewerId: string, filter: CalendarFilter, options: VisibleCalendarOptions = {}): VisibleCalendar {
  const isSelf = viewerId === selfId
  const showPersonal = isSelf && (filter === 'all' || filter === 'personal')
  const ownProjection = ownProjectionEntry(data, viewerId)
  // 本人看自己投射出去的區塊時帶入來源的真實標題；模擬其他成員視角時不帶
  const titles = { withTitles: isSelf, personalTitles: options.personalTitles }
  if (filter === 'personal') {
    // 「我的行事曆」只屬於本人：只有投射到這裡的自己的忙碌區塊
    const blocks = isSelf ? projectBusyBlocks({ rules: data.busyProjectionRules.filter((r) => r.userId === viewerId), spaces: data.spaces, items: data.items, personalSlots: data.personalBusySlots, targetSpaceId: PERSONAL_CALENDAR_ID, ...titles }) : []
    const space = { id: PERSONAL_CALENDAR_ID, name: '', kind: 'personal' as const }
    return { viewerId, isSelf, showPersonal, shared: sortEntries(blocks.map((b) => ownProjection(b, space))) }
  }

  const spaces = data.spaces.filter((s) => roleOf(s, viewerId) && (filter === 'all' || s.id === filter))
  const projected = spaces.flatMap((s) => projectBusyBlocks({ rules: data.busyProjectionRules, spaces: data.spaces, items: data.items, personalSlots: data.personalBusySlots, targetSpaceId: s.id, ...titles }))
  // 別人投射過來的區塊一律不帶標題（權限解析的 toBusyView 也會清空，這裡再保險一次）
  const candidates = [...data.items, ...projected.filter((b) => b.createdBy !== viewerId).map((b) => ({ ...b, title: '' }))]
  const own = filter === 'all' ? [] : projected.filter((b) => b.createdBy === viewerId)

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
        busyDisplay: raw.projection?.display ?? 'busy',
      })
    }
    for (const b of own) if (b.spaceId === space.id) shared.push(ownProjection(b, { id: space.id, name: space.name, kind: space.kind, color: space.color }))
  }
  return { viewerId, isSelf, showPersonal, shared: sortEntries(shared) }
}

const sortEntries = (entries: SharedEntry[]) => entries.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.start.localeCompare(b.start))

/**
 * 自己投射出去的忙碌區塊：不經過權限解析（建立者本人會拿到可編輯的完整權限），
 * 一律當成唯讀的忙碌區塊，並附上來源行事曆。
 */
function ownProjectionEntry(data: SharedCalendarData, viewerId: string) {
  const ruleById = new Map(data.busyProjectionRules.map((r) => [r.id, r]))
  const nameOf = (id: string) => (id === PERSONAL_CALENDAR_ID ? '' : (data.spaces.find((s) => s.id === id)?.name ?? ''))
  return (b: SharedCalendarItem, space: SharedEntry['space']): SharedEntry => {
    const sourceId = ruleById.get(b.projection?.ruleId ?? '')?.sourceId ?? ''
    return {
      id: b.id,
      dateISO: b.dateISO,
      lastDateISO: b.endDateISO && b.endDateISO > b.dateISO ? b.endDateISO : b.dateISO,
      start: b.start,
      end: b.end,
      access: 'busy',
      item: { ...b, redaction: 'busy' },
      kind: b.kind,
      busyLabel: b.visibility.busyLabel,
      maskedFields: [],
      space,
      creatorName: '',
      isOwnItem: b.createdBy === viewerId,
      canEdit: false,
      canManageVisibility: false,
      projected: true,
      busyDisplay: b.projection?.display ?? 'busy',
      projectedFrom: { id: sourceId, name: nameOf(sourceId) },
    }
  }
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

/**
 * 新增／修改行程時的重疊提醒：找出某一天、某段時間跟哪些忙碌區塊（投射產生的）重疊。
 * - 任一方是整天（沒有開始時間）：同一天就算重疊
 * - 跨日的忙碌區塊：保守起見，涵蓋的每一天都算重疊
 * - 沒有結束時間：當成時間點，落在區塊內（或同一個開始時間）就算重疊
 * 只看忙碌區塊；一般共享行程不算（那些本來就看得到內容，由使用者自己判斷）。
 */
export function busyConflicts(entries: readonly SharedEntry[], dateISO: string, start: string, end: string): SharedEntry[] {
  if (!dateISO) return []
  return sharedOn(entries, dateISO).filter((e) => {
    if (!e.projected || e.access !== 'busy') return false
    if (!start || !e.start || e.dateISO !== e.lastDateISO) return true
    const myEnd = end || start
    const theirEnd = e.end || e.start
    if (start === e.start) return true
    return start < theirEnd && e.start < myEnd
  })
}

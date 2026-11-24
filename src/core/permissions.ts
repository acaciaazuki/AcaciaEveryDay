import {
  isRuleActive,
  PERSONAL_CALENDAR_ID,
  roleOf,
  ruleTargets,
  sharedCalendarItemSchema,
  type BusyProjectionRule,
  type MaskableField,
  type MemberRole,
  type SharedCalendarItem,
  type SharedCalendarItemInput,
  type Space,
  type Visibility,
} from './sharing'

/**
 * 共享行事曆的權限判斷引擎（純函式）。
 *
 * 畫面顯示、同步封包輸出、匯出給特定檢視者，全部都要經過這裡，
 * 確保「看得到什麼」只有一套規則，不會因為走不同路徑而洩漏。
 *
 * 規則摘要（依序判斷）：
 * 1. 不是該空間成員（或空間已刪除）→ 看不到
 * 2. 已軟刪除的行程 → 預設看不到（同步時以 includeDeleted 取得墓碑）
 * 3. 建立者本人 → 一律完整可見，可管理可見性；角色不是 viewer 才能編輯
 * 4. 在 hiddenUserIds 裡 → 看不到（任何模式都一樣）
 * 5. private → 看不到；selected_members 且不在 allowedUserIds → 看不到
 * 6. busy_only → 只剩時間與忙碌文字
 * 7. 有 maskedFields → 遮罩這些欄位
 * 8. 其他 → 完整可見；owner／editor 可以編輯內容，但不能改可見性
 */

export type ViewAccess = 'full' | 'masked' | 'busy'

export interface ResolvedCalendarItem {
  access: ViewAccess
  /** 已依檢視者過濾後的資料：遮罩過的欄位是空字串，可以直接顯示或放進同步封包 */
  item: SharedCalendarItem
  /** 這個檢視者的角色 */
  role: MemberRole
  isOwnItem: boolean
  canEdit: boolean
  canManageVisibility: boolean
}

export interface ResolveOptions {
  /** 行程所屬的空間（含成員名單） */
  space: Pick<Space, 'id' | 'members' | 'deletedAt'>
  /** 是否解析已軟刪除的行程（同步墓碑用） */
  includeDeleted?: boolean
}

const EDIT_ROLES: readonly MemberRole[] = ['owner', 'editor']

/** 清空可見性細節：非建立者不需要知道還有誰被隱藏 */
const viewerVisibility = (v: Visibility, keep: Partial<Visibility> = {}): Visibility => ({
  mode: v.mode,
  allowedUserIds: [],
  hiddenUserIds: [],
  busyLabel: v.busyLabel,
  maskedFields: [],
  ...keep,
})

/** 共同欄位：時間、同步資訊、建立者（家人需要知道「誰」忙碌） */
function baseOf(item: SharedCalendarItem) {
  return {
    id: item.id,
    spaceId: item.spaceId,
    dateISO: item.dateISO,
    endDateISO: item.endDateISO,
    start: item.start,
    end: item.end,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    version: item.version,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  }
}

/** 忙閒檢視：只留下時間，標題／地點／備註／細節／類型／圖示／顏色全部移除 */
export function toBusyView(item: SharedCalendarItem): SharedCalendarItem {
  return {
    ...baseOf(item),
    kind: 'event',
    title: '',
    location: '',
    note: '',
    details: {},
    visibility: viewerVisibility(item.visibility, { mode: 'busy_only' }),
    redaction: 'busy',
  }
}

/** 欄位遮罩檢視：只移除 maskedFields 指定的欄位 */
export function toMaskedView(item: SharedCalendarItem, masked: readonly MaskableField[]): SharedCalendarItem {
  const has = (f: MaskableField) => masked.includes(f)
  const hideIcon = has('title') || has('kind')
  return {
    ...baseOf(item),
    kind: has('kind') ? 'event' : item.kind,
    title: has('title') ? '' : item.title,
    location: has('location') ? '' : item.location,
    note: has('note') ? '' : item.note,
    details: has('details') ? {} : item.details,
    ...(item.titleColor !== undefined && { titleColor: item.titleColor }),
    ...(item.bgColor !== undefined && { bgColor: item.bgColor }),
    ...(!hideIcon && item.icon !== undefined && { icon: item.icon }),
    visibility: viewerVisibility(item.visibility, {
      maskedFields: [...masked],
      allowedUserIds: item.visibility.mode === 'selected_members' ? item.visibility.allowedUserIds : [],
    }),
    redaction: 'masked',
  }
}

/** 完整檢視（非建立者）：內容完整，但不透露 hiddenUserIds 與投射規則 */
function toFullView(item: SharedCalendarItem): SharedCalendarItem {
  const { projection: _projection, redaction: _redaction, ...rest } = item
  return { ...rest, visibility: { ...item.visibility, hiddenUserIds: [] } }
}

/** 這位檢視者在可見性設定上是否被排除（不含建立者判斷） */
export function isExcludedByVisibility(v: Visibility, viewerId: string): boolean {
  if (v.hiddenUserIds.includes(viewerId)) return true
  if (v.mode === 'private') return true
  if (v.mode === 'selected_members' && !v.allowedUserIds.includes(viewerId)) return true
  return false
}

/**
 * 解析一筆行程對特定檢視者的呈現。看不到時回傳 null。
 */
export function resolveCalendarItemForViewer(item: SharedCalendarItem, viewerId: string, options: ResolveOptions): ResolvedCalendarItem | null {
  const { space } = options
  if (space.id !== item.spaceId) return null
  const role = roleOf(space, viewerId)
  if (!role) return null
  if (item.deletedAt !== null && !options.includeDeleted) return null

  const canEditRole = EDIT_ROLES.includes(role)
  // 已經是過濾後的副本（從同步收到的）：維持原本的遮罩，不能編輯
  if (item.redaction) {
    return { access: item.redaction, item, role, isOwnItem: false, canEdit: false, canManageVisibility: false }
  }

  if (item.createdBy === viewerId) {
    const generated = item.projection !== undefined
    return { access: 'full', item, role, isOwnItem: true, canEdit: canEditRole && !generated, canManageVisibility: !generated }
  }

  const v = item.visibility
  if (isExcludedByVisibility(v, viewerId)) return null

  if (v.mode === 'busy_only') return { access: 'busy', item: toBusyView(item), role, isOwnItem: false, canEdit: false, canManageVisibility: false }
  if (v.maskedFields.length > 0) {
    return { access: 'masked', item: toMaskedView(item, v.maskedFields), role, isOwnItem: false, canEdit: false, canManageVisibility: false }
  }
  return { access: 'full', item: toFullView(item), role, isOwnItem: false, canEdit: canEditRole && item.projection === undefined, canManageVisibility: false }
}

/** 一次解析多筆（畫面列表用），自動依 spaceId 找空間；找不到空間的行程視為不可見 */
export function resolveItemsForViewer(items: readonly SharedCalendarItem[], viewerId: string, spaces: readonly Space[]): ResolvedCalendarItem[] {
  const byId = new Map(spaces.map((s) => [s.id, s]))
  const out: ResolvedCalendarItem[] = []
  for (const item of items) {
    const space = byId.get(item.spaceId)
    const r = space && resolveCalendarItemForViewer(item, viewerId, { space })
    if (r) out.push(r)
  }
  return out
}

// ---------- 編輯 ----------

export class PermissionError extends Error {}

/** 編輯時不能直接改的欄位（由系統維護） */
type SystemField = 'id' | 'spaceId' | 'createdBy' | 'createdAt' | 'version' | 'updatedAt' | 'updatedBy' | 'deletedAt' | 'redaction' | 'projection'
export type ItemPatch = Partial<Omit<SharedCalendarItemInput, SystemField>>

/**
 * 套用編輯：檢查權限、版本 +1、記錄修改者。
 * 非建立者送來的 visibility 一律忽略，以原本的設定為準（伺服器端也必須做同樣的檢查）。
 */
export function applyItemEdit(original: SharedCalendarItem, patch: ItemPatch, editorId: string, space: Space, now: number): SharedCalendarItem {
  const r = resolveCalendarItemForViewer(original, editorId, { space })
  if (!r?.canEdit) throw new PermissionError('沒有編輯這筆行程的權限')
  const { visibility, ...content } = patch
  if (visibility !== undefined && !r.canManageVisibility) throw new PermissionError('只有建立者可以變更可見性')
  return sharedCalendarItemSchema.parse({
    ...original,
    ...content,
    visibility: visibility === undefined ? original.visibility : { ...original.visibility, ...visibility },
    version: original.version + 1,
    updatedAt: Math.max(now, original.updatedAt),
    updatedBy: editorId,
  })
}

/** 軟刪除：保留墓碑讓其他裝置／成員同步刪除 */
export function softDeleteItem(original: SharedCalendarItem, actorId: string, space: Space, now: number): SharedCalendarItem {
  const r = resolveCalendarItemForViewer(original, actorId, { space })
  if (!r?.canEdit) throw new PermissionError('沒有刪除這筆行程的權限')
  const at = Math.max(now, original.updatedAt)
  return { ...original, deletedAt: at, version: original.version + 1, updatedAt: at, updatedBy: actorId }
}

// ---------- 跨空間忙閒投射 ----------

/** FNV-1a，做出穩定但看不出來源 id 的忙碌區塊 id */
function opaqueId(input: string): string {
  const hash = (seed: number) => {
    let h = seed
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16).padStart(8, '0')
  }
  return `busy-${hash(0x811c9dc5)}${hash(0x01000193)}`
}

/**
 * 忙碌區塊 id：規則＋來源行程＋目標。
 * v1 規則原本的目標（legacyTargetId）沿用舊格式（不含目標），其他成員手上的舊區塊才能被更新或移除。
 */
export const projectedBlockId = (ruleId: string, itemId: string, targetId?: string) => opaqueId(targetId === undefined ? `${ruleId}|${itemId}` : `${ruleId}|${itemId}|${targetId}`)
const blockIdFor = (rule: BusyProjectionRule, itemId: string, targetId: string) => projectedBlockId(rule.id, itemId, targetId === rule.legacyTargetId ? undefined : targetId)

export interface ProjectBusyBlocksOptions {
  rules: readonly BusyProjectionRule[]
  spaces: readonly Space[]
  items: readonly SharedCalendarItem[]
  /** 目標行事曆：空間 id，或 PERSONAL_CALENDAR_ID（「我的行事曆」，只有規則擁有者自己看得到） */
  targetSpaceId: string
  /** 只投射這段日期（含頭尾，YYYY-MM-DD）內的行程 */
  range?: { from: string; to: string }
  /** 同步用：來源行程已刪除、規則已停用或目標已移除時，產生對應的墓碑讓其他成員移除忙碌區塊 */
  includeDeleted?: boolean
}

/**
 * 把其他行事曆符合規則的行程，轉成目標行事曆的 busy_only 忙碌區塊。
 *
 * - 一條規則可以有多個目標（全部或勾選），每個目標各自產生區塊（id 含目標，不會互相覆蓋）
 * - 只投射規則擁有者本人建立的行程（不能把別人的行程投射出去）
 * - 規則擁有者必須同時是來源與目標空間的成員（「我的行事曆」只屬於自己）
 * - 產生的區塊只有時間與規則的 label／顯示方式，不帶標題、地點、備註、細節、類型、來源空間或來源行程 id
 * - 來源行程的 hiddenUserIds 會沿用：被隱藏的人連忙碌區塊也看不到
 * - 沒有時間的整天行程只在規則開啟 includeAllDay 時投射
 * - 來源是「我的行事曆」的規則，個人行程在第 2 階段才會接進來；目前不產生區塊
 */
export function projectBusyBlocks(options: ProjectBusyBlocksOptions): SharedCalendarItem[] {
  const { rules, spaces, items, targetSpaceId, range, includeDeleted = false } = options
  const spaceById = new Map(spaces.map((s) => [s.id, s]))
  const targetIsPersonal = targetSpaceId === PERSONAL_CALENDAR_ID
  if (!targetIsPersonal && !spaceById.get(targetSpaceId)) return []

  const out: SharedCalendarItem[] = []
  for (const rule of rules) {
    const live = ruleTargets(rule, spaces).includes(targetSpaceId)
    // 從目標移除（或規則的目標已經不包含它）時，同步用的墓碑仍要送給這個空間
    const retired = !live && rule.retiredTargetIds.includes(targetSpaceId)
    if (!live && !(retired && includeDeleted)) continue
    const active = isRuleActive(rule) && live
    if (!active && !includeDeleted) continue
    if (rule.sourceId === PERSONAL_CALENDAR_ID) continue
    const source = spaceById.get(rule.sourceId)
    if (!source || !roleOf(source, rule.userId)) continue

    for (const item of items) {
      if (item.spaceId !== source.id || item.createdBy !== rule.userId) continue
      if (item.redaction || item.projection) continue // 不從過濾過的副本或其他投射再投射
      if (rule.kinds.length > 0 && !rule.kinds.includes(item.kind)) continue
      if (item.visibility.mode === 'private' && !rule.includePrivate) continue
      if (!item.start && !rule.includeAllDay) continue
      if (range && (item.dateISO > range.to || (item.endDateISO || item.dateISO) < range.from)) continue

      const removed = item.deletedAt !== null || !active
      if (removed && !includeDeleted) continue
      const updatedAt = Math.max(item.updatedAt, rule.updatedAt)
      out.push({
        id: blockIdFor(rule, item.id, targetSpaceId),
        spaceId: targetSpaceId,
        kind: 'event',
        title: '',
        dateISO: item.dateISO,
        endDateISO: item.endDateISO,
        start: item.start,
        end: item.end,
        location: '',
        note: '',
        details: {},
        visibility: { mode: 'busy_only', allowedUserIds: [], hiddenUserIds: [...item.visibility.hiddenUserIds], busyLabel: rule.display === 'busy' ? rule.label : '', maskedFields: [] },
        createdBy: rule.userId,
        createdAt: item.createdAt,
        // 版本 = 來源行程版本 + 規則的 revision；停用或移除目標時再 +1，讓墓碑蓋過先前送出的區塊
        version: item.version + rule.revision + (active ? 0 : 1),
        updatedAt,
        updatedBy: rule.userId,
        deletedAt: removed ? (item.deletedAt ?? updatedAt) : null,
        projection: rule.display === 'busy' ? { ruleId: rule.id } : { ruleId: rule.id, display: rule.display },
      })
    }
  }
  return out.sort((a, b) => (a.dateISO + a.start).localeCompare(b.dateISO + b.start))
}

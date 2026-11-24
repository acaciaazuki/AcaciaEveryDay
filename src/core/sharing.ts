import { z } from 'zod'
import { EVENT_ICON_KEYS } from './eventIcons'
import { DETAIL_MAX } from './itemDetails'
import type { CalendarEvent } from './schema'

/**
 * 多空間共享行事曆的資料模型。
 *
 * - 使用者可以自由新增任意數量的空間（名稱自訂），每個空間屬於一種類型：
 *   家人 family／學校 school／工作 work／個人 personal。
 * - 每個空間有自己的成員與角色（owner／editor／viewer）。
 * - 每筆行程（SharedCalendarItem）帶有可見性設定，由 permissions.ts 決定每位檢視者看得到什麼。
 *
 * 這份資料和主資料 AppData（acacia_data_v2.json）、自動備份（acacia_backup_v2.json）完全分開，
 * 也不含任何本機專屬設定（例如 acacia-consent 同意紀錄）。
 */

/**
 * 共享行事曆資料版本。
 * - 1：忙閒投射規則是「一個來源空間 → 一個目標空間」（sourceSpaceId／targetSpaceId）
 * - 2：規則改成來源可以是「我的行事曆」、目標可以是全部或多個、可選顯示方式（見 busyProjectionRuleSchema）
 * 讀取時兩種版本都接受（舊規則自動轉換）；遇到比這個更新的版本時丟出 newer 錯誤，提示使用者更新 App。
 */
export const SHARING_SCHEMA_VERSION = 2

/** 「我的行事曆」（個人行程）在忙閒投射規則裡的保留 id；它不是真的空間 */
export const PERSONAL_CALENDAR_ID = 'personal'
/** 忙碌區塊的顯示方式：busy 顯示「忙碌」或自訂文字；time_only 只顯示佔用的時間區間 */
export const BUSY_DISPLAYS = ['busy', 'time_only'] as const
export type BusyDisplay = (typeof BUSY_DISPLAYS)[number]

export const SPACE_KINDS = ['family', 'school', 'work', 'personal'] as const
export type SpaceKind = (typeof SPACE_KINDS)[number]

export const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

/**
 * 行程類型：
 * - event 一般行程
 * - commute 上下班／上下課通勤
 * - class_session 學校課表的一堂課
 * - assignment 作業死線
 * - exam 期中／期末考
 * - homecoming 家人回鄉時段
 * - medical_ride 就醫接送
 * - meeting 工作會議
 * - project_task 工作專案事項
 */
export const ITEM_KINDS = ['event', 'commute', 'class_session', 'assignment', 'exam', 'homecoming', 'medical_ride', 'meeting', 'project_task'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

/** 各空間類型建議優先顯示的行程類型（給新增畫面排序用，不是限制） */
export const SUGGESTED_KINDS: Record<SpaceKind, readonly ItemKind[]> = {
  family: ['homecoming', 'medical_ride', 'commute', 'event'],
  school: ['class_session', 'assignment', 'exam', 'commute', 'event'],
  work: ['meeting', 'project_task', 'commute', 'event'],
  personal: ['event', 'commute', 'medical_ride'],
}

/**
 * 可見性模式：
 * - group_full 空間內成員完整可見
 * - busy_only 只顯示時間與「忙碌」（或自訂 busyLabel），隱藏標題、地點、備註、細節與類型
 * - selected_members 只有 allowedUserIds 白名單內的成員看得到
 * - private 只有建立者看得到
 * 任何模式下，hiddenUserIds 都會再把指定成員排除（建立者本人除外）。
 */
export const VISIBILITY_MODES = ['group_full', 'busy_only', 'selected_members', 'private'] as const
export type VisibilityMode = (typeof VISIBILITY_MODES)[number]

/** 可以個別遮罩的欄位；遮罩只對建立者以外的人生效 */
export const MASKABLE_FIELDS = ['title', 'location', 'note', 'details', 'kind'] as const
export type MaskableField = (typeof MASKABLE_FIELDS)[number]

export const BUSY_LABEL_MAX = 20
export const SPACE_NAME_MAX = 40

const id = z.string().min(1)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal(''))
const timestamp = z.number().int().nonnegative()

export const spaceMemberSchema = z.object({
  userId: id,
  role: z.enum(MEMBER_ROLES),
  /** 顯示名稱（例如「媽媽」），只在空間內使用 */
  displayName: z.string().max(40).default(''),
  joinedAt: timestamp.default(0),
})

export const spaceSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(SPACE_NAME_MAX),
    kind: z.enum(SPACE_KINDS),
    color: z.string().optional(),
    members: z.array(spaceMemberSchema),
    createdBy: id,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: z.number().int().nonnegative().default(1),
    deletedAt: timestamp.nullable().default(null),
  })
  .superRefine((s, ctx) => {
    if (!s.members.some((m) => m.role === 'owner')) ctx.addIssue({ code: 'custom', message: '空間至少要有一位 owner', path: ['members'] })
    const ids = s.members.map((m) => m.userId)
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: '成員重複', path: ['members'] })
  })

export const visibilitySchema = z.object({
  mode: z.enum(VISIBILITY_MODES).default('group_full'),
  /** selected_members 模式的白名單 */
  allowedUserIds: z.array(id).default([]),
  /** 不論哪種模式，都對這些成員隱藏（家庭內部局部隱藏，例如準備驚喜） */
  hiddenUserIds: z.array(id).default([]),
  /** busy_only 時顯示的文字，空字串表示用預設的「忙碌」 */
  busyLabel: z.string().max(BUSY_LABEL_MAX).default(''),
  /** 對建立者以外的人遮罩的欄位 */
  maskedFields: z.array(z.enum(MASKABLE_FIELDS)).default([]),
})

export const sharedCalendarItemSchema = z.object({
  id,
  spaceId: id,
  kind: z.enum(ITEM_KINDS).default('event'),
  title: z.string().default(''),
  dateISO: isoDate,
  /** 跨日行程的結束日；空字串表示同一天 */
  endDateISO: isoDate.or(z.literal('')).default(''),
  start: hhmm.default(''),
  end: hhmm.default(''),
  location: z.string().default(''),
  note: z.string().default(''),
  /**
   * 依類型而定的細節，例如課程的老師、教室，會議的連結，就醫的科別。
   * 統一當作敏感欄位處理（busy_only 或遮罩 details 時整包移除）。
   */
  details: z.record(z.string(), z.string().max(DETAIL_MAX)).default({}),
  titleColor: z.string().optional(),
  bgColor: z.string().optional(),
  icon: z.enum(EVENT_ICON_KEYS).optional(),
  visibility: visibilitySchema.default(() => visibilitySchema.parse({})),
  createdBy: id,
  createdAt: timestamp,
  /** 同步用：每次修改 +1 */
  version: z.number().int().nonnegative().default(1),
  updatedAt: timestamp,
  updatedBy: id.optional(),
  /** 軟刪除時間；null 表示仍存在 */
  deletedAt: timestamp.nullable().default(null),
  /**
   * 只出現在「經過權限過濾後」收到的副本：masked 表示部分欄位被遮罩，busy 表示只剩忙閒。
   * 這種副本不是權威資料，永遠不會被推送回雲端或伺服器。
   */
  redaction: z.enum(['masked', 'busy']).optional(),
  /** 由忙閒投射規則產生的忙碌區塊；只記規則 id 與顯示方式，不記來源行程或來源空間 */
  projection: z.object({ ruleId: id, display: z.enum(BUSY_DISPLAYS).optional() }).optional(),
})

/**
 * 跨空間忙閒投射規則（v2）：把 userId 本人在來源（某個空間，或「我的行事曆」）的行程，
 * 以忙碌區塊的形式投射到目標行事曆（例如把開刀房的排班投射到學校空間，只顯示「上班中」）。
 * 規則屬於個人設定，只能投射自己建立的行程。
 *
 * 相容性：
 * - 讀取時接受 v1 規則（sourceSpaceId／targetSpaceId），自動轉成 v2（見 upgradeLegacyRule）
 * - 能用 v1 完整表示的規則（isLegacyRepresentable），寫出時附上 v1 欄位，讓還沒更新的 App 照常讀寫
 */
const busyProjectionRuleObject = z.object({
  id,
  userId: id,
  /** 來源：空間 id，或 PERSONAL_CALENDAR_ID */
  sourceId: id,
  /** all：我所在的全部行事曆（含之後新加入的空間與「我的行事曆」）；selected：只投射到 targetIds */
  targetMode: z.enum(['all', 'selected']).default('selected'),
  /** 勾選的目標（空間 id 或 PERSONAL_CALENDAR_ID）；targetMode 為 all 時不使用 */
  targetIds: z.array(id).default([]),
  /** 顯示方式 */
  display: z.enum(BUSY_DISPLAYS).default('busy'),
  /** 只投射這些類型；空陣列表示全部（只對空間來源有效） */
  kinds: z.array(z.enum(ITEM_KINDS)).default([]),
  /** 目標空間看到的文字，例如「上班中」；空字串用預設的「忙碌」（只在 display 為 busy 時使用） */
  label: z.string().max(BUSY_LABEL_MAX).default(''),
  /** private 行程預設不投射（連「有事」都不透露），要明確開啟（只對空間來源有效） */
  includePrivate: z.boolean().default(false),
  /** 沒有時間的整天行程要不要投射成整天忙碌；新規則預設不要，v1 規則轉換時為 true（維持原本行為） */
  includeAllDay: z.boolean().default(false),
  /**
   * 目標變更的次數（每次 +2），算進忙碌區塊的版本：
   * 區塊版本 = 來源行程版本 + revision，墓碑再 +1；重新加回目標時 +2，確保新區塊蓋過先前的墓碑。
   */
  revision: z.number().int().nonnegative().default(0),
  /** 從目標移除的行事曆：同步時送墓碑給這些空間，讓其他成員移除舊的忙碌區塊 */
  retiredTargetIds: z.array(id).default([]),
  /** v1 規則原本的目標：這個目標的區塊沿用 v1 的 id，其他成員手上的舊區塊才能被更新或移除 */
  legacyTargetId: id.optional(),
  enabled: z.boolean().default(true),
  updatedAt: timestamp.default(0),
  /** 軟刪除：刪除的規則也要同步出去，否則其他裝置會把它帶回來 */
  deletedAt: timestamp.nullable().default(null),
})

/** v1 規則（只有 sourceSpaceId／targetSpaceId）轉成 v2；已經是 v2 的原樣回傳 */
export function upgradeLegacyRule(raw: unknown): unknown {
  if (!isObj(raw) || 'sourceId' in raw || typeof raw.sourceSpaceId !== 'string' || typeof raw.targetSpaceId !== 'string') return raw
  const { sourceSpaceId, targetSpaceId, ...rest } = raw
  return { ...rest, sourceId: sourceSpaceId, targetMode: 'selected', targetIds: [targetSpaceId], display: 'busy', includeAllDay: true, legacyTargetId: targetSpaceId }
}

export const busyProjectionRuleSchema = z.preprocess(
  upgradeLegacyRule,
  busyProjectionRuleObject
    .refine((r) => r.targetMode === 'all' || r.targetIds.length > 0, { message: '至少要選一個目標行事曆', path: ['targetIds'] })
    .refine((r) => !r.targetIds.includes(r.sourceId), { message: '來源與目標不能相同', path: ['targetIds'] }),
)

/**
 * 這條規則能不能用 v1 完整表示（舊版 App 讀寫後不會遺失任何設定）：
 * 來源是空間、只有一個目標空間（而且就是 legacyTargetId）、顯示「忙碌」、整天行程照投射、目標沒改過。
 */
export function isLegacyRepresentable(r: BusyProjectionRule): boolean {
  return (
    r.sourceId !== PERSONAL_CALENDAR_ID &&
    r.targetMode === 'selected' &&
    r.targetIds.length === 1 &&
    r.targetIds[0] !== PERSONAL_CALENDAR_ID &&
    r.targetIds[0] === r.legacyTargetId &&
    r.display === 'busy' &&
    r.includeAllDay &&
    r.revision === 0 &&
    r.retiredTargetIds.length === 0
  )
}

/** 寫到雲端／伺服器的規則：能用 v1 表示時附上 v1 欄位，舊版 App 才讀得懂 */
export const toWireRule = (r: BusyProjectionRule) => (isLegacyRepresentable(r) ? { ...r, sourceSpaceId: r.sourceId, targetSpaceId: r.targetIds[0] } : r)

/**
 * 規則實際投射到哪些行事曆：
 * - all：規則擁有者所在的每個空間（已刪除或已退出的不算）＋「我的行事曆」
 * - selected：勾選的目標裡，擁有者仍是成員的空間＋「我的行事曆」
 * 來源本身一律排除。
 */
export function ruleTargets(rule: BusyProjectionRule, spaces: readonly Pick<Space, 'id' | 'members' | 'deletedAt'>[]): string[] {
  const member = new Set(spaces.filter((s) => roleOf(s, rule.userId)).map((s) => s.id))
  const wanted = rule.targetMode === 'all' ? [...member, PERSONAL_CALENDAR_ID] : rule.targetIds
  return [...new Set(wanted)].filter((t) => t !== rule.sourceId && (t === PERSONAL_CALENDAR_ID || member.has(t)))
}

export const sharedCalendarDataSchema = z.object({
  /** 讀取時接受 v1（規則格式較舊，由 busyProjectionRuleSchema 自動轉換），輸出一律是目前版本 */
  schemaVersion: z.union([z.literal(1), z.literal(SHARING_SCHEMA_VERSION)]).transform(() => SHARING_SCHEMA_VERSION),
  /** 這份資料屬於哪位使用者（本機／這個雲端帳號） */
  ownerId: id,
  spaces: z.array(spaceSchema).default([]),
  items: z.array(sharedCalendarItemSchema).default([]),
  busyProjectionRules: z.array(busyProjectionRuleSchema).default([]),
  updatedAt: timestamp.default(0),
})

export type SpaceMember = z.infer<typeof spaceMemberSchema>
export type Space = z.infer<typeof spaceSchema>
export type Visibility = z.infer<typeof visibilitySchema>
export type SharedCalendarItem = z.infer<typeof sharedCalendarItemSchema>
export type SharedCalendarItemInput = z.input<typeof sharedCalendarItemSchema>
export type BusyProjectionRule = z.infer<typeof busyProjectionRuleSchema>
export type SharedCalendarData = z.infer<typeof sharedCalendarDataSchema>

export const emptySharedCalendarData = (ownerId: string): SharedCalendarData => ({
  schemaVersion: SHARING_SCHEMA_VERSION,
  ownerId,
  spaces: [],
  items: [],
  busyProjectionRules: [],
  updatedAt: 0,
})

export const defaultVisibility = (overrides: Partial<Visibility> = {}): Visibility => visibilitySchema.parse(overrides)

/** 新增行程時的類型選單順序：該空間類型建議的排前面，其他接在後面 */
export const orderedKinds = (kind: SpaceKind): ItemKind[] => {
  const first = SUGGESTED_KINDS[kind]
  return [...first, ...ITEM_KINDS.filter((k) => !first.includes(k))]
}

// ---------- 空間與成員 ----------

/** 檢視者在空間裡的角色；不是成員（或空間已刪除）回傳 null */
export function roleOf(space: Pick<Space, 'members' | 'deletedAt'>, userId: string): MemberRole | null {
  if (space.deletedAt !== null) return null
  return space.members.find((m) => m.userId === userId)?.role ?? null
}

export const isMember = (space: Pick<Space, 'members' | 'deletedAt'>, userId: string) => roleOf(space, userId) !== null

/** 只有 owner 能改空間名稱、成員與角色 */
export const canManageSpace = (space: Pick<Space, 'members' | 'deletedAt'>, userId: string) => roleOf(space, userId) === 'owner'

/** 新增空間（使用者可自由新增任意名稱、任意數量的空間），建立者自動成為 owner */
export function createSpace(input: { id: string; name: string; kind: SpaceKind; ownerId: string; now: number; color?: string; displayName?: string }): Space {
  return spaceSchema.parse({
    id: input.id,
    name: input.name,
    kind: input.kind,
    color: input.color,
    members: [{ userId: input.ownerId, role: 'owner', displayName: input.displayName ?? '', joinedAt: input.now }],
    createdBy: input.ownerId,
    createdAt: input.now,
    updatedAt: input.now,
  })
}

export class SpaceMembershipError extends Error {}

/**
 * 新增或變更成員角色（只有 owner 能做）。
 * 不允許把最後一位 owner 降級，避免空間變成沒人能管理。
 */
export function upsertMember(space: Space, actorId: string, member: { userId: string; role: MemberRole; displayName?: string }, now: number): Space {
  if (!canManageSpace(space, actorId)) throw new SpaceMembershipError('只有 owner 可以管理成員')
  const existing = space.members.find((m) => m.userId === member.userId)
  const members = existing
    ? space.members.map((m) => (m.userId === member.userId ? { ...m, role: member.role, displayName: member.displayName ?? m.displayName } : m))
    : [...space.members, { userId: member.userId, role: member.role, displayName: member.displayName ?? '', joinedAt: now }]
  if (!members.some((m) => m.role === 'owner')) throw new SpaceMembershipError('空間至少要保留一位 owner')
  return { ...space, members, updatedAt: now, version: space.version + 1 }
}

/** 移除成員（owner 可以移除別人；任何人都可以自己退出，但最後一位 owner 不能退出） */
export function removeMember(space: Space, actorId: string, userId: string, now: number): Space {
  if (actorId !== userId && !canManageSpace(space, actorId)) throw new SpaceMembershipError('只有 owner 可以移除成員')
  const members = space.members.filter((m) => m.userId !== userId)
  if (!members.some((m) => m.role === 'owner')) throw new SpaceMembershipError('空間至少要保留一位 owner')
  return { ...space, members, updatedAt: now, version: space.version + 1 }
}

/** 規則目前是否生效（啟用中而且沒被刪除） */
export const isRuleActive = (r: Pick<BusyProjectionRule, 'enabled' | 'deletedAt'>) => r.enabled && r.deletedAt === null

/**
 * 把資料裡「自己」的 id 全部換成另一個 id。
 * Drive 同步時，每台裝置一開始各自產生 local-… 的 id；第二台裝置開啟同步時改用雲端檔案的 id，
 * 讓所有裝置共用同一個身分（不使用 Google 帳號識別碼）。
 */
export function rekeyOwner(data: SharedCalendarData, from: string, to: string): SharedCalendarData {
  if (from === to) return data
  const swap = (id: string) => (id === from ? to : id)
  const swapAll = (ids: string[]) => [...new Set(ids.map(swap))]
  return {
    ...data,
    ownerId: swap(data.ownerId),
    spaces: data.spaces.map((s) => ({
      ...s,
      createdBy: swap(s.createdBy),
      // 雲端身分本來就是成員時（理論上不會發生），保留角色較高的那一筆
      members: s.members.map((m) => ({ ...m, userId: swap(m.userId) })).filter((m, i, all) => all.findIndex((x) => x.userId === m.userId) === i),
    })),
    items: data.items.map((i) => ({
      ...i,
      createdBy: swap(i.createdBy),
      ...(i.updatedBy !== undefined && { updatedBy: swap(i.updatedBy) }),
      visibility: { ...i.visibility, allowedUserIds: swapAll(i.visibility.allowedUserIds), hiddenUserIds: swapAll(i.visibility.hiddenUserIds) },
    })),
    busyProjectionRules: data.busyProjectionRules.map((r) => ({ ...r, userId: swap(r.userId) })),
  }
}

// ---------- 舊資料相容／遷移（對齊 migrate.ts 的風格） ----------

export class SharingMigrationError extends Error {
  /** newer：資料來自較新版本的 App，需要先更新 */
  readonly reason: 'invalid' | 'newer'
  constructor(message: string, reason: 'invalid' | 'newer' = 'invalid') {
    super(message)
    this.reason = reason
  }
}

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * 把現有個人行事曆的 CalendarEvent 轉成個人空間的共享行程。
 * 預設 private：轉過去後不會因為之後把空間分享出去就意外公開。
 */
export function calendarEventToSharedItem(event: CalendarEvent, ctx: { spaceId: string; userId: string; now: number; visibility?: Partial<Visibility> }): SharedCalendarItem {
  return sharedCalendarItemSchema.parse({
    id: event.id,
    spaceId: ctx.spaceId,
    kind: 'event',
    title: event.title,
    // 舊資料可能沒有日期（dateISO 為空字串），以建立當天代替，避免整筆遺失
    dateISO: /^\d{4}-\d{2}-\d{2}$/.test(event.dateISO) ? event.dateISO : new Date(ctx.now).toISOString().slice(0, 10),
    start: event.start,
    end: event.end,
    note: event.note,
    titleColor: event.titleColor,
    bgColor: event.bgColor,
    icon: event.icon,
    visibility: { mode: 'private', ...ctx.visibility },
    createdBy: ctx.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  })
}

/**
 * 建立「個人」空間並把現有行程搬進去。不會修改原本的 AppData，
 * 主資料、acacia_data_v2.json 與備份都維持原樣（SCHEMA_VERSION 不變）。
 */
export function importPersonalCalendar(events: CalendarEvent[], ctx: { ownerId: string; spaceId: string; spaceName: string; now: number }): SharedCalendarData {
  const space = createSpace({ id: ctx.spaceId, name: ctx.spaceName, kind: 'personal', ownerId: ctx.ownerId, now: ctx.now })
  return {
    ...emptySharedCalendarData(ctx.ownerId),
    spaces: [space],
    items: events.map((e) => calendarEventToSharedItem(e, { spaceId: space.id, userId: ctx.ownerId, now: ctx.now })),
    updatedAt: ctx.now,
  }
}

/**
 * 把任何版本的共享行事曆資料轉成目前版本，驗證失敗丟出 SharingMigrationError（呼叫端應保留原始資料）。
 * - 目前版本：直接驗證（缺少的欄位補預設值、未知欄位捨棄）
 * - 個人主資料（AppData v2 或沒有版本的舊網站資料，有 events 陣列、沒有 spaces）：需要 ctx 才能轉成個人空間
 */
export function migrateSharedCalendarData(raw: unknown, ctx?: { ownerId: string; spaceId: string; spaceName: string; now: number }): SharedCalendarData {
  if (!isObj(raw)) throw new SharingMigrationError('資料格式不是物件')
  // 個人主資料（AppData，目前也是版本 2）要先判斷，避免跟共享資料的版本號混淆
  if (Array.isArray(raw.events) && !('spaces' in raw) && ctx) {
    const events = raw.events.filter(isObj).map((e) => ({
      id: String(e.id ?? crypto.randomUUID()),
      title: typeof e.title === 'string' ? e.title : '',
      dateISO: typeof e.dateISO === 'string' ? e.dateISO : '',
      start: typeof e.start === 'string' ? e.start : '',
      end: typeof e.end === 'string' ? e.end : '',
      note: typeof e.note === 'string' ? e.note : '',
    }))
    try {
      return importPersonalCalendar(events, ctx)
    } catch (e) {
      throw new SharingMigrationError(e instanceof Error ? e.message : String(e))
    }
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SHARING_SCHEMA_VERSION) {
    throw new SharingMigrationError(`這份共享行事曆資料來自較新版本的 ACACIA（版本 ${raw.schemaVersion}），請先更新 App`, 'newer')
  }
  if (raw.schemaVersion === 1 || raw.schemaVersion === SHARING_SCHEMA_VERSION) {
    const parsed = sharedCalendarDataSchema.safeParse(raw)
    if (!parsed.success) throw new SharingMigrationError(parsed.error.message)
    return parsed.data
  }
  throw new SharingMigrationError(`不支援的共享行事曆版本：${String(raw.schemaVersion)}`)
}

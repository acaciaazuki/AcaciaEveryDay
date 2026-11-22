import { EVENT_ICON_KEYS } from './eventIcons'
import { z } from 'zod'
import { EXPENSE_CATEGORIES, PLACE_CATEGORY_KEYS } from './categories'

export const SCHEMA_VERSION = 2

const id = z.string().min(1)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''))
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal(''))
const color = z.string().optional()

export const eventSchema = z.object({
  id,
  title: z.string(),
  dateISO: isoDate,
  start: hhmm,
  end: hhmm,
  note: z.string().default(''),
  titleColor: color,
  bgColor: color,
  /** 手動選的生活小圖示；沒選就依標題關鍵字自動判斷 */
  icon: z.enum(EVENT_ICON_KEYS).optional(),
})

export const taskSchema = z.object({
  id,
  title: z.string(),
  loc: z.string().default(''),
  date: isoDate.default(''),
  time: hhmm.default(''),
  done: z.boolean().default(false),
  titleColor: color,
  bgColor: color,
})

export const expenseSchema = z.object({
  id,
  title: z.string(),
  amt: z.number().default(0),
  store: z.string().default(''),
  /** 內建類別代碼 */
  cat: z.enum(EXPENSE_CATEGORIES).default('other'),
  /** cat 為 other 時，使用者自訂的類別名稱（不翻譯） */
  customCat: z.string().optional(),
  /** 數量與單價（選填）。amt 永遠是總金額，舊資料沒有這兩個欄位 */
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  date: isoDate.default(''),
  time: hhmm.default(''),
  done: z.boolean().default(false),
  titleColor: color,
  bgColor: color,
})

export const placeSchema = z.object({
  id,
  name: z.string(),
  cat: z.enum(PLACE_CATEGORY_KEYS as [string, ...string[]]).default('other'),
  address: z.string().default(''),
  hours: z.string().default(''),
  note: z.string().default(''),
  url: z.string().default(''),
  bgColor: color,
})

export const FONT_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export type FontSize = (typeof FONT_SIZES)[number]
/** 文字縮放倍率，對應 CSS 變數 --fs */
export const FONT_SCALE: Record<FontSize, number> = { sm: 0.9, md: 1, lg: 1.15, xl: 1.3 }

export const settingsSchema = z.object({
  fontSize: z.enum(FONT_SIZES).default('md'),
})

export const REMINDER_RADII = [100, 300, 500] as const
export const REMINDER_DAYS = ['every', 'weekdays', 'weekends', 'custom'] as const

/** 防遺漏提醒：到（或離開）某個地點、符合星期與時段時，提醒要帶的隨身物品 */
export const reminderSchema = z.object({
  id,
  place: z.string().default(''),
  /** 地點座標；沒有座標的規則會保留但不會被偵測 */
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** 從最愛地點帶入時記下來源，純參考用 */
  placeId: z.string().optional(),
  radius: z.union([z.literal(100), z.literal(300), z.literal(500)]).default(300),
  trigger: z.enum(['arrive', 'leave']).default('leave'),
  days: z.enum(REMINDER_DAYS).default('every'),
  /** days 為 custom 時使用，0 是星期日、6 是星期六 */
  customDays: z.array(z.number().int().min(0).max(6)).default([]),
  start: hhmm.default(''),
  end: hhmm.default(''),
  items: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
})

export const SUB_CYCLES = ['monthly', 'quarterly', 'yearly'] as const
export const SUB_STATUSES = ['active', 'paused', 'cancelled'] as const
export const SUB_CATEGORIES = ['entertainment', 'tools', 'work', 'learning', 'life', 'other'] as const
/** 下拉選單提供的幣別；資料本身接受任何三碼 ISO 幣別 */
export const SUB_CURRENCIES = ['TWD', 'JPY', 'USD', 'EUR', 'HKD', 'CNY', 'KRW', 'GBP'] as const

/** 訂閱與續費：定期扣款的服務（Netflix、iCloud…） */
export const subscriptionSchema = z.object({
  id,
  name: z.string(),
  /** 方案（Pro、Plus、學生、試用、親友分享…），自由輸入 */
  plan: z.string().default(''),
  cat: z.enum(SUB_CATEGORIES).default('other'),
  cycle: z.enum(SUB_CYCLES).default('monthly'),
  amount: z.number().default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('TWD'),
  /** 下次扣款日。過了之後畫面會依週期自動往後推算，不必手動改 */
  nextDate: isoDate.default(''),
  payment: z.string().default(''),
  status: z.enum(SUB_STATUSES).default('active'),
  note: z.string().default(''),
})

/** 一個已結算的記帳週期。start 是週期開始日，同時也是這筆歸檔的識別，年度記帳本依 start 的年份歸屬 */
export const archiveSchema = z.object({
  start: isoDate,
  end: isoDate,
  archivedAt: z.number().default(0),
  expenses: z.array(expenseSchema),
})

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** 使用者設定（字體大小…），舊資料沒有時補預設值 */
  settings: settingsSchema.default({ fontSize: 'md' }),
  events: z.array(eventSchema),
  tasks: z.array(taskSchema),
  shopping: z.array(expenseSchema),
  places: z.array(placeSchema),
  favorites: z.array(id),
  reminders: z.array(reminderSchema).default([]),
  /** 已歸檔的記帳週期；舊版資料沒有這個欄位，讀進來時補空陣列 */
  archives: z.array(archiveSchema).default([]),
  /** 訂閱與續費；舊資料沒有這個欄位，讀進來時補空陣列 */
  subscriptions: z.array(subscriptionSchema).default([]),
  /** 是否已經帶入過範例訂閱（只帶一次，刪光後不會再出現） */
  subscriptionsSeeded: z.boolean().default(false),
  updatedAt: z.number(),
})

export type CalendarEvent = z.infer<typeof eventSchema>
export type Task = z.infer<typeof taskSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Settings = z.infer<typeof settingsSchema>
export type Reminder = z.infer<typeof reminderSchema>
export type Subscription = z.infer<typeof subscriptionSchema>
export type SubCycle = (typeof SUB_CYCLES)[number]
export type SubStatus = (typeof SUB_STATUSES)[number]
export type SubCategory = (typeof SUB_CATEGORIES)[number]
export type Archive = z.infer<typeof archiveSchema>
export type Place = z.infer<typeof placeSchema>
export type AppData = z.infer<typeof appDataSchema>

export const emptyAppData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  settings: { fontSize: 'md' },
  events: [],
  tasks: [],
  shopping: [],
  places: [],
  favorites: [],
  reminders: [],
  archives: [],
  subscriptions: [],
  subscriptionsSeeded: false,
  updatedAt: 0,
})

export const newId = (): string => crypto.randomUUID()

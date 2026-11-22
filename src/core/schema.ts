import { EVENT_ICON_KEYS } from './eventIcons'
import { z } from 'zod'
import { EXPENSE_CATEGORIES, PLACE_CATEGORY_KEYS } from './categories'

export const SCHEMA_VERSION = 2

const id = z.string().min(1)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''))
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal(''))
const color = z.string().optional()
/** 跟下面的 DEFAULT_CURRENCY 相同；範本 schema 定義在前面，先用這個常數 */
const DEFAULT_CURRENCY_CODE = 'TWD'

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
  /**
   * 這一筆的貨幣：三碼 ISO 幣別（TWD、USD…）或使用者自訂的幣別符號（฿、RM、點…）。
   * 舊資料沒有這個欄位，顯示與統計時當作設定頁的預設貨幣（跟加這個欄位之前的畫面一模一樣）。
   */
  currency: z.string().trim().min(1).max(8).optional(),
  date: isoDate.default(''),
  time: hhmm.default(''),
  done: z.boolean().default(false),
  titleColor: color,
  bgColor: color,
  /** 備註（選填）。從固定支出批次帶入時可以填，例如「本期含漫遊費」 */
  note: z.string().optional(),
  /** 從哪一個固定支出範本帶入；手動新增的記帳沒有 */
  recurringId: z.string().optional(),
  /** 帶入的是哪一期（週期開始日）。「範本 id＋週期」用來判斷本期是否已加入，避免重複 */
  recurringPeriod: isoDate.optional(),
  /** 分期款帶入時是第幾期，刪掉這一筆時用來退回範本的期數 */
  installment: z.number().int().min(1).optional(),
  /**
   * 打勾（買到）時自動補進哪一個庫存用品、補了多少。用來避免重複入庫：
   * 有這兩個欄位就代表這一筆已經入庫過；取消打勾時依此扣回並清掉。舊資料沒有這兩個欄位
   */
  stockedItemId: z.string().optional(),
  stockedQty: z.number().optional(),
})

/**
 * 週期固定支出範本：每期都要付的款項（手機月費、信用卡分期、貸款、管理費、保險月繳…）。
 * 範本本身不算支出，在記帳本按「批次加入固定支出」才會寫成本期的記帳。
 */
export const recurringSchema = z.object({
  id,
  name: z.string(),
  cat: z.enum(EXPENSE_CATEGORIES).default('other'),
  customCat: z.string().optional(),
  amount: z.number().min(0).default(0),
  /** 跟記帳一樣：三碼 ISO 幣別或自訂符號 */
  currency: z.string().trim().min(1).max(8).default(DEFAULT_CURRENCY_CODE),
  /** 每月扣款／入帳日（1–31）。小於 10 的日期落在週期的下個月；該月沒有那一天時用月底 */
  day: z.number().int().min(1).max(31).default(10),
  note: z.string().default(''),
  /** 批次加入時一次從本期起連續產生幾個月（1–12）。舊資料沒有這個欄位時當 1 個月 */
  batchMonths: z.number().int().min(1).max(12).default(1),
  /**
   * 分期（選填）：total 總期數、next 下一次帶入是第幾期（＝已付到第幾期＋1）。
   * 表單上顯示的是「已付到第幾期」(next − 1)，儲存仍用 next，舊資料不用轉換。
   * 帶入後 next 加 1，超過 total 就自動標記完成
   */
  installments: z.object({ total: z.number().int().min(1), next: z.number().int().min(1) }).optional(),
  /** 已完成（分期繳清或不再扣款）：不會出現在批次帶入清單 */
  done: z.boolean().default(false),
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

/** 設定頁「預設貨幣」提供的幣別（第一個是預設值）；資料本身接受任何三碼 ISO 幣別 */
export const CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'KRW', 'GBP'] as const
export const DEFAULT_CURRENCY = 'TWD'
const currencyCode = z.string().regex(/^[A-Z]{3}$/)

export const settingsSchema = z.object({
  fontSize: z.enum(FONT_SIZES).default('md'),
  /** 預設貨幣：記帳金額的顯示幣別，也是新增訂閱時預先帶入的幣別。不做匯率換算 */
  currency: currencyCode.default(DEFAULT_CURRENCY),
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
/** 訂閱表單下拉選單提供的幣別，跟設定頁的預設貨幣同一份清單 */
export const SUB_CURRENCIES = CURRENCIES

/** 訂閱與續費：定期扣款的服務（Netflix、iCloud…） */
export const subscriptionSchema = z.object({
  id,
  name: z.string(),
  /** 方案（Pro、Plus、學生、試用、親友分享…），自由輸入 */
  plan: z.string().default(''),
  cat: z.enum(SUB_CATEGORIES).default('other'),
  cycle: z.enum(SUB_CYCLES).default('monthly'),
  amount: z.number().default(0),
  currency: currencyCode.default(DEFAULT_CURRENCY),
  /** 下次扣款日。過了之後畫面會依週期自動往後推算，不必手動改 */
  nextDate: isoDate.default(''),
  payment: z.string().default(''),
  status: z.enum(SUB_STATUSES).default('active'),
  note: z.string().default(''),
})

export const INV_CATEGORIES = ['personal', 'home', 'kitchen', 'health', 'skincare', 'stationery', 'other'] as const

/** 庫存與到期提醒：家裡的備品與耗材（牙刷、衛生紙、洗碗精…） */
export const inventoryItemSchema = z.object({
  id,
  name: z.string(),
  cat: z.enum(INV_CATEGORIES).default('home'),
  /** 單位（支、包、瓶…），自由輸入 */
  unit: z.string().default(''),
  /** 目前庫存與最低安全庫存量：庫存低於安全庫存就算待補貨（等於安全庫存算足夠） */
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(1),
  /** 上次更換日與更換週期（天）。週期 0 代表不追蹤更換 */
  lastReplaced: isoDate.default(''),
  cycleDays: z.number().int().min(0).default(0),
  /** 未開封有效期限（選填） */
  expiry: isoDate.default(''),
  /** 開封日與開封後可用月數（PAO，0 代表不追蹤） */
  openedDate: isoDate.default(''),
  paoMonths: z.number().int().min(0).default(0),
  note: z.string().default(''),
  /** 加入購物清單時記下那一筆的 id，用來顯示「已在購物清單中」 */
  shoppingId: z.string().optional(),
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
  settings: settingsSchema.default({ fontSize: 'md', currency: DEFAULT_CURRENCY }),
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
  /** 庫存與到期提醒；舊資料沒有這個欄位，讀進來時補空陣列 */
  inventory: z.array(inventoryItemSchema).default([]),
  /** 是否已經帶入過範例用品（只帶一次） */
  inventorySeeded: z.boolean().default(false),
  /** 週期固定支出範本；舊資料沒有這個欄位，讀進來時補空陣列 */
  recurring: z.array(recurringSchema).default([]),
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
export type InventoryItem = z.infer<typeof inventoryItemSchema>
export type InvCategory = (typeof INV_CATEGORIES)[number]
export type Recurring = z.infer<typeof recurringSchema>
export type Archive = z.infer<typeof archiveSchema>
export type Place = z.infer<typeof placeSchema>
export type AppData = z.infer<typeof appDataSchema>

export const emptyAppData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  settings: { fontSize: 'md', currency: DEFAULT_CURRENCY },
  events: [],
  tasks: [],
  shopping: [],
  places: [],
  favorites: [],
  reminders: [],
  archives: [],
  subscriptions: [],
  subscriptionsSeeded: false,
  inventory: [],
  inventorySeeded: false,
  recurring: [],
  updatedAt: 0,
})

export const newId = (): string => crypto.randomUUID()

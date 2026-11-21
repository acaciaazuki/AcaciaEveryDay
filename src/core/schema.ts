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

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  events: z.array(eventSchema),
  tasks: z.array(taskSchema),
  shopping: z.array(expenseSchema),
  places: z.array(placeSchema),
  favorites: z.array(id),
  reminders: z.array(reminderSchema).default([]),
  updatedAt: z.number(),
})

export type CalendarEvent = z.infer<typeof eventSchema>
export type Task = z.infer<typeof taskSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Reminder = z.infer<typeof reminderSchema>
export type Place = z.infer<typeof placeSchema>
export type AppData = z.infer<typeof appDataSchema>

export const emptyAppData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  events: [],
  tasks: [],
  shopping: [],
  places: [],
  favorites: [],
  reminders: [],
  updatedAt: 0,
})

export const newId = (): string => crypto.randomUUID()

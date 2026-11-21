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

/** 一個已結算的記帳週期。start 是週期開始日，同時也是這筆歸檔的識別，年度記帳本依 start 的年份歸屬 */
export const archiveSchema = z.object({
  start: isoDate,
  end: isoDate,
  archivedAt: z.number().default(0),
  expenses: z.array(expenseSchema),
})

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  events: z.array(eventSchema),
  tasks: z.array(taskSchema),
  shopping: z.array(expenseSchema),
  places: z.array(placeSchema),
  favorites: z.array(id),
  /** 已歸檔的記帳週期；舊版資料沒有這個欄位，讀進來時補空陣列 */
  archives: z.array(archiveSchema).default([]),
  updatedAt: z.number(),
})

export type CalendarEvent = z.infer<typeof eventSchema>
export type Task = z.infer<typeof taskSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Archive = z.infer<typeof archiveSchema>
export type Place = z.infer<typeof placeSchema>
export type AppData = z.infer<typeof appDataSchema>

export const emptyAppData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  events: [],
  tasks: [],
  shopping: [],
  places: [],
  favorites: [],
  archives: [],
  updatedAt: 0,
})

export const newId = (): string => crypto.randomUUID()

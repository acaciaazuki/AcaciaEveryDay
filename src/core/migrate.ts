import { LEGACY_EXPENSE_CATEGORY, LEGACY_PLACE_CATEGORY } from './categories'
import { appDataSchema, emptyAppData, SCHEMA_VERSION, type AppData } from './schema'

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter(isObj) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/** 舊版 id 是 Date.now() 數字，轉成字串保留原值，favorites 才對得上 */
const legacyId = (v: unknown): string => (v == null || v === '' ? crypto.randomUUID() : String(v))

export class MigrationError extends Error {}

/**
 * 把任何版本的資料（舊版 acacia_data、匯出的 JSON、新版資料）轉成目前版本。
 * 驗證失敗時丟出 MigrationError，呼叫端應保留原始資料、不覆蓋。
 */
export function migrate(raw: unknown): AppData {
  if (!isObj(raw)) throw new MigrationError('資料格式不是物件')

  if (raw.schemaVersion === SCHEMA_VERSION) {
    const parsed = appDataSchema.safeParse(raw)
    if (!parsed.success) throw new MigrationError(parsed.error.message)
    return parsed.data
  }

  if (raw.schemaVersion !== undefined) {
    throw new MigrationError(`不支援的資料版本：${String(raw.schemaVersion)}`)
  }

  // v1：舊版單檔網站
  const data: AppData = {
    ...emptyAppData(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    events: arr(raw.events).map((e) => ({
      id: legacyId(e.id),
      title: str(e.title),
      dateISO: str(e.dateISO),
      start: str(e.start),
      end: str(e.end),
      note: str(e.note),
      titleColor: optStr(e.titleColor),
      bgColor: optStr(e.bgColor),
    })),
    tasks: arr(raw.tasks).map((t) => ({
      id: legacyId(t.id),
      title: str(t.title),
      loc: str(t.loc),
      date: str(t.date),
      time: str(t.time),
      done: Boolean(t.done),
      titleColor: optStr(t.titleColor),
      bgColor: optStr(t.bgColor),
    })),
    shopping: arr(raw.shopping).map((s) => {
      const label = str(s.cat)
      const cat = LEGACY_EXPENSE_CATEGORY[label] ?? 'other'
      return {
        id: legacyId(s.id),
        title: str(s.title),
        amt: Number(s.amt) || 0,
        store: str(s.store),
        cat,
        customCat: cat === 'other' && label && label !== '其他' ? label : undefined,
        date: str(s.date),
        time: str(s.time),
        done: Boolean(s.done),
        titleColor: optStr(s.titleColor),
        bgColor: optStr(s.bgColor),
      }
    }),
    places: arr(raw.places).map((p) => ({
      id: legacyId(p.id),
      name: str(p.name),
      cat: LEGACY_PLACE_CATEGORY[str(p.cat)] ?? 'other',
      address: str(p.address),
      hours: str(p.hours),
      note: str(p.note),
      url: str(p.url),
      bgColor: optStr(p.bgColor),
    })),
    favorites: Array.isArray(raw.favorites) ? raw.favorites.map((f) => String(f)) : [],
  }

  const parsed = appDataSchema.safeParse(data)
  if (!parsed.success) throw new MigrationError(parsed.error.message)
  return parsed.data
}

import type { HolidayDay, HolidaySet } from './schema'

/**
 * 國定假日：依國家匯入行事曆的唯讀假日。
 *
 * 假日資料打包在網站裡（src/holidays/data/，由 `npm run holidays` 產生），匯入時不會連線到任何假日服務，
 * 也不需要使用者的位置。預設國家只依瀏覽器的時區與語言在裝置上推測，使用者可以自己改。
 *
 * 匯入後以「國家＋年份」為單位存進使用者資料（跟 Drive 同步與備份），
 * 同一國家同一年再匯入一次會整份換成最新資料，所以不會重複。
 */

/** 提供匯入的國家／地區（下拉選單順序） */
export const HOLIDAY_COUNTRIES = ['TW', 'JP', 'US', 'HK', 'KR', 'CN', 'SG', 'GB', 'CA', 'AU'] as const
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number]

export const isHolidayCountry = (v: unknown): v is HolidayCountry => typeof v === 'string' && (HOLIDAY_COUNTRIES as readonly string[]).includes(v)

/** official：政府公告（含補假、補班）｜rules：依法定規則推算 */
export type HolidaySource = 'official' | 'rules'

/** 打包的資料檔格式 */
export interface HolidayFile {
  country: HolidayCountry
  source: HolidaySource
  /** 收錄的年份範圍（含頭尾） */
  years: [number, number]
  days: HolidayDay[]
}

/** 各國資料檔分開打包，選到哪一國才下載那一國（每國約 5–13 KB） */
const loaders = import.meta.glob<HolidayFile>('../holidays/data/*.json', { import: 'default' })

export async function loadHolidayFile(country: HolidayCountry): Promise<HolidayFile> {
  const load = loaders[`../holidays/data/${country}.json`]
  if (!load) throw new Error(`沒有 ${country} 的假日資料`)
  return load()
}

/** 時區 → 國家。只用來決定下拉選單的預設值，不會存起來或傳出去 */
const ZONES: Record<string, HolidayCountry> = {
  'Asia/Taipei': 'TW',
  'Asia/Tokyo': 'JP',
  'Asia/Hong_Kong': 'HK',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Harbin': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Singapore': 'SG',
  'Europe/London': 'GB',
}
const CA_ZONES = /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Whitehorse|Yellowknife|Iqaluit)$/
const US_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu)$/

/**
 * 依時區推測國家（時區比語言準：在台灣用英文介面的人很多）；時區對不上再看語言的地區碼，
 * 都對不上就回傳 fallback。完全在裝置上計算。
 */
export function guessCountry(timeZone: string | undefined, languages: readonly string[], fallback: HolidayCountry = 'TW'): HolidayCountry {
  if (timeZone) {
    if (ZONES[timeZone]) return ZONES[timeZone]
    if (CA_ZONES.test(timeZone)) return 'CA'
    if (US_ZONES.test(timeZone)) return 'US'
    if (timeZone.startsWith('Australia/')) return 'AU'
  }
  for (const lang of languages) {
    const parts = lang.split(/[-_]/)
    const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase()
    if (region === 'UK') return 'GB'
    if (isHolidayCountry(region)) return region
    const base = parts[0]?.toLowerCase()
    if (base === 'ja') return 'JP'
    if (base === 'ko') return 'KR'
  }
  return fallback
}

/** 在瀏覽器裡推測預設國家 */
export function detectCountry(): HolidayCountry {
  let tz: string | undefined
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    tz = undefined
  }
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  return guessCountry(tz, langs)
}

/** 資料檔中某幾年的假日，同一天只留一筆 */
export function daysForYears(file: HolidayFile, years: number[]): Map<number, HolidayDay[]> {
  const out = new Map<number, HolidayDay[]>()
  for (const y of years) {
    if (y < file.years[0] || y > file.years[1]) continue
    const seen = new Set<string>()
    const list: HolidayDay[] = []
    for (const d of file.days) {
      if (!d.date.startsWith(`${y}-`) || seen.has(d.date)) continue
      seen.add(d.date)
      list.push(d)
    }
    out.set(y, list)
  }
  return out
}

/** 年份範圍（含頭尾），頭尾顛倒也可以 */
export function yearSpan(a: number, b: number): number[] {
  const [from, to] = a <= b ? [a, b] : [b, a]
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

export interface ImportResult {
  sets: HolidaySet[]
  /** 新匯入的年份 */
  added: number[]
  /** 原本就有、這次換成最新資料的年份 */
  updated: number[]
  /** 資料不涵蓋、略過的年份 */
  skipped: number[]
}

/**
 * 把某國某幾年的假日寫進現有的匯入資料。以「國家＋年份」為單位整份替換，
 * 所以重複匯入或重新同步都不會產生重複的假日。
 */
export function importSets(current: HolidaySet[], file: HolidayFile, years: number[], now: number): ImportResult {
  const byYear = daysForYears(file, years)
  const added: number[] = []
  const updated: number[] = []
  const skipped = years.filter((y) => !byYear.has(y))
  let sets = current
  for (const [year, days] of byYear) {
    const exists = sets.some((s) => s.country === file.country && s.year === year)
    ;(exists ? updated : added).push(year)
    const next: HolidaySet = { country: file.country, year, source: file.source, importedAt: now, days }
    sets = exists ? sets.map((s) => (s.country === file.country && s.year === year ? next : s)) : [...sets, next]
  }
  sets = [...sets].sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year)
  return { sets, added, updated, skipped }
}

/** 清除某國的所有假日 */
export const clearCountry = (sets: HolidaySet[], country: string) => sets.filter((s) => s.country !== country)

/** 某國已匯入的年份 */
export const importedYears = (sets: HolidaySet[], country: string) =>
  sets
    .filter((s) => s.country === country)
    .map((s) => s.year)
    .sort((a, b) => a - b)

/** 行事曆上的一筆假日 */
export interface HolidayEntry {
  /** 國家＋日期，同時也是畫面上的 key */
  id: string
  country: string
  date: string
  name: string
  en?: string
  /** 補班／调休上班 */
  work: boolean
  source: HolidaySource
}

/**
 * 依日期建索引，月曆一次要查 30 多天。
 * 同一國家同一天只留一筆（萬一資料被手動改過、有重複年份也不會重複顯示）；
 * 不同國家同一天各自一筆。
 */
export function indexHolidays(sets: HolidaySet[]): Map<string, HolidayEntry[]> {
  const map = new Map<string, HolidayEntry[]>()
  const seen = new Set<string>()
  for (const s of sets) {
    for (const d of s.days) {
      const id = `${s.country}:${d.date}`
      if (seen.has(id)) continue
      seen.add(id)
      const entry: HolidayEntry = { id, country: s.country, date: d.date, name: d.name, en: d.en, work: Boolean(d.work), source: s.source }
      const list = map.get(d.date)
      if (list) list.push(entry)
      else map.set(d.date, [entry])
    }
  }
  return map
}

/** 英文、法文、德文介面有英文名稱時用英文名稱（比當地語言好讀）；其他語言（含韓文看韓國假日）用當地名稱 */
const PREFER_EN = /^(en|fr|de)\b/
export const holidayName = (h: Pick<HolidayEntry, 'name' | 'en'>, lng: string | undefined) => (lng && PREFER_EN.test(lng) && h.en ? h.en : h.name)

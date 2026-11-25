import { describe, expect, it } from 'vitest'
import { TOMBSTONE_TTL } from './appMerge'
import { toMaskedView } from './permissions'
import { appDataSchema, emptyAppData, type CalendarEvent } from './schema'
import type { SharedCalendarItem } from './sharing'
import { hasTrashContent, isTrashExpired, liveEvents, purgeExpiredEvents, purgeSharedTrash, TRASH_RETENTION_MS, trashDaysLeft } from './trash'

const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const ev = (id: string, deletedAt?: number): CalendarEvent => ({ id, title: id, dateISO: '2026-11-25', start: '09:00', end: '10:00', note: '', ...(deletedAt !== undefined && { deletedAt }) })
const item = (patch: Partial<SharedCalendarItem> = {}): SharedCalendarItem => ({
  id: 'i1',
  spaceId: 's1',
  kind: 'event',
  title: '家庭聚餐',
  dateISO: '2026-11-25',
  endDateISO: '',
  start: '18:00',
  end: '20:00',
  location: '外婆家',
  note: '帶水果',
  details: {},
  titleColor: '#c2583d',
  bgColor: '#fff4f1',
  icon: 'meal',
  visibility: { mode: 'group_full', allowedUserIds: [], hiddenUserIds: [], busyLabel: '', maskedFields: [] },
  createdBy: 'me',
  createdAt: NOW - 40 * DAY,
  version: 3,
  updatedAt: NOW - 31 * DAY,
  updatedBy: 'mom',
  deletedAt: null,
  ...patch,
})

describe('最近刪除：30 天保留', () => {
  it('30 天的毫秒數是 2,592,000,000', () => {
    expect(TRASH_RETENTION_MS).toBe(2_592_000_000)
  })

  it('滿 29 天 23 小時還留著；滿 30 天才永久刪除', () => {
    const almost = ev('a', NOW - (30 * DAY - HOUR))
    const expired = ev('b', NOW - 30 * DAY)
    const live = ev('c')
    const out = purgeExpiredEvents([almost, expired, live], NOW)
    expect(out.map((e) => e.id)).toEqual(['a', 'c'])
    expect(trashDaysLeft(almost.deletedAt!, NOW)).toBe(1)
    expect(trashDaysLeft(NOW, NOW)).toBe(30)
  })

  it('沒有要清的時候回傳同一個陣列（不會觸發寫入與同步）', () => {
    const events = [ev('a'), ev('b', NOW - DAY)]
    expect(purgeExpiredEvents(events, NOW)).toBe(events)
  })

  it('刪除時間格式壞掉：不清除、不出錯；讀取時當作沒有刪除', () => {
    expect(isTrashExpired('2026-01-01' as unknown as number, NOW)).toBe(false)
    expect(isTrashExpired(Number.NaN, NOW)).toBe(false)
    const parsed = appDataSchema.parse({ ...emptyAppData(), events: [{ ...ev('x'), deletedAt: 'not-a-time' }] })
    expect(parsed.events[0]!.deletedAt).toBeUndefined()
  })

  it('舊版沒有 deletedAt 的資料照常讀取，全部是正常行程', () => {
    const parsed = appDataSchema.parse({ ...emptyAppData(), events: [{ id: 'old', title: '舊行程', dateISO: '2026-01-01', start: '', end: '', note: '' }] })
    expect(parsed.events[0]!.deletedAt).toBeUndefined()
    expect(liveEvents(parsed.events)).toHaveLength(1)
  })

  it('liveEvents：排除最近刪除；同一份清單回傳同一個陣列', () => {
    const events = [ev('a'), ev('b', NOW)]
    expect(liveEvents(events).map((e) => e.id)).toEqual(['a'])
    expect(liveEvents(events)).toBe(liveEvents(events))
    const clean = [ev('a')]
    expect(liveEvents(clean)).toBe(clean)
  })
})

describe('最近刪除：共享行程的清理', () => {
  it('刪除滿 30 天：清成墓碑（版本、時間、刪除者都不變），不再出現在最近刪除', () => {
    const deleted = item({ deletedAt: NOW - 30 * DAY })
    const [out] = purgeSharedTrash([deleted], NOW)
    expect(out).toMatchObject({ id: 'i1', version: 3, updatedAt: deleted.updatedAt, updatedBy: 'mom', deletedAt: deleted.deletedAt, title: '', note: '', location: '' })
    expect(out!.titleColor).toBeUndefined()
    expect(hasTrashContent(out!)).toBe(false)
  })

  it('未滿 30 天、沒有刪除的都不動；墓碑超過保留期限才整筆移除', () => {
    const items = [item({ id: 'live' }), item({ id: 'recent', deletedAt: NOW - DAY })]
    expect(purgeSharedTrash(items, NOW)).toBe(items)
    const old = item({ id: 'old', deletedAt: NOW - TOMBSTONE_TTL, title: '', note: '', location: '' })
    expect(purgeSharedTrash([old], NOW)).toEqual([])
  })
})

describe('欄位遮罩：遮掉標題或類型時一併移除顏色與圖示', () => {
  it('遮罩標題：顏色、圖示都不留', () => {
    const v = toMaskedView(item(), ['title'])
    expect(v.titleColor).toBeUndefined()
    expect(v.bgColor).toBeUndefined()
    expect(v.icon).toBeUndefined()
  })

  it('只遮罩地點：顏色與圖示照常顯示', () => {
    const v = toMaskedView(item(), ['location'])
    expect(v).toMatchObject({ titleColor: '#c2583d', bgColor: '#fff4f1', icon: 'meal', location: '' })
  })
})

import { describe, expect, it } from 'vitest'
import { appDataSchema, emptyAppData, type CalendarEvent } from './schema'
import { isTrashExpired, liveEvents, purgeExpiredEvents, TRASH_RETENTION_MS, trashDaysLeft, trashedEvents } from './trash'

const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const ev = (id: string, deletedAt?: number): CalendarEvent => ({ id, title: id, dateISO: '2026-11-25', start: '09:00', end: '10:00', note: '', ...(deletedAt !== undefined && { deletedAt }) })

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

  it('trashedEvents：只列出最近刪除，新刪除的在前面', () => {
    expect(trashedEvents([ev('a'), ev('old', NOW - DAY), ev('new', NOW)]).map((e) => e.id)).toEqual(['new', 'old'])
  })
})

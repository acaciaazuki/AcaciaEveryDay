import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { sanitizeEvents } from './sanitize'
import type { CalendarEvent } from './schema'
import { liveEvents, trashedEvents } from './trash'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const ok = { id: 'a', title: '牙醫', dateISO: '2026-12-01', start: '14:00', end: '15:00', note: '自訂備註', titleColor: '#6b3f66', bgColor: '#fff4f1', icon: 'health' }

describe('本機資料讀回時的保守清理', () => {
  it('正常資料（含自訂欄位、最近刪除、跨日）原樣保留，回傳同一個陣列', () => {
    const events = [ok, { ...ok, id: 'b', deletedAt: 1_700_000_000_000 }, { ...ok, id: 'c', endDateISO: '2026-12-03' }, { ...ok, id: 'd', endDateISO: '', futureField: { x: 1 } }]
    expect(sanitizeEvents(events)).toBe(events)
  })

  it('刪除時間或結束日期格式壞掉：只拿掉那個欄位，其他內容不變', () => {
    // 從儲存讀回的資料型別不可信，這裡模擬壞掉的格式
    const out = sanitizeEvents([
      { ...ok, id: 'x', deletedAt: '2026-01-01' },
      { ...ok, id: 'y', deletedAt: Number.NaN },
      { ...ok, id: 'z', endDateISO: '明天' },
    ] as unknown as CalendarEvent[])
    expect(out).toEqual([
      { ...ok, id: 'x' },
      { ...ok, id: 'y' },
      { ...ok, id: 'z' },
    ])
    // 清理後是正常行程：行事曆看得到，「最近刪除」沒有
    expect(liveEvents(out).map((e) => e.id)).toEqual(['x', 'y', 'z'])
    expect(trashedEvents(out)).toEqual([])
  })

  it('不是陣列或項目不是物件：原樣回傳，不丟資料', () => {
    const weird = { not: 'an array' }
    expect(sanitizeEvents(weird)).toBe(weird)
    const mixed = [null, 'x', ok]
    expect(sanitizeEvents(mixed)).toBe(mixed)
  })

  it('從 IndexedDB 讀回主資料時套用清理（其他資料不受影響）', async () => {
    const { kv } = await import('../adapters/kv')
    const { emptyAppData } = await import('./schema')
    const stored = { ...emptyAppData(), updatedAt: 5, events: [{ ...ok, deletedAt: 'bad' }], tasks: [{ id: 't1', title: '繳電費', loc: '', date: '', time: '', done: false }] }
    await kv('state').set('acacia-next', JSON.stringify({ state: stored, version: 2 }))
    const { useAppStore } = await import('../store/useAppStore')
    await useAppStore.persist.rehydrate()
    expect(useAppStore.getState().events).toEqual([ok])
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['繳電費'])
  })
})

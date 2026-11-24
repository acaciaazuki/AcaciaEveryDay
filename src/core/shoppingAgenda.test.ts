import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Expense } from './schema'
import { agendaOn, indexByDate, shoppingEntries, shoppingPath } from './shoppingAgenda'

const exp = (p: Partial<Expense>): Expense => ({ id: 'x', title: '鳳梨', amt: 150, store: '第五市場', cat: 'food', date: '2026-11-22', time: '08:00', done: false, ...p })
const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: 'e', title: '上班', dateISO: '2026-11-22', start: '09:00', end: '17:00', note: '', ...p })

describe('購物記帳映射到行事曆', () => {
  it('包含目前清單與歸檔，略過沒有日期的記帳', () => {
    const list = shoppingEntries([exp({ id: 'a' }), exp({ id: 'b', date: '' })], [{ start: '2026-10-10', end: '2026-11-09', archivedAt: 0, expenses: [exp({ id: 'c', date: '2026-10-20' })] }])
    expect(list.map((x) => [x.id, x.archived])).toEqual([
      ['a', false],
      ['c', true],
    ])
  })

  it('跟行程合併並依時間排序，沒有時間的記帳排最前面', () => {
    const byDate = indexByDate(shoppingEntries([exp({ id: 'pm', time: '16:00' }), exp({ id: 'am', time: '08:00' }), exp({ id: 'none', time: '' })], []))
    const items = agendaOn([ev({ id: 'work' }), ev({ id: 'other', dateISO: '2026-11-23' })], byDate, '2026-11-22')
    expect(items.map((i) => (i.kind === 'event' ? i.event.id : i.kind === 'shopping' ? i.entry.id : i.shared.id))).toEqual(['none', 'am', 'work', 'pm'])
  })

  it('行程與購物 id 相同時不會撞 key；同一時間行程排前面', () => {
    const byDate = indexByDate(shoppingEntries([exp({ id: 'same', time: '09:00' })], []))
    const items = agendaOn([ev({ id: 'same' })], byDate, '2026-11-22')
    expect(items.map((i) => i.kind)).toEqual(['event', 'shopping'])
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
  })

  it('前往購物清單的網址用全域搜尋同一套 ?open=', () => {
    expect(shoppingPath({ id: 'a1', expense: exp({ id: 'a1' }), archived: false })).toBe('/shopping?open=a1')
  })
})

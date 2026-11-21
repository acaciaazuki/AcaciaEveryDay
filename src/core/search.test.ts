import { describe, expect, it } from 'vitest'
import type { SearchData, SearchFormat } from './search'
import { excerpt, searchAll, splitHighlight, tokenize } from './search'

const fmt: SearchFormat = {
  money: (n) => `$${n}`,
  expenseCat: (e) => e.cat,
  placeCat: (c) => c,
}
const data: SearchData = {
  events: [
    {
      id: 'e1',
      title: '牙醫回診',
      dateISO: '2026-11-03',
      start: '10:00',
      end: '',
      note: '記得帶健保卡',
    },
    {
      id: 'e2',
      title: '開會',
      dateISO: '2026-11-05',
      start: '',
      end: '',
      note: '',
    },
  ],
  tasks: [
    { id: 't1', title: '寄包裹', loc: '郵局', date: '', time: '', done: true },
    { id: 't2', title: '買藥', loc: '', date: '', time: '', done: false },
  ],
  shopping: [
    {
      id: 's1',
      title: '牛奶',
      amt: 85,
      store: '全聯',
      cat: 'food',
      date: '2026-11-02',
      time: '',
      done: false,
    },
  ],
  archives: [
    {
      start: '2026-09-10',
      end: '2026-10-09',
      archivedAt: 0,
      expenses: [
        {
          id: 's2',
          title: '衛生紙',
          amt: 120,
          store: '全聯',
          cat: 'housing',
          date: '2026-09-20',
          time: '',
          done: false,
        },
      ],
    },
  ],
  places: [
    {
      id: 'p1',
      name: '秋紅谷',
      cat: 'park',
      address: '台中市西屯區',
      hours: '',
      note: '傍晚很好拍',
      url: '',
    },
  ],
}

describe('searchAll', () => {
  it('空白查詢沒有結果', () => {
    expect(searchAll(data, '   ', 'all', fmt)).toEqual([])
  })
  it('備註命中時附帶摘錄欄位', () => {
    const r = searchAll(data, '健保', 'all', fmt)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      kind: 'events',
      id: 'e1',
      snippet: { field: 'note' },
    })
  })
  it('待辦含已完成、可用地點搜尋', () => {
    const r = searchAll(data, '郵局', 'tasks', fmt)
    expect(r[0]).toMatchObject({
      id: 't1',
      done: true,
      snippet: { field: 'loc' },
    })
  })
  it('店家命中會同時找到目前與已歸檔的記帳，歸檔的有標記', () => {
    const r = searchAll(data, '全聯', 'shopping', fmt)
    expect(r.map((x) => x.id).sort()).toEqual(['s1', 's2'])
    expect(r.find((x) => x.id === 's2')?.archived).toEqual({
      start: '2026-09-10',
      end: '2026-10-09',
    })
  })
  it('分頁會限制範圍', () => {
    expect(searchAll(data, '全聯', 'events', fmt)).toEqual([])
    expect(searchAll(data, '台中', 'places', fmt)[0]?.snippet?.field).toBe('address')
  })
  it('多個關鍵字要全部命中，且不分大小寫', () => {
    expect(searchAll(data, '牙醫 健保', 'all', fmt)).toHaveLength(1)
    expect(searchAll(data, '牙醫 郵局', 'all', fmt)).toHaveLength(0)
  })
})

describe('highlight helpers', () => {
  it('tokenize 切空白並轉小寫', () => {
    expect(tokenize(' Foo  bar ')).toEqual(['foo', 'bar'])
  })
  it('splitHighlight 標出所有命中片段', () => {
    expect(splitHighlight('買牛奶和牛肉', ['牛'])).toEqual([
      ['買', false],
      ['牛', true],
      ['奶和', false],
      ['牛', true],
      ['肉', false],
    ])
  })
  it('excerpt 長備註只留關鍵字附近', () => {
    const long = `${'前'.repeat(60)}目標${'後'.repeat(60)}`
    const r = excerpt(long, ['目標'])
    expect(r).toContain('目標')
    expect(r.length).toBeLessThan(long.length)
  })
})

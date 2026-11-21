import { describe, expect, it } from 'vitest'
import { migrate, MigrationError } from './migrate'
import { SCHEMA_VERSION } from './schema'

const legacy = {
  events: [
    { id: 1, title: '起床', start: '07:30', end: '08:30', dateISO: '2026-11-21', titleColor: '#263633', bgColor: '#eaf6ef', note: '☀️' },
  ],
  tasks: [{ id: 1, title: '回覆訊息', loc: '辦公室', date: '2026-11-21', time: '14:00', done: false, tag: '' }],
  shopping: [
    { id: 1, title: '燕麥奶', amt: 120, store: '全聯', cat: '食', date: '2026-11-21', time: '18:00', done: false },
    { id: 2, title: '貓砂', amt: '300', store: '', cat: '寵物', date: '', time: '', done: true },
  ],
  places: [{ id: 101, name: '小日子手沖咖啡', cat: '咖啡', address: '台中市', hours: '', note: '', url: '' }],
  favorites: [101],
  calYear: 2026,
  calMonth: 10,
  mapCat: '全部',
  updatedAt: 1700000000000,
}

describe('migrate', () => {
  it('把舊版資料轉成新版', () => {
    const d = migrate(legacy)
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.events[0].id).toBe('1')
    expect(d.shopping[0].cat).toBe('food')
    expect(d.shopping[1]).toMatchObject({ cat: 'other', customCat: '寵物', amt: 300 })
    expect(d.places[0].cat).toBe('cafe')
    expect(d.favorites).toEqual(['101'])
    expect(d.updatedAt).toBe(1700000000000)
  })

  it('新版資料原樣通過', () => {
    const d = migrate(legacy)
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('格式錯誤時丟出 MigrationError', () => {
    expect(() => migrate('oops')).toThrow(MigrationError)
    expect(() => migrate({ schemaVersion: 99 })).toThrow(MigrationError)
  })
})

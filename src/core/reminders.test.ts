import { describe, expect, it } from 'vitest'
import { COOLDOWN_MS, createTracker, distanceMeters, isActiveNow, isTimeActive, parseCoords, splitItems } from './reminders'
import { migrate } from './migrate'
import { emptyAppData, type Reminder } from './schema'

const HOME = { lat: 25.033, lng: 121.5654 }
// 緯度 0.001 度約 111 公尺
const at = (metersNorth: number, accuracy = 10) => ({ lat: HOME.lat + metersNorth / 111_195, lng: HOME.lng, accuracy })

const rule = (patch: Partial<Reminder> = {}): Reminder => ({
  id: 'r1',
  place: '公司',
  ...HOME,
  radius: 300,
  trigger: 'leave',
  days: 'every',
  customDays: [],
  start: '',
  end: '',
  items: ['錢包', '鑰匙'],
  enabled: true,
  ...patch,
})

// 2026-11-23 是星期一、2026-11-21 是星期六
const MON_9 = new Date(2026, 10, 23, 9, 0)
const SAT_9 = new Date(2026, 10, 21, 9, 0)
const later = (d: Date, min: number) => new Date(d.getTime() + min * 60_000)

describe('distanceMeters / parseCoords', () => {
  it('距離大致正確', () => {
    expect(distanceMeters(HOME, at(300))).toBeGreaterThan(295)
    expect(distanceMeters(HOME, at(300))).toBeLessThan(305)
    expect(distanceMeters(HOME, HOME)).toBe(0)
  })
  it('解析貼上的座標與地圖連結', () => {
    expect(parseCoords('25.0330, 121.5654')).toEqual({ lat: 25.033, lng: 121.5654 })
    expect(parseCoords('25.033 121.5654')).toEqual({ lat: 25.033, lng: 121.5654 })
    expect(parseCoords('https://www.google.com/maps/place/x/@25.0330,121.5654,17z/data=abc')).toEqual({ lat: 25.033, lng: 121.5654 })
    expect(parseCoords('https://maps.google.com/?q=25.033,121.5654')).toEqual({ lat: 25.033, lng: 121.5654 })
    expect(parseCoords('/data=!3d25.033!4d121.5654')).toEqual({ lat: 25.033, lng: 121.5654 })
    expect(parseCoords('999, 999')).toBeNull()
    expect(parseCoords('台北車站')).toBeNull()
    expect(parseCoords('')).toBeNull()
  })
})

describe('星期與時段', () => {
  it('每天、平日、假日、自訂', () => {
    expect(isActiveNow(rule({ days: 'weekdays' }), MON_9)).toBe(true)
    expect(isActiveNow(rule({ days: 'weekdays' }), SAT_9)).toBe(false)
    expect(isActiveNow(rule({ days: 'weekends' }), SAT_9)).toBe(true)
    expect(isActiveNow(rule({ days: 'weekends' }), MON_9)).toBe(false)
    expect(isActiveNow(rule({ days: 'custom', customDays: [1, 3] }), MON_9)).toBe(true)
    expect(isActiveNow(rule({ days: 'custom', customDays: [2] }), MON_9)).toBe(false)
    expect(isActiveNow(rule({ enabled: false }), MON_9)).toBe(false)
  })
  it('未指定時段視為整天，支援只填一邊與跨午夜', () => {
    expect(isTimeActive({ start: '', end: '' }, 3 * 60)).toBe(true)
    expect(isTimeActive({ start: '08:00', end: '18:00' }, 9 * 60)).toBe(true)
    expect(isTimeActive({ start: '08:00', end: '18:00' }, 19 * 60)).toBe(false)
    expect(isTimeActive({ start: '18:00', end: '' }, 20 * 60)).toBe(true)
    expect(isTimeActive({ start: '', end: '10:00' }, 11 * 60)).toBe(false)
    expect(isTimeActive({ start: '22:00', end: '06:00' }, 23 * 60)).toBe(true)
    expect(isTimeActive({ start: '22:00', end: '06:00' }, 5 * 60)).toBe(true)
    expect(isTimeActive({ start: '22:00', end: '06:00' }, 12 * 60)).toBe(false)
  })
})

describe('進出偵測', () => {
  it('開啟時人已經在範圍內不算抵達；離開時通知一次，同一趟不重複', () => {
    const tr = createTracker()
    const r = [rule()]
    expect(tr.update(r, at(50), MON_9)).toEqual([]) // 第一次定位：在裡面，只記錄
    expect(tr.update(r, at(100), later(MON_9, 1))).toEqual([]) // 還在裡面
    expect(tr.update(r, at(320), later(MON_9, 2))).toEqual([]) // 超出半徑但還在遲滯範圍內
    const out = tr.update(r, at(400), later(MON_9, 3))
    expect(out.map((e) => e.kind)).toEqual(['leave'])
    expect(tr.update(r, at(500), later(MON_9, 4))).toEqual([]) // 已經在外面，不重複
    expect(tr.update(r, at(900), later(MON_9, 5))).toEqual([])
  })

  it('抵達時：外面進到範圍內才通知，冷卻時間內的抖動不重複', () => {
    const tr = createTracker()
    const r = [rule({ trigger: 'arrive' })]
    expect(tr.update(r, at(800), MON_9)).toEqual([])
    expect(tr.update(r, at(200), later(MON_9, 1)).map((e) => e.kind)).toEqual(['arrive'])
    // 在邊界來回抖動：離開再進來，但還在冷卻時間內
    expect(tr.update(r, at(400), later(MON_9, 2))).toEqual([])
    expect(tr.update(r, at(250), later(MON_9, 3))).toEqual([])
    // 真的離開一陣子再回來（超過冷卻）會再通知
    expect(tr.update(r, at(900), later(MON_9, 20))).toEqual([])
    expect(tr.update(r, at(100), later(MON_9, 20 + COOLDOWN_MS / 60_000)).map((e) => e.kind)).toEqual(['arrive'])
  })

  it('觸發條件不符、星期或時段不符、已停用、沒有座標都不通知', () => {
    const run = (r: Reminder, now: Date) => {
      const tr = createTracker()
      tr.update([r], at(50), now)
      return tr.update([r], at(500), later(now, 1))
    }
    expect(run(rule(), MON_9)).toHaveLength(1)
    expect(run(rule({ trigger: 'arrive' }), MON_9)).toEqual([])
    expect(run(rule({ days: 'weekends' }), MON_9)).toEqual([])
    expect(run(rule({ start: '13:00', end: '18:00' }), MON_9)).toEqual([])
    expect(run(rule({ enabled: false }), MON_9)).toEqual([])
    expect(run(rule({ lat: undefined, lng: undefined }), MON_9)).toEqual([])
  })

  it('定位誤差太大的結果會被忽略', () => {
    const tr = createTracker()
    const r = [rule({ radius: 100 })]
    tr.update(r, at(10), MON_9)
    expect(tr.update(r, at(400, 800), later(MON_9, 1))).toEqual([]) // 誤差 800m，不採用
    expect(tr.update(r, at(400, 20), later(MON_9, 2)).map((e) => e.kind)).toEqual(['leave'])
  })

  it('改了座標或半徑會當成新規則重新開始，不會誤判成進出', () => {
    const tr = createTracker()
    tr.update([rule()], at(50), MON_9)
    expect(tr.update([rule({ lat: HOME.lat + 0.05 })], at(50), later(MON_9, 1))).toEqual([])
  })
})

describe('splitItems / 資料相容', () => {
  it('以頓號、逗號、換行拆開，去掉空白與重複', () => {
    expect(splitItems('錢包、鑰匙, 悠遊卡，錢包\n  ')).toEqual(['錢包', '鑰匙', '悠遊卡'])
    expect(splitItems('鑰匙', ['鑰匙', '手機'])).toEqual([])
  })
  it('沒有 reminders 的舊資料補空陣列，有的原樣保留', () => {
    const { reminders: _drop, ...old } = emptyAppData()
    void _drop
    expect(migrate(old).reminders).toEqual([])
    const data = { ...emptyAppData(), reminders: [rule()] }
    expect(migrate(JSON.parse(JSON.stringify(data))).reminders).toEqual(data.reminders)
  })
})

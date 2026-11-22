import { describe, expect, it } from 'vitest'
import { dayLines, formatDistance, openStatus, parseRanges, placeCoords, sortByCategory, sortByDistance, sortByOpen } from './placeSort'
import { appDataSchema, emptyAppData, type Place } from './schema'

const place = (id: string, patch: Partial<Place> = {}): Place => ({ id, name: id, cat: 'other', address: '', hours: '', note: '', url: '', ...patch })
/** 2026-11-23 是星期一 */
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 10, 22 + day, h, m)
}

describe('種類排序', () => {
  it('依分類清單順序，同分類維持自訂順序', () => {
    const list = [place('a', { cat: 'park' }), place('b', { cat: 'restaurant' }), place('c', { cat: 'park' }), place('d', { cat: 'restaurant' })]
    expect(sortByCategory(list).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('不認得的分類排最後', () => {
    expect(sortByCategory([place('x', { cat: '???' }), place('y', { cat: 'other' })]).map((p) => p.id)).toEqual(['y', 'x'])
  })
})

describe('距離排序', () => {
  const here = { lat: 25.033, lng: 121.5654 }
  it('由近到遠，沒有座標的排最後並維持原順序', () => {
    const list = [
      place('none1'),
      place('far', { lat: 24.1477, lng: 120.6736 }),
      place('near', { lat: 25.0375, lng: 121.5637 }),
      place('none2'),
      place('fromUrl', { url: 'https://www.google.com/maps/place/x/@25.0478,121.5170,17z' }),
    ]
    const { sorted, distances } = sortByDistance(list, here)
    expect(sorted.map((p) => p.id)).toEqual(['near', 'fromUrl', 'far', 'none1', 'none2'])
    expect(distances.get('none1')).toBeNull()
    expect(distances.get('near')).toBeGreaterThan(400)
    expect(distances.get('near')).toBeLessThan(600)
  })
  it('座標優先用存下來的 lat/lng，其次從連結抓', () => {
    expect(placeCoords(place('a', { lat: 1, lng: 2, url: '@3,4' }))).toEqual({ lat: 1, lng: 2 })
    expect(placeCoords(place('b', { url: 'https://maps.google.com/?q=25.1,121.2' }))).toEqual({ lat: 25.1, lng: 121.2 })
    expect(placeCoords(place('c', { url: 'https://maps.google.com/?cid=123' }))).toBeNull()
  })
  it('距離顯示', () => {
    expect(formatDistance(3)).toEqual({ value: '10', unit: 'm' })
    expect(formatDistance(487)).toEqual({ value: '490', unit: 'm' })
    expect(formatDistance(1234)).toEqual({ value: '1.2', unit: 'km' })
    expect(formatDistance(56_700)).toEqual({ value: '57', unit: 'km' })
  })
})

describe('營業時間判讀', () => {
  const zh = '公休時間：星期一\n星期一: 休息\n星期二: 11:00–14:30, 17:00–21:00\n星期三: 上午11:00 – 下午9:00\n星期四: 18:00–02:00\n星期五: 24 小時營業\n星期六: 10:00–18:00\n星期日: 10:00–18:00'

  it('摘要行不會被當成某一天', () => {
    const lines = dayLines(zh)
    expect(lines.get(1)).toBe('休息')
    expect(lines.size).toBe(7)
  })

  it('各種時段寫法', () => {
    expect(parseRanges('11:00–14:30, 17:00–21:00')).toEqual([[660, 870], [1020, 1260]])
    expect(parseRanges('上午11:00 – 下午9:00')).toEqual([[660, 1260]])
    expect(parseRanges('11:00 AM – 2:30 PM, 5:00 – 9:00 PM')).toEqual([[660, 870], [1020, 1260]])
    expect(parseRanges('11時00分～21時00分')).toEqual([[660, 1260]])
    expect(parseRanges('18:00–02:00')).toEqual([[1080, 1560]])
    expect(parseRanges('12:00 PM – 12:00 AM')).toEqual([[720, 1440]])
    expect(parseRanges('休息')).toEqual([])
  })

  it('公休、營業中、稍後、已打烊', () => {
    expect(openStatus(zh, at(1, '12:00')).state).toBe('closed')
    expect(openStatus(zh, at(2, '12:00')).state).toBe('open')
    expect(openStatus(zh, at(2, '15:00'))).toEqual({ state: 'later', opensAt: '17:00' })
    expect(openStatus(zh, at(2, '21:00')).state).toBe('ended')
    expect(openStatus(zh, at(3, '20:59')).state).toBe('open')
    expect(openStatus(zh, at(5, '03:00')).state).toBe('open')
  })

  it('前一天跨夜營業的尾段算營業中', () => {
    // 星期五 18:00–02:00 → 星期六 01:30 還開著，即使星期六公休
    const h = '星期五: 18:00–02:00\n星期六: 休息'
    expect(openStatus(h, at(6, '01:30')).state).toBe('open')
    expect(openStatus(h, at(6, '02:30')).state).toBe('closed')
  })

  it('英文與日文的星期', () => {
    expect(openStatus('Monday: Closed\nTuesday: 9:00 AM – 5:00 PM', at(2, '10:00')).state).toBe('open')
    expect(openStatus('Monday: Closed', at(1, '10:00')).state).toBe('closed')
    expect(openStatus('月曜日: 定休日\n火曜日: 11時00分～21時00分', at(2, '22:00')).state).toBe('ended')
    expect(openStatus('火曜日: 24 時間営業', at(2, '04:00')).state).toBe('open')
  })

  it('沒有資料或看不懂就是未知，不猜測', () => {
    expect(openStatus('', at(2, '12:00')).state).toBe('unknown')
    expect(openStatus('查無營業時間資訊', at(2, '12:00')).state).toBe('unknown')
    expect(openStatus('平日中午開，晚上看心情', at(2, '12:00')).state).toBe('unknown')
    // 有其他天但沒有今天
    expect(openStatus('星期一: 10:00–18:00', at(2, '12:00')).state).toBe('unknown')
    expect(openStatus('星期二: 請電話詢問', at(2, '12:00')).state).toBe('unknown')
  })

  it('排序：營業中 → 稍後 → 已打烊 → 公休 → 未知，同狀態維持自訂順序', () => {
    const list = [
      place('unknown'),
      place('closed', { hours: '星期二: 休息' }),
      place('ended', { hours: '星期二: 08:00–10:00' }),
      place('open1', { hours: '星期二: 10:00–18:00' }),
      place('later', { hours: '星期二: 17:00–21:00' }),
      place('open2', { hours: '星期二: 24 小時營業' }),
    ]
    const { sorted, statuses } = sortByOpen(list, at(2, '12:00'))
    expect(sorted.map((p) => p.id)).toEqual(['open1', 'open2', 'later', 'ended', 'closed', 'unknown'])
    expect(statuses.get('later')).toEqual({ state: 'later', opensAt: '17:00' })
  })
})

describe('資料相容', () => {
  it('舊資料沒有座標與排序設定也能讀', () => {
    const old = { ...emptyAppData(), places: [{ id: '1', name: 'A', cat: 'cafe', address: '', hours: '', note: '', url: '' }] }
    const parsed = appDataSchema.parse(old)
    expect(parsed.settings.placeSort).toBeUndefined()
    expect(parsed.places[0].lat).toBeUndefined()
  })
  it('新欄位會保留', () => {
    const data = { ...emptyAppData(), settings: { fontSize: 'md', currency: 'TWD', placeSort: 'open' }, places: [place('1', { lat: 25, lng: 121 })] }
    const parsed = appDataSchema.parse(data)
    expect(parsed.settings.placeSort).toBe('open')
    expect(parsed.places[0]).toMatchObject({ lat: 25, lng: 121 })
  })
  it('不認得的排序方式當作沒設定，不影響其他資料', () => {
    const parsed = appDataSchema.parse({ ...emptyAppData(), settings: { fontSize: 'md', currency: 'TWD', placeSort: 'random' } })
    expect(parsed.settings.placeSort).toBeUndefined()
  })
})

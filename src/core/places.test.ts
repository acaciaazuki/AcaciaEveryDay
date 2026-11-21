import { describe, expect, it } from 'vitest'
import { buildPlaceNote, detectPlaceCategory, formatOpeningHours, mapsUrl, type PlaceNoteLabels } from './places'

const l: PlaceNoteLabels = {
  closedDays: (d) => `公休：${d}`,
  noClosedDays: '無固定公休',
  noHours: '無資料',
  rating: (r, c) => `評價 ${r}（${c}）`,
  phone: (p) => `電話 ${p}`,
  clinicTip: '帶健保卡',
  intro: (s) => `簡介 ${s}`,
  highlights: (s) => `特色 ${s}`,
  reviews: (q) => q.join('/'),
}

describe('detectPlaceCategory', () => {
  it('依名稱與類型判斷', () => {
    expect(detectPlaceCategory('路易莎咖啡')).toBe('cafe')
    expect(detectPlaceCategory('某某牙醫診所')).toBe('clinic')
    expect(detectPlaceCategory('X', ['park'])).toBe('park')
    expect(detectPlaceCategory('一間店')).toBe('other')
  })
})

describe('formatOpeningHours', () => {
  it('找出公休日', () => {
    expect(formatOpeningHours(['星期一: 休息', '星期二: 10:00–18:00'], l)).toBe('公休：星期一\n星期一: 休息\n星期二: 10:00–18:00')
    expect(formatOpeningHours([], l)).toBe('無資料')
  })
})

describe('buildPlaceNote', () => {
  it('餐飲類帶入評價與好評摘要', () => {
    const note = buildPlaceNote(
      { rating: 4.5, userRatingCount: 10, reviews: [{ rating: 5, text: { text: '好喝' } }, { rating: 2, text: '普通' }] },
      'cafe',
      l,
    )
    expect(note).toBe('評價 4.5（10）\n好喝')
  })
  it('診所帶入提醒', () => {
    expect(buildPlaceNote({ nationalPhoneNumber: '02-1234' }, 'clinic', l)).toBe('電話 02-1234\n帶健保卡')
  })
})

describe('mapsUrl', () => {
  it('沒有網址時用名稱搜尋', () => {
    expect(mapsUrl({ name: '春水堂', address: '台中' })).toBe('https://www.google.com/maps/search/?api=1&query=%E6%98%A5%E6%B0%B4%E5%A0%82%20%E5%8F%B0%E4%B8%AD')
  })
})

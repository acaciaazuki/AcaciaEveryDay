import { describe, expect, it } from 'vitest'
import { TEXT_COLORS, THEME_COLORS } from './categories'

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('卡片配色', () => {
  it('背景色不重複，且保留舊版前 6 組的順序', () => {
    expect(new Set(THEME_COLORS.map((c) => c.bg)).size).toBe(THEME_COLORS.length)
    expect(THEME_COLORS.slice(0, 6).map((c) => c.bg)).toEqual(['#ffffff', '#eaf6ef', '#fff8e8', '#fff4f1', '#f0f4fb', '#f3edfa'])
    expect(THEME_COLORS.length).toBeGreaterThanOrEqual(10)
  })
  it('新增的配色文字對比 ≥ 4.5', () => {
    for (const c of THEME_COLORS.slice(6)) expect(contrast(c.txt, c.bg), c.bg).toBeGreaterThanOrEqual(4.5)
  })
  it('每個文字色疊在每個卡片背景上對比 ≥ 4.5', () => {
    for (const t of TEXT_COLORS) for (const b of THEME_COLORS) expect(contrast(t.color, b.bg), `${t.color} on ${b.bg}`).toBeGreaterThanOrEqual(4.5)
  })
})

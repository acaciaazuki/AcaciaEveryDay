import { describe, expect, it } from 'vitest'
import { cellChromePx, chipRowPx, chipsThatFit } from './useChipCapacity'

describe('月曆格子放得下幾個行程標籤', () => {
  it('依根字級（rem）換算外框與每列高度', () => {
    expect(chipRowPx(14)).toBe(17)
    expect(cellChromePx(14)).toBe(40.5)
  })

  it('格子越高放越多，並保留一列給「還有 X 個」', () => {
    // 實測：1366×768 五週月份格子約 92px、1920×1080 四週月份約 194px（根字級 14px）
    expect(chipsThatFit(92, 14)).toBe(2)
    expect(chipsThatFit(154, 14)).toBe(5)
    expect(chipsThatFit(194, 14)).toBe(8)
  })

  it('很矮時不會變負數（只顯示「還有 X 個」）', () => {
    expect(chipsThatFit(40, 14)).toBe(0)
    expect(chipsThatFit(0, 14)).toBe(0)
  })
})

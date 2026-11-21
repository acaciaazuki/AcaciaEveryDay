import { describe, expect, it } from 'vitest'
import { decideSync } from './sync'

describe('decideSync', () => {
  it('雲端沒有資料時上傳本機', () => expect(decideSync({ updatedAt: 5 }, null)).toBe('useLocal'))
  it('本機從未修改時用雲端', () => expect(decideSync({ updatedAt: 0 }, { updatedAt: 1 })).toBe('useCloud'))
  it('較新的一方獲勝', () => {
    expect(decideSync({ updatedAt: 10 }, { updatedAt: 20 })).toBe('useCloud')
    expect(decideSync({ updatedAt: 30 }, { updatedAt: 20 })).toBe('useLocal')
    expect(decideSync({ updatedAt: 20 }, { updatedAt: 20 })).toBe('same')
  })
})

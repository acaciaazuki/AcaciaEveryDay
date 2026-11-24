import { describe, expect, it } from 'vitest'
import { INV_CATEGORIES } from '../core/schema'
import { LANGUAGES } from '.'
import { BATCH_NOTES, INV_CATEGORY_NAMES } from './cross'

const files = import.meta.glob('./locales/*.json', { import: 'default', eager: true }) as Record<string, { calendar: { batchForm: { note: string } }; inv: { cat: Record<string, string> } }>
const doc = (code: string) => files[`./locales/${code}.json`]!

describe('跨語言比對用的文字與翻譯檔一致', () => {
  it('「批次建立」：每種語言都有', () => {
    expect([...BATCH_NOTES]).toEqual(LANGUAGES.map((l) => doc(l.code).calendar.batchForm.note))
  })

  it('庫存內建分類名稱：每種語言、每個分類都有', () => {
    expect([...INV_CATEGORY_NAMES]).toEqual(LANGUAGES.flatMap((l) => INV_CATEGORIES.map((k) => doc(l.code).inv.cat[k])))
  })
})

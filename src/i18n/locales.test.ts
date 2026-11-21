import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ja from './locales/ja.json'
import zhTW from './locales/zh-TW.json'

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort()

describe('翻譯檔', () => {
  it('三種語言的 key 完全一致', () => {
    expect(keys(ja)).toEqual(keys(zhTW))
    expect(keys(en)).toEqual(keys(zhTW))
  })
})

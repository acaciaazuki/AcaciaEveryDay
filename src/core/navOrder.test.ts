import { describe, expect, it } from 'vitest'
import { applyOrder, isDefaultOrder, moveItem } from './navOrder'

const items = ['shopping', 'reminders', 'subscriptions', 'inventory'].map((key) => ({ key }))
const keys = (l: { key: string }[]) => l.map((i) => i.key)

describe('側邊欄排序', () => {
  it('沒存過順序時用預設', () => {
    expect(keys(applyOrder(items, undefined))).toEqual(['shopping', 'reminders', 'subscriptions', 'inventory'])
    expect(keys(applyOrder(items, []))).toEqual(['shopping', 'reminders', 'subscriptions', 'inventory'])
  })

  it('依存的順序排列', () => {
    expect(keys(applyOrder(items, ['inventory', 'shopping', 'subscriptions', 'reminders']))).toEqual(['inventory', 'shopping', 'subscriptions', 'reminders'])
  })

  it('之後新增的項目補在最後，已移除與重複的項目忽略', () => {
    expect(keys(applyOrder(items, ['subscriptions', 'removed', 'shopping', 'subscriptions']))).toEqual(['subscriptions', 'shopping', 'reminders', 'inventory'])
  })

  it('移動項目', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })

  it('判斷是否為預設順序', () => {
    expect(isDefaultOrder(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(isDefaultOrder(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

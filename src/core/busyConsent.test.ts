import { describe, expect, it } from 'vitest'
import { needsShareConfirm, shareAudience, type RuleDraft } from './busyConsent'
import { busyProjectionRuleSchema, PERSONAL_CALENDAR_ID, type Space } from './sharing'

const rule = (patch: Partial<RuleDraft> = {}) =>
  busyProjectionRuleSchema.parse({ id: 'r1', userId: 'me', sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: ['a'], updatedAt: 1, ...patch })
const draft = (patch: Partial<RuleDraft> = {}): RuleDraft => ({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: ['a'], includeAllDay: false, includePrivate: false, ...patch })

describe('忙碌時段同步的二次確認', () => {
  it('新規則同步到共享空間：要確認；只同步到我的行事曆（只有自己看得到）：不用', () => {
    expect(needsShareConfirm(undefined, draft(), ['a'])).toBe(true)
    expect(needsShareConfirm(undefined, draft({ sourceId: 'a', targetIds: [PERSONAL_CALENDAR_ID] }), [])).toBe(false)
  })

  it('擴大範圍要確認：新增目標、改成全部、開啟私人或整天行程', () => {
    expect(needsShareConfirm(rule(), draft({ targetIds: ['a', 'b'] }), ['a', 'b'])).toBe(true)
    expect(needsShareConfirm(rule(), draft({ targetMode: 'all', targetIds: [] }), ['a', 'b'])).toBe(true)
    expect(needsShareConfirm(rule({ sourceId: 'c' }), draft({ sourceId: 'c', includePrivate: true }), ['a'])).toBe(true)
    expect(needsShareConfirm(rule(), draft({ includeAllDay: true }), ['a'])).toBe(true)
  })

  it('縮小或不變不用確認：移除目標、全部改成指定、改顯示文字、關閉選項', () => {
    expect(needsShareConfirm(rule({ targetIds: ['a', 'b'] }), draft({ targetIds: ['a'] }), ['a'])).toBe(false)
    expect(needsShareConfirm(rule({ targetMode: 'all', targetIds: [] }), draft({ targetIds: ['b'] }), ['b'])).toBe(false)
    expect(needsShareConfirm(rule({ includeAllDay: true }), draft({ includeAllDay: false }), ['a'])).toBe(false)
    expect(needsShareConfirm(rule(), draft(), ['a'])).toBe(false)
  })

  it('確認畫面的對象：只列共享空間，成員數不含自己；已刪除的空間略過', () => {
    const space = (id: string, members: string[], deletedAt: number | null = null) =>
      ({ id, name: id.toUpperCase(), deletedAt, members: members.map((userId) => ({ userId, role: 'editor', displayName: '', joinedAt: 0 })) }) as unknown as Space
    const spaces = [space('a', ['me', 'mom', 'dad']), space('b', ['me'], 5)]
    expect(shareAudience(spaces, [PERSONAL_CALENDAR_ID, 'a', 'b'], 'me')).toEqual([{ id: 'a', name: 'A', others: 2 }])
  })
})

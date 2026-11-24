import { describe, expect, it } from 'vitest'
import { cleanDetails, DETAIL_FIELDS, DETAIL_KEYS, DETAIL_MAX, detailEntries, detailFieldsOf, safeLink } from './itemDetails'
import { ITEM_KINDS, sharedCalendarItemSchema } from './sharing'

describe('依類型的細節欄位', () => {
  it('核心場景的欄位', () => {
    expect(detailFieldsOf('class_session')).toEqual(['classroom', 'teacher'])
    expect(detailFieldsOf('assignment')).toEqual(['subject', 'submitMethod'])
    expect(detailFieldsOf('exam')).toEqual(['subject', 'examRoom'])
    expect(detailFieldsOf('medical_ride')).toEqual(['hospital', 'department', 'driver'])
    expect(detailFieldsOf('meeting')).toEqual(['meetingLink', 'project'])
    expect(detailFieldsOf('event')).toEqual([])
    for (const kind of ITEM_KINDS) for (const k of DETAIL_FIELDS[kind] ?? []) expect(DETAIL_KEYS).toContain(k)
  })

  it('存檔前只留這個類型的欄位、去掉空白與空值、超過長度截斷', () => {
    expect(cleanDetails('meeting', { meetingLink: ' https://meet.example/x ', project: '', teacher: '王老師' })).toEqual({ meetingLink: 'https://meet.example/x' })
    expect(cleanDetails('event', { teacher: '王老師' })).toEqual({})
    expect(cleanDetails('exam', { subject: 'x'.repeat(300) }).subject).toHaveLength(DETAIL_MAX)
  })

  it('顯示時依欄位順序，只列這個類型有填的', () => {
    expect(detailEntries('medical_ride', { driver: '爸爸', hospital: '台大醫院', teacher: '不顯示' })).toEqual([
      ['hospital', '台大醫院'],
      ['driver', '爸爸'],
    ])
  })

  it('schema 限制每欄最多 200 字', () => {
    const base = { id: 'a', spaceId: 's', dateISO: '2026-12-01', createdBy: 'u', createdAt: 1, updatedAt: 1 }
    expect(sharedCalendarItemSchema.safeParse({ ...base, details: { project: 'x'.repeat(201) } }).success).toBe(false)
    expect(sharedCalendarItemSchema.safeParse({ ...base, details: { project: 'x'.repeat(200) } }).success).toBe(true)
  })
})

describe('會議連結的安全檢查', () => {
  it.each(['https://meet.example/abc', 'http://intra.example/room?id=1', '  HTTPS://Meet.Example/x  '])('%s 可以做成連結', (url) => {
    expect(safeLink(url)).toMatch(/^https?:\/\//)
  })
  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'ftp://example.com', '//example.com', 'meet.example/abc', 'https://', ''])(
    '%s 不做成連結',
    (url) => expect(safeLink(url)).toBeNull(),
  )
})

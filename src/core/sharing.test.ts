import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import ja from '../i18n/locales/ja.json'
import zhTW from '../i18n/locales/zh-TW.json'
import { familySpace, T0, U } from '../test/sharingFixtures'
import type { CalendarEvent } from './schema'
import {
  busyProjectionRuleSchema,
  calendarEventToSharedItem,
  canManageSpace,
  createSpace,
  emptySharedCalendarData,
  ITEM_KINDS,
  MASKABLE_FIELDS,
  MEMBER_ROLES,
  migrateSharedCalendarData,
  removeMember,
  roleOf,
  SHARING_SCHEMA_VERSION,
  SPACE_KINDS,
  sharedCalendarItemSchema,
  SharingMigrationError,
  spaceSchema,
  SpaceMembershipError,
  SUGGESTED_KINDS,
  upsertMember,
  VISIBILITY_MODES,
} from './sharing'

describe('空間與成員', () => {
  it('使用者可以自由新增任意名稱的空間，建立者成為 owner', () => {
    const s = createSpace({ id: 's1', name: '週末登山社', kind: 'personal', ownerId: U.mom, now: T0 })
    expect(s.members).toEqual([{ userId: U.mom, role: 'owner', displayName: '', joinedAt: T0 }])
    expect(roleOf(s, U.mom)).toBe('owner')
    expect(canManageSpace(s, U.mom)).toBe(true)
  })

  it('空間名稱不能空白、空間必須至少一位 owner、成員不能重複', () => {
    expect(() => createSpace({ id: 's', name: '  ', kind: 'family', ownerId: U.mom, now: T0 })).toThrow()
    const base = familySpace()
    expect(spaceSchema.safeParse({ ...base, members: base.members.map((m) => ({ ...m, role: 'viewer' })) }).success).toBe(false)
    expect(spaceSchema.safeParse({ ...base, members: [...base.members, base.members[0]] }).success).toBe(false)
  })

  it('只有 owner 能管理成員，且不能拿掉最後一位 owner', () => {
    const s = familySpace()
    expect(() => upsertMember(s, U.dad, { userId: U.stranger, role: 'viewer' }, T0)).toThrow(SpaceMembershipError)
    expect(() => upsertMember(s, U.mom, { userId: U.mom, role: 'editor' }, T0)).toThrow(SpaceMembershipError)
    expect(() => removeMember(s, U.mom, U.mom, T0)).toThrow(SpaceMembershipError)
    const promoted = upsertMember(s, U.mom, { userId: U.dad, role: 'owner' }, T0 + 1)
    expect(roleOf(promoted, U.dad)).toBe('owner')
    expect(promoted.version).toBe(s.version + 1)
  })

  it('成員可以自己退出；非成員與已刪除空間沒有角色', () => {
    const s = removeMember(familySpace(), U.kid, U.kid, T0 + 1)
    expect(roleOf(s, U.kid)).toBeNull()
    expect(() => removeMember(familySpace(), U.kid, U.grandma, T0)).toThrow(SpaceMembershipError)
    expect(roleOf({ ...familySpace(), deletedAt: T0 }, U.mom)).toBeNull()
  })

  it('每種空間類型的建議行程類型都屬於合法類型', () => {
    for (const kinds of Object.values(SUGGESTED_KINDS)) for (const k of kinds) expect(ITEM_KINDS).toContain(k)
    expect(SUGGESTED_KINDS.school).toEqual(expect.arrayContaining(['class_session', 'assignment', 'exam']))
    expect(SUGGESTED_KINDS.family).toEqual(expect.arrayContaining(['homecoming', 'medical_ride', 'commute']))
    expect(SUGGESTED_KINDS.work).toEqual(expect.arrayContaining(['meeting', 'project_task']))
  })
})

describe('行程 schema', () => {
  it('補齊預設值：一般行程、群組完整可見、版本 1、未刪除', () => {
    const item = sharedCalendarItemSchema.parse({ id: 'a', spaceId: 's', dateISO: '2026-12-01', createdBy: U.mom, createdAt: T0, updatedAt: T0 })
    expect(item).toMatchObject({ kind: 'event', version: 1, deletedAt: null, details: {} })
    expect(item.visibility).toEqual({ mode: 'group_full', allowedUserIds: [], hiddenUserIds: [], busyLabel: '', maskedFields: [] })
  })

  it('拒絕不合法的類型、可見性與遮罩欄位', () => {
    const base = { id: 'a', spaceId: 's', dateISO: '2026-12-01', createdBy: U.mom, createdAt: T0, updatedAt: T0 }
    expect(sharedCalendarItemSchema.safeParse({ ...base, kind: 'party' }).success).toBe(false)
    expect(sharedCalendarItemSchema.safeParse({ ...base, visibility: { mode: 'public' } }).success).toBe(false)
    expect(sharedCalendarItemSchema.safeParse({ ...base, visibility: { maskedFields: ['createdBy'] } }).success).toBe(false)
    expect(sharedCalendarItemSchema.safeParse({ ...base, visibility: { busyLabel: 'x'.repeat(21) } }).success).toBe(false)
  })

  it('忙閒投射規則的來源與目標不能是同一個空間', () => {
    const rule = { id: 'r', userId: U.dad, sourceSpaceId: 'a', targetSpaceId: 'a' }
    expect(busyProjectionRuleSchema.safeParse(rule).success).toBe(false)
    expect(busyProjectionRuleSchema.parse({ ...rule, targetSpaceId: 'b' })).toMatchObject({ kinds: [], label: '', includePrivate: false, enabled: true })
  })
})

describe('舊資料相容', () => {
  const event: CalendarEvent = { id: 'e1', title: '看牙醫', dateISO: '2026-11-30', start: '14:00', end: '15:00', note: '自費', icon: 'health' }
  const ctx = { ownerId: U.mom, spaceId: 'sp-me', spaceName: '我的行程', now: T0 }

  it('CalendarEvent 轉成個人空間行程，預設 private', () => {
    const item = calendarEventToSharedItem(event, { spaceId: 'sp-me', userId: U.mom, now: T0 })
    expect(item).toMatchObject({ id: 'e1', spaceId: 'sp-me', kind: 'event', title: '看牙醫', note: '自費', icon: 'health', createdBy: U.mom, version: 1, deletedAt: null })
    expect(item.visibility.mode).toBe('private')
  })

  it('沒有日期的舊行程以轉換當天代替，不會整筆遺失', () => {
    const item = calendarEventToSharedItem({ ...event, dateISO: '' }, { spaceId: 'sp-me', userId: U.mom, now: Date.UTC(2026, 0, 2) })
    expect(item.dateISO).toBe('2026-01-02')
  })

  it('目前版本直接驗證；AppData（有 events、沒有 spaces）轉成個人空間', () => {
    const data = { ...emptySharedCalendarData(U.mom), extra: 'ignored' }
    expect(migrateSharedCalendarData(data)).toEqual(emptySharedCalendarData(U.mom))

    const migrated = migrateSharedCalendarData({ schemaVersion: 2, events: [event, { id: 7, title: 1 }] }, ctx)
    expect(migrated.schemaVersion).toBe(SHARING_SCHEMA_VERSION)
    expect(migrated.spaces).toHaveLength(1)
    expect(migrated.spaces[0]).toMatchObject({ id: 'sp-me', kind: 'personal', name: '我的行程' })
    expect(migrated.items.map((i) => i.id)).toEqual(['e1', '7'])
    expect(migrated.items[1].title).toBe('')
  })

  it('格式錯誤或不支援的版本丟出 SharingMigrationError', () => {
    expect(() => migrateSharedCalendarData(null)).toThrow(SharingMigrationError)
    expect(() => migrateSharedCalendarData({ schemaVersion: 99 })).toThrow(SharingMigrationError)
    expect(() => migrateSharedCalendarData({ schemaVersion: 1, ownerId: '' })).toThrow(SharingMigrationError)
    // 沒有 ctx 無法決定擁有者
    expect(() => migrateSharedCalendarData({ events: [] })).toThrow(SharingMigrationError)
  })
})

describe('多語系', () => {
  it.each([
    ['zh-TW', zhTW],
    ['ja', ja],
    ['en', en],
  ])('%s 有所有空間類型、角色、行程類型、可見性與遮罩欄位的文字', (_lng, dict) => {
    const t = dict.sharing as unknown as Record<string, Record<string, string>>
    for (const [group, keys] of [
      ['spaceKind', SPACE_KINDS],
      ['role', MEMBER_ROLES],
      ['itemKind', ITEM_KINDS],
      ['visibility', VISIBILITY_MODES],
      ['maskField', MASKABLE_FIELDS],
    ] as const) {
      for (const k of keys) expect(t[group][k], `${group}.${k}`).toBeTruthy()
    }
  })
})

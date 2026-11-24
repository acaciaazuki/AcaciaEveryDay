import { describe, expect, it } from 'vitest'
import { createDriveSyncProvider, DRIVE_SPACES_FILE_KIND, type DriveSpacesFile } from '../adapters/sync/driveSyncProvider'
import { SyncProviderError } from '../adapters/sync/types'
import { fakeDrive } from '../test/fakeDrive'
import { familySpace, makeItem, T0, U, workSpace } from '../test/sharingFixtures'
import { visibleCalendar } from './calendarView'
import { projectBusyBlocks, projectedBlockId } from './permissions'
import { buildSpaceSyncPayload } from './syncEnvelope'
import {
  busyProjectionRuleSchema,
  createSpace,
  emptySharedCalendarData,
  isLegacyRepresentable,
  migrateSharedCalendarData,
  PERSONAL_CALENDAR_ID,
  ruleTargets,
  SHARING_SCHEMA_VERSION,
  SharingMigrationError,
  toWireRule,
  type BusyProjectionRule,
  type SharedCalendarData,
} from './sharing'

const SPACES_FILE = 'acacia_spaces_v1.json'

/** 爸爸：工作空間 owner、家人空間 editor、另外自己開一個「社團」空間 */
const clubSpace = () => createSpace({ id: 'sp-club', name: '社團', kind: 'personal', ownerId: U.dad, now: T0 })
const v1Rule = { id: 'r1', userId: U.dad, sourceSpaceId: 'sp-work', targetSpaceId: 'sp-family', kinds: [], label: '上班中', includePrivate: false, enabled: true, updatedAt: T0, deletedAt: null }
const rule = (input: Partial<BusyProjectionRule>) => busyProjectionRuleSchema.parse({ id: 'r2', userId: U.dad, sourceId: 'sp-work', updatedAt: T0, ...input }) as BusyProjectionRule

function dadData(rules: BusyProjectionRule[], items = [makeItem({ id: 'mtg', spaceId: 'sp-work', createdBy: U.dad, start: '14:00', end: '16:00' })]): SharedCalendarData {
  return { ...emptySharedCalendarData(U.dad), spaces: [familySpace(), workSpace(), clubSpace()], items, busyProjectionRules: rules }
}

describe('忙閒投射規則 v2：舊資料相容', () => {
  it('v1 規則自動轉成 v2：單一目標、顯示忙碌、整天行程照投射，並記下原本的目標', () => {
    const r = busyProjectionRuleSchema.parse(v1Rule) as BusyProjectionRule
    expect(r).toMatchObject({ sourceId: 'sp-work', targetMode: 'selected', targetIds: ['sp-family'], display: 'busy', includeAllDay: true, legacyTargetId: 'sp-family', revision: 0 })
    expect(r).not.toHaveProperty('sourceSpaceId')
    expect(isLegacyRepresentable(r)).toBe(true)
  })

  it('能用 v1 表示的規則寫出時附上 v1 欄位；舊版 App 只留 v1 欄位寫回來，讀進來設定完全一樣', () => {
    const r = busyProjectionRuleSchema.parse(v1Rule) as BusyProjectionRule
    const wire = toWireRule(r)
    expect(wire).toMatchObject({ sourceSpaceId: 'sp-work', targetSpaceId: 'sp-family' })
    // 模擬舊版 App：只認得 v1 欄位，其餘捨棄後寫回
    const { id, userId, sourceSpaceId, targetSpaceId, kinds, label, includePrivate, enabled, updatedAt, deletedAt } = wire as typeof wire & typeof v1Rule
    const roundTrip = busyProjectionRuleSchema.parse({ id, userId, sourceSpaceId, targetSpaceId, kinds, label, includePrivate, enabled, updatedAt, deletedAt })
    expect(roundTrip).toEqual(r)
  })

  it('用到 v2 功能的規則不能用 v1 表示，寫出時也不附 v1 欄位', () => {
    for (const r of [
      rule({ targetMode: 'all' }),
      rule({ targetIds: ['sp-family', 'sp-club'] }),
      rule({ targetIds: ['sp-family'], legacyTargetId: 'sp-family', includeAllDay: true, display: 'time_only' }),
      rule({ sourceId: PERSONAL_CALENDAR_ID, targetIds: ['sp-family'] }),
      rule({ targetIds: ['sp-family'] }), // 新規則預設不投射整天行程
    ]) {
      expect(isLegacyRepresentable(r)).toBe(false)
      expect(toWireRule(r)).not.toHaveProperty('sourceSpaceId')
    }
  })

  it('規則驗證：指定目標時至少一個；來源不能同時是目標', () => {
    expect(() => rule({ targetIds: [] })).toThrow()
    expect(() => rule({ targetIds: ['sp-work'] })).toThrow()
    expect(() => rule({ targetMode: 'all' })).not.toThrow()
  })

  it('v1 共享資料讀進來轉成 v2；比這個 App 新的版本提示更新、不當成壞掉的資料', () => {
    const migrated = migrateSharedCalendarData({ ...dadData([]), schemaVersion: 1, busyProjectionRules: [v1Rule] })
    expect(migrated.schemaVersion).toBe(SHARING_SCHEMA_VERSION)
    expect(migrated.busyProjectionRules[0]).toMatchObject({ sourceId: 'sp-work', targetIds: ['sp-family'] })

    let err: unknown
    try {
      migrateSharedCalendarData({ ...dadData([]), schemaVersion: SHARING_SCHEMA_VERSION + 1 })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(SharingMigrationError)
    expect((err as SharingMigrationError).reason).toBe('newer')
    expect((err as Error).message).toContain('請先更新 App')
  })
})

describe('忙閒投射規則 v2：目標與顯示方式', () => {
  it('全部行事曆：擁有者所在的每個空間＋我的行事曆，排除來源、已刪除與已退出的空間', () => {
    const spaces = [familySpace(), workSpace(), clubSpace(), { ...createSpace({ id: 'sp-old', name: '舊', kind: 'work', ownerId: U.dad, now: T0 }), deletedAt: T0 }]
    expect(ruleTargets(rule({ targetMode: 'all' }), spaces).sort()).toEqual([PERSONAL_CALENDAR_ID, 'sp-club', 'sp-family'].sort())
    // 指定的目標裡，不是成員的空間會被略過
    expect(ruleTargets(rule({ targetIds: ['sp-family', 'sp-school'] }), spaces)).toEqual(['sp-family'])
  })

  it('一條規則投射到多個目標：每個目標各自的區塊 id；v1 原本的目標沿用舊 id', () => {
    const data = dadData([rule({ id: 'r1', targetIds: ['sp-family', 'sp-club'], legacyTargetId: 'sp-family' })])
    const family = projectBusyBlocks({ rules: data.busyProjectionRules, spaces: data.spaces, items: data.items, targetSpaceId: 'sp-family' })
    const club = projectBusyBlocks({ rules: data.busyProjectionRules, spaces: data.spaces, items: data.items, targetSpaceId: 'sp-club' })
    expect(family).toHaveLength(1)
    expect(club).toHaveLength(1)
    expect(family[0]!.id).toBe(projectedBlockId('r1', 'mtg'))
    expect(club[0]!.id).toBe(projectedBlockId('r1', 'mtg', 'sp-club'))
    expect(family[0]!.id).not.toBe(club[0]!.id)
    expect(club[0]).toMatchObject({ spaceId: 'sp-club', title: '', start: '14:00', end: '16:00' })
  })

  it('只顯示時間：沒有文字，區塊帶 display；顯示忙碌時用規則的文字', () => {
    const timeOnly = dadData([rule({ targetIds: ['sp-family'], display: 'time_only', label: '上班中' })])
    const [b] = projectBusyBlocks({ rules: timeOnly.busyProjectionRules, spaces: timeOnly.spaces, items: timeOnly.items, targetSpaceId: 'sp-family' })
    expect(b!.visibility.busyLabel).toBe('')
    expect(b!.projection).toEqual({ ruleId: 'r2', display: 'time_only' })

    const busy = dadData([rule({ targetIds: ['sp-family'], label: '上班中' })])
    const [c] = projectBusyBlocks({ rules: busy.busyProjectionRules, spaces: busy.spaces, items: busy.items, targetSpaceId: 'sp-family' })
    expect(c!.visibility.busyLabel).toBe('上班中')
    expect(c!.projection).toEqual({ ruleId: 'r2' })
  })

  it('整天行程：預設不投射，開啟 includeAllDay 才投射', () => {
    const allDay = [makeItem({ id: 'trip', spaceId: 'sp-work', createdBy: U.dad, start: '', end: '' })]
    const off = dadData([rule({ targetIds: ['sp-family'] })], allDay)
    const on = dadData([rule({ targetIds: ['sp-family'], includeAllDay: true })], allDay)
    const run = (d: SharedCalendarData) => projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: d.items, targetSpaceId: 'sp-family' })
    expect(run(off)).toEqual([])
    expect(run(on)).toHaveLength(1)
  })

  it('來源是「我的行事曆」的規則在第 2 階段才接上個人行程，目前不產生區塊', () => {
    const d = dadData([rule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'all' })])
    expect(projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: d.items, targetSpaceId: 'sp-family' })).toEqual([])
  })

  it('從目標移除：同步時送墓碑給被移除的空間；再加回來時新區塊的版本比墓碑高', () => {
    const run = (r: BusyProjectionRule) => {
      const d = dadData([r])
      return projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: d.items, targetSpaceId: 'sp-club', includeDeleted: true })
    }
    const live = run(rule({ targetIds: ['sp-family', 'sp-club'] }))
    const removed = run(rule({ targetIds: ['sp-family'], retiredTargetIds: ['sp-club'], revision: 2 }))
    const readded = run(rule({ targetIds: ['sp-family', 'sp-club'], revision: 4 }))
    expect(removed[0]!.id).toBe(live[0]!.id)
    expect(removed[0]!.deletedAt).not.toBeNull()
    expect(removed[0]!.version).toBeGreaterThan(live[0]!.version)
    expect(readded[0]!.deletedAt).toBeNull()
    expect(readded[0]!.version).toBeGreaterThan(removed[0]!.version)
    // 沒有要同步（includeDeleted 為 false）時，被移除的目標什麼都不產生
    const d = dadData([rule({ targetIds: ['sp-family'], retiredTargetIds: ['sp-club'], revision: 2 })])
    expect(projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: d.items, targetSpaceId: 'sp-club' })).toEqual([])
  })
})

describe('忙閒投射規則 v2：各分頁的顯示', () => {
  const data = dadData([rule({ targetMode: 'all', label: '上班中' })])

  it('全部：自己的投射區塊不顯示（原始行程已經看得到）', () => {
    const v = visibleCalendar(data, U.dad, U.dad, 'all')
    expect(v.shared.filter((e) => e.projected)).toEqual([])
    expect(v.shared.map((e) => e.id)).toContain('mtg')
  })

  it('切到目標空間：顯示自己的投射區塊，唯讀、帶原始標題並標註來源', () => {
    const v = visibleCalendar(data, U.dad, U.dad, 'sp-family')
    const own = v.shared.filter((e) => e.projected)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ access: 'busy', canEdit: false, canManageVisibility: false, busyLabel: '上班中', busyDisplay: 'busy', projectedFrom: { id: 'sp-work', name: '公司專案' } })
    // 自己投射出去的區塊直接帶入來源行程的真實標題
    expect(own[0]!.item.title).toBe('行程')
  })

  it('我的行事曆來源：用 personalTitles 帶入個人行程標題；預覽其他成員視角時不帶', () => {
    const d = dadData([rule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: ['sp-family'] })])
    d.personalBusySlots = [{ id: 'ev1', dateISO: '2026-12-01', start: '09:00', end: '10:00', version: 1, updatedAt: T0, deletedAt: null }]
    const personalTitles = new Map([['ev1', '看牙醫']])
    const own = visibleCalendar(d, U.dad, U.dad, 'sp-family', { personalTitles }).shared.filter((e) => e.projected)
    expect(own).toHaveLength(1)
    expect(own[0]!.item.title).toBe('看牙醫')
    const mom = visibleCalendar(d, U.dad, U.mom, 'sp-family', { personalTitles }).shared.filter((e) => e.projected)
    expect(mom).toHaveLength(1)
    expect(JSON.stringify(mom)).not.toContain('看牙醫')
  })

  it('同步出去的忙碌區塊仍然不含標題', () => {
    const d = dadData([rule({ targetMode: 'all', label: '上班中' })], [makeItem({ id: 'mtg', spaceId: 'sp-work', createdBy: U.dad, title: '董事會', start: '14:00', end: '16:00' })])
    for (const viewer of [U.mom, U.dad]) {
      const payload = buildSpaceSyncPayload({ data: d, spaceId: 'sp-family', viewerId: viewer, now: T0 })!
      const blocks = payload.entries.filter((e) => e.projection)
      expect(blocks.length).toBeGreaterThan(0)
      expect(JSON.stringify(blocks)).not.toContain('董事會')
    }
  })

  it('我的行事曆：顯示投射到這裡的自己的忙碌區塊；預覽其他成員的視角時沒有', () => {
    const mine = visibleCalendar(data, U.dad, U.dad, 'personal')
    expect(mine.shared).toHaveLength(1)
    expect(mine.shared[0]).toMatchObject({ space: { id: PERSONAL_CALENDAR_ID }, projectedFrom: { id: 'sp-work' }, canEdit: false })
    expect(visibleCalendar(data, U.dad, U.mom, 'personal').shared).toEqual([])
  })

  it('其他成員看到忙碌區塊，但不知道來源也看不到標題', () => {
    const v = visibleCalendar(data, U.dad, U.mom, 'sp-family')
    const b = v.shared.find((e) => e.projected)!
    expect(b).toMatchObject({ access: 'busy', busyLabel: '上班中', busyDisplay: 'busy' })
    expect(b.item.title).toBe('')
    expect(b.projectedFrom).toBeUndefined()
    expect(JSON.stringify(b)).not.toContain('公司專案')
  })
})

describe('Drive 檔案版本', () => {
  const provider = (drive: ReturnType<typeof fakeDrive>) => createDriveSyncProvider({ getToken: () => 'tok', drive: drive.api, isOnline: () => true, now: () => T0 + 1000 })
  const uploaded = (drive: ReturnType<typeof fakeDrive>) => drive.files[SPACES_FILE] as DriveSpacesFile & { busyProjectionRules: Record<string, unknown>[] }

  it('規則都能用 v1 表示：檔案維持版本 1，規則附上 v1 欄位（舊版 App 照常同步）', async () => {
    const drive = fakeDrive()
    await provider(drive).push({ viewerId: U.dad, data: dadData([busyProjectionRuleSchema.parse(v1Rule) as BusyProjectionRule]), changedSince: null })
    expect(uploaded(drive).fileVersion).toBe(1)
    expect(uploaded(drive).busyProjectionRules[0]).toMatchObject({ sourceSpaceId: 'sp-work', targetSpaceId: 'sp-family', sourceId: 'sp-work' })
  })

  it('用到 v2 功能：檔案升到版本 2', async () => {
    const drive = fakeDrive()
    await provider(drive).push({ viewerId: U.dad, data: dadData([rule({ targetMode: 'all' })]), changedSince: null })
    expect(uploaded(drive).fileVersion).toBe(2)
    expect(uploaded(drive).busyProjectionRules[0]).not.toHaveProperty('sourceSpaceId')
  })

  it('雲端檔案來自較新版本：回報 update_required、提示更新，而且不覆寫雲端', async () => {
    const newer = { kind: DRIVE_SPACES_FILE_KIND, fileVersion: 3, ownerId: U.dad, updatedAt: T0, payloads: [], busyProjectionRules: [], somethingNew: true }
    const drive = fakeDrive({ [SPACES_FILE]: newer })
    const p = provider(drive)
    const err = await p.push({ viewerId: U.dad, data: dadData([]), changedSince: null }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SyncProviderError)
    expect((err as SyncProviderError).code).toBe('update_required')
    expect((err as Error).message).toContain('請先更新 App')
    expect(drive.uploads).toEqual([])
    expect(drive.files[SPACES_FILE]).toEqual(newer)
  })
})

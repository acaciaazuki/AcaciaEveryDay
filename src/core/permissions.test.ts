import { describe, expect, it } from 'vitest'
import { familySpace, makeItem, schoolSpace, SECRET, T0, U, workSpace } from '../test/sharingFixtures'
import {
  applyItemEdit,
  PermissionError,
  projectBusyBlocks,
  projectedBlockId,
  resolveCalendarItemForViewer,
  resolveItemsForViewer,
  softDeleteItem,
} from './permissions'
import { busyProjectionRuleSchema, type SharedCalendarItem } from './sharing'

const leaks = (value: unknown) => {
  const json = JSON.stringify(value)
  return Object.values(SECRET).filter((s) => json.includes(s))
}

const secretItem = (overrides: Parameters<typeof makeItem>[0]) =>
  makeItem({ title: SECRET.title, location: SECRET.location, note: SECRET.note, details: { doctor: SECRET.detail }, icon: 'health', kind: 'medical_ride', ...overrides })

describe('家庭內部局部隱藏', () => {
  const family = familySpace()

  it('selected_members：只有白名單成員與建立者看得到', () => {
    // 媽媽幫爸爸準備生日驚喜，只讓小孩知道
    const item = makeItem({ spaceId: family.id, createdBy: U.mom, title: '爸爸生日驚喜', visibility: { mode: 'selected_members', allowedUserIds: [U.kid] } })
    expect(resolveCalendarItemForViewer(item, U.mom, { space: family })?.access).toBe('full')
    expect(resolveCalendarItemForViewer(item, U.kid, { space: family })?.item.title).toBe('爸爸生日驚喜')
    expect(resolveCalendarItemForViewer(item, U.dad, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(item, U.grandma, { space: family })).toBeNull()
  })

  it('白名單不能讓非成員看到', () => {
    const item = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'selected_members', allowedUserIds: [U.stranger] } })
    expect(resolveCalendarItemForViewer(item, U.stranger, { space: family })).toBeNull()
  })

  it('hiddenUserIds 在任何模式都優先，連白名單也蓋過', () => {
    const groupHidden = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'group_full', hiddenUserIds: [U.grandma] } })
    expect(resolveCalendarItemForViewer(groupHidden, U.grandma, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(groupHidden, U.kid, { space: family })?.access).toBe('full')

    const busyHidden = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'busy_only', hiddenUserIds: [U.grandma] } })
    expect(resolveCalendarItemForViewer(busyHidden, U.grandma, { space: family })).toBeNull()

    const both = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'selected_members', allowedUserIds: [U.kid, U.dad], hiddenUserIds: [U.dad] } })
    expect(resolveCalendarItemForViewer(both, U.dad, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(both, U.kid, { space: family })).not.toBeNull()
  })

  it('建立者把自己放進 hiddenUserIds 也不會看不到自己的行程', () => {
    const item = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'private', hiddenUserIds: [U.mom] } })
    expect(resolveCalendarItemForViewer(item, U.mom, { space: family })?.access).toBe('full')
  })

  it('其他成員看到的副本不會透露還有誰被隱藏', () => {
    const item = makeItem({ spaceId: family.id, createdBy: U.mom, visibility: { mode: 'group_full', hiddenUserIds: [U.grandma] } })
    const r = resolveCalendarItemForViewer(item, U.kid, { space: family })
    expect(r?.item.visibility.hiddenUserIds).toEqual([])
    expect(JSON.stringify(r)).not.toContain(U.grandma)
  })

  it('private：連空間 owner 都看不到別人的私人行程', () => {
    const item = makeItem({ spaceId: family.id, createdBy: U.dad, visibility: { mode: 'private' } })
    expect(resolveCalendarItemForViewer(item, U.mom, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(item, U.dad, { space: family })?.access).toBe('full')
  })

  it('maskedFields：可以看到行程，但指定欄位被移除', () => {
    // 爸爸接奶奶就醫：家人知道時間地點，但看不到科別與醫師
    const item = secretItem({ spaceId: family.id, createdBy: U.dad, visibility: { mode: 'group_full', maskedFields: ['title', 'details', 'note', 'kind'] } })
    const r = resolveCalendarItemForViewer(item, U.kid, { space: family })!
    expect(r.access).toBe('masked')
    expect(r.item).toMatchObject({ title: '', note: '', details: {}, kind: 'event', location: SECRET.location, redaction: 'masked' })
    expect(r.item.icon).toBeUndefined()
    expect(r.item.visibility.maskedFields).toEqual(['title', 'details', 'note', 'kind'])
    expect(leaks(r)).toEqual([SECRET.location])
    // 建立者自己看完整內容
    expect(leaks(resolveCalendarItemForViewer(item, U.dad, { space: family }))).toHaveLength(4)
  })
})

describe('工作／學校與私生活的忙閒隔離', () => {
  const family = familySpace()
  const work = workSpace()
  const school = schoolSpace()

  it('busy_only 只留下時間與忙碌文字，不洩漏標題、地點、備註、細節、類型、圖示', () => {
    const item = secretItem({ spaceId: family.id, createdBy: U.mom, start: '13:30', end: '15:00', titleColor: '#f00', visibility: { mode: 'busy_only', busyLabel: '外出' } })
    for (const viewer of [U.dad, U.kid, U.grandma]) {
      const r = resolveCalendarItemForViewer(item, viewer, { space: family })!
      expect(r.access).toBe('busy')
      expect(r.item).toMatchObject({ dateISO: '2026-12-01', start: '13:30', end: '15:00', title: '', kind: 'event', redaction: 'busy', createdBy: U.mom })
      expect(r.item.visibility).toEqual({ mode: 'busy_only', allowedUserIds: [], hiddenUserIds: [], busyLabel: '外出', maskedFields: [] })
      expect(r.item.icon).toBeUndefined()
      expect(r.item.titleColor).toBeUndefined()
      expect(r.item.updatedBy).toBeUndefined()
      expect(leaks(r)).toEqual([])
      expect(r.canEdit).toBe(false)
    }
  })

  it('工作會議投射到家人空間：家人只看到「上班中」', () => {
    const meeting = makeItem({
      spaceId: work.id,
      createdBy: U.dad,
      kind: 'meeting',
      title: '併購案保密會議',
      location: '32F 董事會議室',
      note: '不能外流',
      details: { link: 'https://meet.example/secret' },
      start: '14:00',
      end: '16:00',
    })
    const rule = busyProjectionRuleSchema.parse({ id: 'r-work', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id, label: '上班中' })
    const blocks = projectBusyBlocks({ rules: [rule], spaces: [family, work], items: [meeting], targetSpaceId: family.id })

    expect(blocks).toHaveLength(1)
    const [block] = blocks
    expect(block).toMatchObject({ spaceId: family.id, createdBy: U.dad, start: '14:00', end: '16:00', title: '', kind: 'event', projection: { ruleId: 'r-work' } })
    expect(block.visibility.mode).toBe('busy_only')
    expect(block.id).toBe(projectedBlockId('r-work', meeting.id))
    expect(block.id).not.toContain(meeting.id)
    expect(JSON.stringify(block)).not.toMatch(/併購|32F|不能外流|meet\.example|sp-work/)

    const forKid = resolveCalendarItemForViewer(block, U.kid, { space: family })!
    expect(forKid.access).toBe('busy')
    expect(forKid.item.visibility.busyLabel).toBe('上班中')
    expect(forKid.item.projection).toBeUndefined()
    // 爸爸自己看到的是自動產生的區塊：不能直接編輯
    const forDad = resolveCalendarItemForViewer(block, U.dad, { space: family })!
    expect(forDad.canEdit).toBe(false)
    expect(forDad.canManageVisibility).toBe(false)
  })

  it('同事不是家人空間成員，看不到投射區塊；家人也看不到工作空間的原始行程', () => {
    const meeting = makeItem({ spaceId: work.id, createdBy: U.dad, kind: 'meeting', title: '季度檢討' })
    const rule = busyProjectionRuleSchema.parse({ id: 'r', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id })
    const [block] = projectBusyBlocks({ rules: [rule], spaces: [family, work], items: [meeting], targetSpaceId: family.id })
    expect(resolveCalendarItemForViewer(block, U.coworker, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(meeting, U.mom, { space: work })).toBeNull()
  })

  it('學校考試投射到家人空間，只投射指定類型與日期範圍', () => {
    const kidFamily = family
    const exam = makeItem({ spaceId: school.id, createdBy: U.kid, kind: 'exam', title: '數學期末考', dateISO: '2026-12-20' })
    const homework = makeItem({ spaceId: school.id, createdBy: U.kid, kind: 'assignment', title: '自然作業', dateISO: '2026-12-21' })
    const lateExam = makeItem({ spaceId: school.id, createdBy: U.kid, kind: 'exam', title: '補考', dateISO: '2027-01-15' })
    const teacherClass = makeItem({ spaceId: school.id, createdBy: U.teacher, kind: 'class_session', title: '導師課' })
    const rule = busyProjectionRuleSchema.parse({ id: 'r-school', userId: U.kid, sourceSpaceId: school.id, targetSpaceId: kidFamily.id, kinds: ['exam'] })

    const blocks = projectBusyBlocks({
      rules: [rule],
      spaces: [kidFamily, school],
      items: [exam, homework, lateExam, teacherClass],
      targetSpaceId: kidFamily.id,
      range: { from: '2026-12-01', to: '2026-12-31' },
    })
    expect(blocks.map((b) => b.dateISO)).toEqual(['2026-12-20'])
    expect(JSON.stringify(blocks)).not.toMatch(/數學|期末|導師/)
  })

  it('不能投射別人的行程；規則擁有者必須同時是兩個空間的成員', () => {
    const coworkerMeeting = makeItem({ spaceId: work.id, createdBy: U.coworker, kind: 'meeting' })
    const dadRule = busyProjectionRuleSchema.parse({ id: 'r1', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id })
    expect(projectBusyBlocks({ rules: [dadRule], spaces: [family, work], items: [coworkerMeeting], targetSpaceId: family.id })).toEqual([])

    // 同事不是家人空間成員：規則無效
    const coworkerRule = busyProjectionRuleSchema.parse({ id: 'r2', userId: U.coworker, sourceSpaceId: work.id, targetSpaceId: family.id })
    expect(projectBusyBlocks({ rules: [coworkerRule], spaces: [family, work], items: [coworkerMeeting], targetSpaceId: family.id })).toEqual([])
  })

  it('private 行程預設不投射；停用的規則不投射；沿用來源的 hiddenUserIds', () => {
    const privateItem = makeItem({ spaceId: work.id, createdBy: U.dad, visibility: { mode: 'private' } })
    const hiddenFromGrandma = makeItem({ spaceId: work.id, createdBy: U.dad, visibility: { mode: 'group_full', hiddenUserIds: [U.grandma] } })
    const base = { id: 'r', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id }
    const opts = { spaces: [family, work], items: [privateItem, hiddenFromGrandma], targetSpaceId: family.id }

    const blocks = projectBusyBlocks({ ...opts, rules: [busyProjectionRuleSchema.parse(base)] })
    expect(blocks).toHaveLength(1)
    expect(resolveCalendarItemForViewer(blocks[0], U.grandma, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(blocks[0], U.mom, { space: family })?.access).toBe('busy')

    expect(projectBusyBlocks({ ...opts, rules: [busyProjectionRuleSchema.parse({ ...base, includePrivate: true })] })).toHaveLength(2)
    expect(projectBusyBlocks({ ...opts, rules: [busyProjectionRuleSchema.parse({ ...base, enabled: false })] })).toEqual([])
  })

  it('同步用：來源刪除或規則停用時產生墓碑', () => {
    const deleted = makeItem({ spaceId: work.id, createdBy: U.dad, deletedAt: T0 + 5, updatedAt: T0 + 5 })
    const live = makeItem({ spaceId: work.id, createdBy: U.dad })
    const rule = busyProjectionRuleSchema.parse({ id: 'r', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id })
    const opts = { spaces: [family, work], items: [deleted, live], targetSpaceId: family.id }

    expect(projectBusyBlocks({ ...opts, rules: [rule] })).toHaveLength(1)
    const withTombstones = projectBusyBlocks({ ...opts, rules: [rule], includeDeleted: true })
    expect(withTombstones.map((b) => b.deletedAt)).toEqual([T0 + 5, null])

    const disabled = projectBusyBlocks({ ...opts, rules: [{ ...rule, enabled: false, updatedAt: T0 + 9 }], includeDeleted: true })
    expect(disabled.every((b) => b.deletedAt !== null)).toBe(true)
    expect(disabled.find((b) => b.id === projectedBlockId('r', live.id))).toMatchObject({ version: live.version + 1, updatedAt: T0 + 9 })
  })
})

describe('角色的檢視與編輯權限邊界', () => {
  const family = familySpace()
  const shared = makeItem({ spaceId: family.id, createdBy: U.mom, title: '週日家庭聚餐' })

  it.each([
    [U.mom, 'owner', true, true],
    [U.dad, 'editor', true, false],
    [U.kid, 'viewer', false, false],
  ] as const)('%s（%s）看得到完整內容，canEdit=%s、canManageVisibility=%s', (viewer, role, canEdit, canManage) => {
    const r = resolveCalendarItemForViewer(shared, viewer, { space: family })!
    expect(r).toMatchObject({ access: 'full', role, canEdit, canManageVisibility: canManage })
    expect(r.item.title).toBe('週日家庭聚餐')
  })

  it('非成員、別的空間、已刪除的空間：一律看不到', () => {
    expect(resolveCalendarItemForViewer(shared, U.stranger, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(shared, U.coworker, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(shared, U.mom, { space: workSpace() })).toBeNull()
    expect(resolveCalendarItemForViewer(shared, U.mom, { space: { ...family, deletedAt: T0 } })).toBeNull()
  })

  it('別人的行程：owner 能編輯內容但不能管理可見性', () => {
    const dadItem = makeItem({ spaceId: family.id, createdBy: U.dad })
    expect(resolveCalendarItemForViewer(dadItem, U.mom, { space: family })).toMatchObject({ canEdit: true, canManageVisibility: false, isOwnItem: false })
  })

  it('busy_only 或遮罩的行程，就算是 owner 也不能編輯（避免蓋掉看不到的欄位）', () => {
    const busy = makeItem({ spaceId: family.id, createdBy: U.dad, visibility: { mode: 'busy_only' } })
    const masked = makeItem({ spaceId: family.id, createdBy: U.dad, visibility: { mode: 'group_full', maskedFields: ['note'] } })
    expect(resolveCalendarItemForViewer(busy, U.mom, { space: family })?.canEdit).toBe(false)
    expect(resolveCalendarItemForViewer(masked, U.mom, { space: family })?.canEdit).toBe(false)
  })

  it('被降為 viewer 的建立者仍能管理自己行程的可見性，但不能編輯內容', () => {
    const kidItem = makeItem({ spaceId: family.id, createdBy: U.kid })
    expect(resolveCalendarItemForViewer(kidItem, U.kid, { space: family })).toMatchObject({ isOwnItem: true, canEdit: false, canManageVisibility: true })
  })

  it('已刪除的行程預設不顯示，同步時可以取得', () => {
    const gone = makeItem({ spaceId: family.id, createdBy: U.mom, deletedAt: T0 + 1 })
    expect(resolveCalendarItemForViewer(gone, U.dad, { space: family })).toBeNull()
    expect(resolveCalendarItemForViewer(gone, U.dad, { space: family, includeDeleted: true })).not.toBeNull()
  })

  it('同步收到的遮罩副本維持遮罩、不能編輯', () => {
    const copy: SharedCalendarItem = { ...makeItem({ spaceId: family.id, createdBy: U.mom, title: '' }), redaction: 'busy' }
    expect(resolveCalendarItemForViewer(copy, U.mom, { space: family })).toMatchObject({ access: 'busy', canEdit: false, isOwnItem: false })
  })

  it('applyItemEdit：editor 可改內容、版本 +1；viewer 與非成員被拒；只有建立者能改可見性', () => {
    const edited = applyItemEdit(shared, { title: '週日家庭聚餐（改到晚上）', start: '18:00' }, U.dad, family, T0 + 10)
    expect(edited).toMatchObject({ title: '週日家庭聚餐（改到晚上）', start: '18:00', version: shared.version + 1, updatedAt: T0 + 10, updatedBy: U.dad, createdBy: U.mom })

    expect(() => applyItemEdit(shared, { title: 'x' }, U.kid, family, T0)).toThrow(PermissionError)
    expect(() => applyItemEdit(shared, { title: 'x' }, U.stranger, family, T0)).toThrow(PermissionError)
    expect(() => applyItemEdit(shared, { visibility: { mode: 'private' } }, U.dad, family, T0)).toThrow(PermissionError)

    const privateNow = applyItemEdit(shared, { visibility: { mode: 'busy_only', busyLabel: '有事' } }, U.mom, family, T0 + 20)
    expect(privateNow.visibility).toMatchObject({ mode: 'busy_only', busyLabel: '有事' })
  })

  it('softDeleteItem：留下墓碑並遞增版本；viewer 不能刪', () => {
    const del = softDeleteItem(shared, U.dad, family, T0 + 30)
    expect(del).toMatchObject({ deletedAt: T0 + 30, updatedAt: T0 + 30, version: shared.version + 1, updatedBy: U.dad })
    expect(() => softDeleteItem(shared, U.kid, family, T0)).toThrow(PermissionError)
  })

  it('resolveItemsForViewer 只回傳看得到的，找不到空間的行程視為不可見', () => {
    const items = [
      shared,
      makeItem({ spaceId: family.id, createdBy: U.dad, visibility: { mode: 'private' } }),
      makeItem({ spaceId: 'sp-unknown', createdBy: U.kid }),
      makeItem({ spaceId: workSpace().id, createdBy: U.dad }),
    ]
    const r = resolveItemsForViewer(items, U.kid, [family, workSpace()])
    expect(r.map((x) => x.item.id)).toEqual([shared.id])
  })
})

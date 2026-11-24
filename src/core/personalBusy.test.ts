import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { familySpace, T0, U, workSpace } from '../test/sharingFixtures'
import { emptyAppData, type CalendarEvent } from './schema'
import { visibleCalendar } from './calendarView'
import { needsPersonalBusySlots, syncPersonalBusySlots } from './personalBusy'
import { projectBusyBlocks } from './permissions'
import { busyProjectionRuleSchema, emptySharedCalendarData, PERSONAL_CALENDAR_ID, type BusyProjectionRule, type PersonalBusySlot, type SharedCalendarData } from './sharing'
import { buildSpaceSyncPayload } from './syncEnvelope'

const ev = (id: string, start = '14:00', end = '16:00', extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: '腫瘤科回診', dateISO: '2026-12-01', start, end, note: '帶健保卡', ...extra })
const rule = (input: Partial<BusyProjectionRule> = {}) =>
  busyProjectionRuleSchema.parse({ id: 'rp', userId: U.dad, sourceId: PERSONAL_CALENDAR_ID, targetIds: ['sp-family'], label: '有事', updatedAt: T0, ...input }) as BusyProjectionRule

function dadData(slots: PersonalBusySlot[], rules = [rule()]): SharedCalendarData {
  return { ...emptySharedCalendarData(U.dad), spaces: [familySpace(), workSpace()], busyProjectionRules: rules, personalBusySlots: slots }
}
const slotsOf = (events: CalendarEvent[], at = T0) => syncPersonalBusySlots([], events, at)!

describe('「我的行事曆」的忙碌影子', () => {
  it('只留下日期與時間，不含標題、備註；沒有日期的舊行程略過', () => {
    const slots = slotsOf([ev('e1'), ev('e2', '', '', { dateISO: '' })])
    expect(slots).toEqual([{ id: 'e1', dateISO: '2026-12-01', start: '14:00', end: '16:00', version: Math.floor(T0 / 1000), updatedAt: T0, deletedAt: null }])
    expect(JSON.stringify(slots)).not.toMatch(/腫瘤科|健保卡/)
  })

  it('只改標題或備註：沒有變化（回傳 null，不寫入也不觸發同步）；改時間：版本提高', () => {
    const slots = slotsOf([ev('e1')])
    expect(syncPersonalBusySlots(slots, [ev('e1', '14:00', '16:00', { title: '改名', note: '改備註' })], T0 + 5000)).toBeNull()
    const moved = syncPersonalBusySlots(slots, [ev('e1', '15:00', '17:00')], T0 + 5000)!
    expect(moved[0]).toMatchObject({ start: '15:00', end: '17:00', updatedAt: T0 + 5000, deletedAt: null })
    expect(moved[0]!.version).toBeGreaterThan(slots[0]!.version)
  })

  it('刪除行程留下刪除標記；同一個 id 加回來時清掉標記；同一秒內連續修改版本仍然遞增', () => {
    const slots = slotsOf([ev('e1')])
    const deleted = syncPersonalBusySlots(slots, [], T0)!
    expect(deleted[0]).toMatchObject({ id: 'e1', deletedAt: T0 })
    expect(deleted[0]!.version).toBe(slots[0]!.version + 1)
    // 已經是刪除標記的不會重複更新
    expect(syncPersonalBusySlots(deleted, [], T0 + 1000)).toBeNull()
    const back = syncPersonalBusySlots(deleted, [ev('e1')], T0)!
    expect(back[0]).toMatchObject({ deletedAt: null })
    expect(back[0]!.version).toBe(deleted[0]!.version + 1)
  })

  it('只有存在以「我的行事曆」為來源的規則（停用的也算、刪除的不算）才需要影子', () => {
    expect(needsPersonalBusySlots([rule()], U.dad)).toBe(true)
    expect(needsPersonalBusySlots([rule({ enabled: false })], U.dad)).toBe(true)
    expect(needsPersonalBusySlots([rule({ deletedAt: T0 })], U.dad)).toBe(false)
    expect(needsPersonalBusySlots([rule({ sourceId: 'sp-work' })], U.dad)).toBe(false)
    expect(needsPersonalBusySlots([rule()], U.mom)).toBe(false)
  })
})

describe('以「我的行事曆」為來源的投射', () => {
  it('產生忙碌區塊：只有時間與規則文字，區塊 id 看不出個人行程 id', () => {
    const d = dadData(slotsOf([ev('e1')]))
    const [b] = projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: [], personalSlots: d.personalBusySlots, targetSpaceId: 'sp-family' })
    expect(b).toMatchObject({ spaceId: 'sp-family', title: '', note: '', start: '14:00', end: '16:00', createdBy: U.dad, deletedAt: null, visibility: { mode: 'busy_only', busyLabel: '有事' } })
    expect(b!.id).not.toContain('e1')
    expect(JSON.stringify(b)).not.toMatch(/腫瘤科|健保卡/)
  })

  it('全部行事曆：投射到所有空間，但不會投射回「我的行事曆」本身', () => {
    const d = dadData(slotsOf([ev('e1')]), [rule({ targetMode: 'all', targetIds: [] })])
    const run = (target: string) => projectBusyBlocks({ rules: d.busyProjectionRules, spaces: d.spaces, items: [], personalSlots: d.personalBusySlots, targetSpaceId: target })
    expect(run('sp-family')).toHaveLength(1)
    expect(run('sp-work')).toHaveLength(1)
    expect(run(PERSONAL_CALENDAR_ID)).toEqual([])
  })

  it('整天行程預設不投射；開啟 includeAllDay 才投射', () => {
    const slots = slotsOf([ev('trip', '', '')])
    const run = (r: BusyProjectionRule) => projectBusyBlocks({ rules: [r], spaces: dadData([]).spaces, items: [], personalSlots: slots, targetSpaceId: 'sp-family' })
    expect(run(rule())).toEqual([])
    expect(run(rule({ includeAllDay: true }))).toHaveLength(1)
  })

  it('刪除個人行程：同步時送出墓碑，版本比原本的區塊高；平常畫面上直接消失', () => {
    const live = slotsOf([ev('e1')])
    const deleted = syncPersonalBusySlots(live, [], T0 + 60_000)!
    const run = (slots: PersonalBusySlot[], includeDeleted: boolean) =>
      projectBusyBlocks({ rules: [rule()], spaces: dadData([]).spaces, items: [], personalSlots: slots, targetSpaceId: 'sp-family', includeDeleted })
    const [before] = run(live, true)
    const [tomb] = run(deleted, true)
    expect(tomb!.id).toBe(before!.id)
    expect(tomb!.deletedAt).not.toBeNull()
    expect(tomb!.version).toBeGreaterThan(before!.version)
    expect(run(deleted, false)).toEqual([])
  })

  it('同步封包：其他成員收到的區塊不含任何個人行程內容', () => {
    const d = dadData(slotsOf([ev('e1')]))
    const payload = buildSpaceSyncPayload({ data: d, spaceId: 'sp-family', viewerId: U.mom, now: T0 + 1000 })!
    const block = payload.entries.find((e) => e.projection)!
    expect(block).toMatchObject({ start: '14:00', end: '16:00', title: '', redaction: 'busy' })
    // 規則 id 換成區塊自己的 id，不同空間的區塊串不起來
    expect(block.projection).toEqual({ ruleId: block.id })
    expect(JSON.stringify(payload)).not.toMatch(/腫瘤科|健保卡|"e1"/)
  })

  it('畫面：自己切到目標空間看得到（來源是我的行事曆）；「全部」不顯示；其他成員只看到忙碌', () => {
    const d = dadData(slotsOf([ev('e1')]))
    const own = visibleCalendar(d, U.dad, U.dad, 'sp-family').shared.filter((e) => e.projected)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ canEdit: false, projectedFrom: { id: PERSONAL_CALENDAR_ID } })
    expect(visibleCalendar(d, U.dad, U.dad, 'all').shared.filter((e) => e.projected)).toEqual([])
    const mom = visibleCalendar(d, U.dad, U.mom, 'sp-family').shared.find((e) => e.projected)!
    expect(mom).toMatchObject({ access: 'busy', busyLabel: '有事' })
    expect(mom.projectedFrom).toBeUndefined()
  })
})

describe('鏡像程序：個人行程變動 → 影子 → 共享資料', () => {
  beforeEach(async () => {
    const { useAppStore } = await import('../store/useAppStore')
    const { useSpacesStore } = await import('../store/useSpacesStore')
    useAppStore.setState(emptyAppData())
    useSpacesStore.getState().reset()
  })

  it('有以「我的行事曆」為來源的規則才建立影子；新增、刪除行程會跟著更新', async () => {
    const { useAppStore } = await import('../store/useAppStore')
    const { useSpacesStore } = await import('../store/useSpacesStore')
    const { mirrorPersonalBusyNow } = await import('../store/personalBusyMirror')
    useAppStore.setState({ events: [ev('e1')] })

    mirrorPersonalBusyNow(T0)
    expect(useSpacesStore.getState().data.personalBusySlots).toEqual([])

    const st = useSpacesStore.getState()
    const family = st.createSpace({ name: '家', kind: 'family' })
    st.addRule({ sourceId: PERSONAL_CALENDAR_ID, targetIds: [family] })
    mirrorPersonalBusyNow(T0)
    expect(useSpacesStore.getState().data.personalBusySlots.map((s) => s.id)).toEqual(['e1'])

    // 沒有變化時不寫入（資料物件不變，也就不會觸發同步）
    const before = useSpacesStore.getState().data
    mirrorPersonalBusyNow(T0 + 1000)
    expect(useSpacesStore.getState().data).toBe(before)

    useAppStore.setState({ events: [] })
    mirrorPersonalBusyNow(T0 + 2000)
    expect(useSpacesStore.getState().data.personalBusySlots[0]).toMatchObject({ id: 'e1', deletedAt: T0 + 2000 })
  })
})

describe('其他成員收到的投射區塊', () => {
  it('保留「只顯示時間」的設定；看不到規則 id', () => {
    const d = dadData(slotsOf([ev('e1')]), [rule({ display: 'time_only' })])
    const payload = buildSpaceSyncPayload({ data: d, spaceId: 'sp-family', viewerId: U.mom, now: T0 + 1000 })!
    const block = payload.entries.find((e) => e.projection)!
    expect(block.projection).toEqual({ ruleId: block.id, display: 'time_only' })
    expect(block.visibility.busyLabel).toBe('')
    expect(JSON.stringify(payload)).not.toContain('"rp"')
  })
})

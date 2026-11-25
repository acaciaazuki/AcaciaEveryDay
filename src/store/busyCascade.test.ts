import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { visibleCalendar } from '../core/calendarView'
import { emptyAppData } from '../core/schema'
import { PERSONAL_CALENDAR_ID } from '../core/sharing'
import { buildSpaceSyncPayload } from '../core/syncEnvelope'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useSpacesStore } = await import('./useSpacesStore')
const { useAppStore } = await import('./useAppStore')
const { mirrorPersonalBusyNow } = await import('./personalBusyMirror')

const sp = () => useSpacesStore.getState()
const app = () => useAppStore.getState()
/** 自己在目標空間看到的忙碌區塊 */
const blocks = (spaceId: string) => visibleCalendar(sp().data, sp().selfId, sp().selfId, spaceId).shared.filter((e) => e.projected)
/** 目標空間另一位成員收到的同步內容（只有忙碌區塊；墓碑不帶投射標記，用區塊 id 辨認） */
const sentTo = (spaceId: string, viewerId: string) =>
  buildSpaceSyncPayload({ data: sp().data, spaceId, viewerId, now: Date.now() })!.entries.filter((e) => e.id.startsWith('busy-'))

describe('忙碌投射的連帶更新（邊界情況）', () => {
  let source: string
  let target: string
  let mom: string
  beforeEach(() => {
    sp().reset()
    useAppStore.setState(emptyAppData())
    source = sp().createSpace({ name: '開刀房', kind: 'work' })
    target = sp().createSpace({ name: '陳家', kind: 'family' })
    mom = sp().addMember(target, { displayName: '媽媽', role: 'viewer' })
  })

  describe('來源是共享空間', () => {
    let id: string
    beforeEach(() => {
      id = sp().addItem(source, { kind: 'event', title: '刀', dateISO: '2026-11-25', start: '09:00', end: '10:00' })
      sp().addRule({ sourceId: source, targetMode: 'selected', targetIds: [target] })
    })

    it('改時間：區塊同一個 id、時間跟著改，送給成員的版本變高（對方會換成新的）', () => {
      const [before] = sentTo(target, mom)
      sp().updateItem(id, { start: '13:00', end: '15:00' })
      expect(blocks(target).map((b) => [b.start, b.end])).toEqual([['13:00', '15:00']])
      const [after] = sentTo(target, mom)
      expect(after!.id).toBe(before!.id)
      expect(after!.version).toBeGreaterThan(before!.version)
      expect(after).toMatchObject({ start: '13:00', end: '15:00', title: '' })
    })

    it('移動日期：區塊移到新的日期，舊日期不殘留', () => {
      sp().updateItem(id, { dateISO: '2026-11-28' })
      expect(blocks(target).map((b) => b.dateISO)).toEqual(['2026-11-28'])
      expect(sentTo(target, mom).map((e) => e.dateISO)).toEqual(['2026-11-28'])
    })

    it('跨日改成單日：區塊的結束日一起清掉', () => {
      sp().updateItem(id, { endDateISO: '2026-11-27' })
      expect(sentTo(target, mom)[0]!.endDateISO).toBe('2026-11-27')
      sp().updateItem(id, { endDateISO: '' })
      expect(sentTo(target, mom)[0]!.endDateISO).toBe('')
      expect(blocks(target)[0]!.lastDateISO).toBe('2026-11-25')
    })

    it('刪除：自己畫面上立刻消失；送給成員的是墓碑（版本更高、不帶時間以外的內容），對方會移除', () => {
      const [before] = sentTo(target, mom)
      sp().removeItem(id)
      expect(blocks(target)).toEqual([])
      const [tomb] = sentTo(target, mom)
      expect(tomb).toMatchObject({ id: before!.id, deletedAt: expect.any(Number), title: '' })
      expect(tomb!.version).toBeGreaterThan(before!.version)
    })
  })

  describe('來源是我的行事曆', () => {
    beforeEach(() => {
      app().addEvent({ title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' })
      sp().addRule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: [target] })
      mirrorPersonalBusyNow()
    })

    it('改時間與移動日期：區塊跟著更新，版本變高', () => {
      const id = app().events[0]!.id
      const [before] = sentTo(target, mom)
      app().updateEvent(id, { start: '16:00', end: '17:30', dateISO: '2026-11-26' })
      mirrorPersonalBusyNow()
      expect(blocks(target).map((b) => [b.dateISO, b.start, b.end])).toEqual([['2026-11-26', '16:00', '17:30']])
      const [after] = sentTo(target, mom)
      expect(after!.id).toBe(before!.id)
      expect(after!.version).toBeGreaterThan(before!.version)
    })

    it('只改標題或備註：區塊不變、不會多送一次', () => {
      const [before] = sentTo(target, mom)
      app().updateEvent(app().events[0]!.id, { title: '洗牙', note: '帶健保卡' })
      mirrorPersonalBusyNow()
      expect(sentTo(target, mom)).toEqual([before])
    })

    it('刪除：送給成員的是墓碑；還原後版本再提高，區塊回來', () => {
      const event = app().events[0]!
      app().removeEvent(event.id)
      mirrorPersonalBusyNow()
      const [tomb] = sentTo(target, mom)
      expect(tomb!.deletedAt).not.toBeNull()
      app().restoreEvents([event])
      mirrorPersonalBusyNow()
      const [back] = sentTo(target, mom)
      expect(back!.deletedAt).toBeNull()
      expect(back!.version).toBeGreaterThan(tomb!.version)
    })
  })
})

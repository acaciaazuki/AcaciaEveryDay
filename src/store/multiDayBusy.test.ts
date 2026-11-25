import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sharedOn, visibleCalendar } from '../core/calendarView'
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
/** 媽媽在「陳家」看到的忙碌區塊 */
const momSees = (target: string, mom: string, iso: string) => sharedOn(visibleCalendar(sp().data, sp().selfId, mom, target).shared, iso)

describe('跨日的個人行程投射成忙碌區塊', () => {
  let target: string
  let mom: string
  beforeEach(() => {
    sp().reset()
    useAppStore.setState(emptyAppData())
    target = sp().createSpace({ name: '陳家', kind: 'family' })
    mom = sp().addMember(target, { displayName: '媽媽', role: 'viewer' })
    sp().addRule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: [target], includeAllDay: true })
  })

  it('大夜班（跨午夜）：兩天都看得到忙碌區塊，同步給成員的區塊帶結束日', () => {
    app().addEvent({ title: '大夜班', dateISO: '2026-12-10', endDateISO: '2026-12-11', start: '22:30', end: '02:00', note: '' })
    mirrorPersonalBusyNow()
    expect(sp().data.personalBusySlots[0]).toMatchObject({ dateISO: '2026-12-10', endDateISO: '2026-12-11' })
    for (const d of ['2026-12-10', '2026-12-11']) expect(momSees(target, mom, d)).toHaveLength(1)
    expect(momSees(target, mom, '2026-12-12')).toHaveLength(0)
    const [block] = buildSpaceSyncPayload({ data: sp().data, spaceId: target, viewerId: mom, now: Date.now() })!.entries
    expect(block).toMatchObject({ dateISO: '2026-12-10', endDateISO: '2026-12-11', start: '22:30', end: '02:00', title: '' })
  })

  it('家庭旅遊（連續跨日）改成單日：影子版本提高，區塊只剩一天', () => {
    app().addEvent({ title: '家庭旅遊', dateISO: '2026-12-20', endDateISO: '2026-12-22', start: '', end: '', note: '' })
    mirrorPersonalBusyNow()
    expect(['2026-12-20', '2026-12-21', '2026-12-22'].map((d) => momSees(target, mom, d).length)).toEqual([1, 1, 1])
    const before = sp().data.personalBusySlots[0]!.version

    app().updateEvent(app().events[0]!.id, { endDateISO: '' })
    mirrorPersonalBusyNow()
    expect(sp().data.personalBusySlots[0]!.version).toBeGreaterThan(before)
    expect(['2026-12-20', '2026-12-21', '2026-12-22'].map((d) => momSees(target, mom, d).length)).toEqual([1, 0, 0])
  })
})

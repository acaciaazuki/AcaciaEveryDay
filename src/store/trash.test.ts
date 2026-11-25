import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { visibleCalendar } from '../core/calendarView'
import { emptyAppData } from '../core/schema'
import { PERSONAL_CALENDAR_ID } from '../core/sharing'
import { liveEvents, TRASH_RETENTION_MS } from '../core/trash'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useSpacesStore } = await import('./useSpacesStore')
const { useAppStore } = await import('./useAppStore')
const { mirrorPersonalBusyNow } = await import('./personalBusyMirror')
const { purgeTrashNow } = await import('./trashPurge')

const sp = () => useSpacesStore.getState()
const app = () => useAppStore.getState()
/** 目標空間裡，自己看得到的忙碌投射區塊 */
const blocksIn = (spaceId: string) => visibleCalendar(sp().data, sp().selfId, sp().selfId, spaceId).shared.filter((e) => e.projected)

describe('最近刪除與忙碌投射的連動', () => {
  let family: string
  let work: string
  beforeEach(() => {
    sp().reset()
    useAppStore.setState(emptyAppData())
    family = sp().createSpace({ name: '家', kind: 'family' })
    work = sp().createSpace({ name: '公司', kind: 'work' })
  })

  it('共享空間的來源行程刪除後，目標空間的忙碌區塊立刻消失；還原後自動恢復', () => {
    const id = sp().addItem(family, { kind: 'event', title: '回診', dateISO: '2026-11-25', start: '09:00', end: '10:00' })
    sp().addRule({ sourceId: family, targetMode: 'selected', targetIds: [work] })
    expect(blocksIn(work)).toHaveLength(1)

    sp().removeItem(id)
    expect(blocksIn(work)).toHaveLength(0)
    // 刪除者記在 updatedBy
    expect(sp().data.items.find((i) => i.id === id)).toMatchObject({ updatedBy: sp().selfId, deletedAt: expect.any(Number) })

    sp().restoreItem(id)
    expect(blocksIn(work)).toHaveLength(1)
  })

  it('我的行事曆的行程刪除後，忙碌影子標記刪除、投射區塊消失；還原後恢復', () => {
    app().addEvent({ title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' })
    const event = app().events[0]!
    sp().addRule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'selected', targetIds: [work] })
    mirrorPersonalBusyNow()
    expect(blocksIn(work)).toHaveLength(1)

    app().removeEvent(event.id)
    mirrorPersonalBusyNow()
    expect(liveEvents(app().events)).toHaveLength(0)
    expect(blocksIn(work)).toHaveLength(0)

    app().restoreEvents([event])
    mirrorPersonalBusyNow()
    expect(liveEvents(app().events)).toHaveLength(1)
    expect(blocksIn(work)).toHaveLength(1)
  })

  it('永久刪除：個人行程從清單移除；共享行程只留沒有內容的墓碑，也不能再還原成空白行程', () => {
    app().addEvent({ title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' })
    app().discardEvents([app().events[0]!.id])
    expect(app().events).toEqual([])

    const id = sp().addItem(family, { kind: 'event', title: '回診', dateISO: '2026-11-25', start: '09:00', end: '10:00' })
    sp().removeItem(id)
    sp().discardItem(id)
    const tomb = sp().data.items.find((i) => i.id === id)!
    expect(tomb).toMatchObject({ title: '', deletedAt: expect.any(Number) })
    sp().restoreItem(id)
    expect(sp().data.items.find((i) => i.id === id)!.deletedAt).not.toBeNull()
  })

  it('自動清理：刪除滿 30 天的個人行程移除、共享行程清成墓碑；未滿的保留', () => {
    const now = Date.now()
    useAppStore.setState({
      events: [
        { id: 'old', title: '舊', dateISO: '2026-10-01', start: '', end: '', note: '', deletedAt: now - TRASH_RETENTION_MS },
        { id: 'new', title: '新', dateISO: '2026-11-01', start: '', end: '', note: '', deletedAt: now - 1000 },
      ],
    })
    const id = sp().addItem(family, { kind: 'event', title: '回診', dateISO: '2026-11-25', start: '09:00', end: '10:00' })
    sp().removeItem(id)
    // 以實際的刪除時間計算「滿 30 天」：刪除時才取時間，跟上面的 now 可能差幾毫秒（CI 機器較慢時）
    const deletedAt = sp().data.items.find((i) => i.id === id)!.deletedAt!
    purgeTrashNow(deletedAt + TRASH_RETENTION_MS)
    expect(app().events).toEqual([])
    expect(sp().data.items.find((i) => i.id === id)!.title).toBe('')

    // 沒有過期的：不寫入
    const before = sp().data
    purgeTrashNow(now)
    expect(sp().data).toBe(before)
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'
import { liveEvents, TRASH_RETENTION_MS } from '../core/trash'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useAppStore } = await import('./useAppStore')
const { purgeTrashNow } = await import('./trashPurge')

const app = () => useAppStore.getState()

describe('最近刪除（個人行程）', () => {
  beforeEach(() => useAppStore.setState(emptyAppData()))

  it('刪除：移到最近刪除（畫面看不到），還原後回來', () => {
    app().addEvent({ title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' })
    const event = app().events[0]!
    app().removeEvent(event.id)
    expect(app().events[0]!.deletedAt).toEqual(expect.any(Number))
    expect(liveEvents(app().events)).toEqual([])
    app().restoreEvents([event])
    expect(app().events[0]!.deletedAt).toBeUndefined()
    expect(liveEvents(app().events)).toHaveLength(1)
  })

  it('永久刪除：直接從清單移除', () => {
    app().addEvent({ title: '牙醫', dateISO: '2026-11-25', start: '14:00', end: '15:00', note: '' })
    app().discardEvents([app().events[0]!.id])
    expect(app().events).toEqual([])
  })

  it('自動清理：刪除滿 30 天的移除，未滿的保留；沒有過期的不寫入', () => {
    const now = Date.now()
    useAppStore.setState({
      events: [
        { id: 'old', title: '舊', dateISO: '2026-10-01', start: '', end: '', note: '', deletedAt: now - TRASH_RETENTION_MS },
        { id: 'new', title: '新', dateISO: '2026-11-01', start: '', end: '', note: '', deletedAt: now - 1000 },
      ],
    })
    purgeTrashNow(now)
    expect(app().events.map((e) => e.id)).toEqual(['new'])
    const before = app().events
    purgeTrashNow(now)
    expect(app().events).toBe(before)
  })
})

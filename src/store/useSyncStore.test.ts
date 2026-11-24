import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const files: Record<string, unknown> = {}
const uploads: { id: string | null; name: string; data: unknown }[] = []
vi.mock('../adapters/drive', () => ({
  DRIVE_FILE: 'acacia_data_v2.json',
  LEGACY_DRIVE_FILE: 'acacia_data.json',
  SPACES_DRIVE_FILE: 'acacia_spaces_v1.json',
  findFile: async (_t: string, name: string) => (name in files ? name : null),
  download: async (_t: string, id: string) => files[id],
  upload: async (_t: string, id: string | null, name: string, data: unknown) => {
    uploads.push({ id, name, data })
    files[name] = data
    return name
  },
}))

const { useAppStore } = await import('./useAppStore')
const { useSyncStore } = await import('./useSyncStore')

describe('Drive 同步', () => {
  beforeEach(() => {
    for (const k of Object.keys(files)) delete files[k]
    uploads.length = 0
    useAppStore.setState(emptyAppData())
    useSyncStore.setState({ status: 'signedOut', token: null, fileId: null, profile: null })
  })

  it('第一次登入讀取舊版雲端檔並轉換，另存成 v2 檔，不動舊檔', async () => {
    files['acacia_data.json'] = { events: [], tasks: [{ id: 1, title: '舊待辦', done: false }], shopping: [{ id: 2, title: '牛奶', amt: 50, cat: '食' }], places: [], favorites: [], updatedAt: 100 }
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useAppStore.getState().tasks[0].title).toBe('舊待辦')
    expect(useAppStore.getState().shopping[0].cat).toBe('food')
    expect(uploads.map((u) => u.name)).toEqual(['acacia_data_v2.json'])
    expect((files['acacia_data.json'] as { shopping: { cat: string }[] }).shopping[0].cat).toBe('食')
  })

  it('本機較新時上傳本機資料', async () => {
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [{ id: 'c', title: '雲端', loc: '', date: '', time: '', done: false }] }
    useAppStore.setState({ updatedAt: 200, tasks: [{ id: 'l', title: '本機', loc: '', date: '', time: '', done: false }] })
    await useSyncStore.getState().connect(true)
    expect(useAppStore.getState().tasks[0].title).toBe('本機')
    expect((files['acacia_data_v2.json'] as { tasks: { title: string }[] }).tasks[0].title).toBe('本機')
  })

  it('登入後修改資料會自動上傳', async () => {
    vi.useFakeTimers()
    await useSyncStore.getState().connect(true)
    uploads.length = 0
    useAppStore.getState().addTask({ title: '新的', loc: '', date: '', time: '' })
    await vi.advanceTimersByTimeAsync(1300)
    expect(uploads).toHaveLength(1)
    vi.useRealTimers()
  })
})

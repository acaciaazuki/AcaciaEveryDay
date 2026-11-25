import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'

const auth = vi.hoisted(() => ({
  MissingDriveScopeError: class extends Error {},
  signIn: vi.fn(async (_o?: { consent?: boolean }) => ({ token: 'tok', expiresAt: Date.now() + 3600_000 })),
  clearStoredToken: vi.fn(),
}))
vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: auth.signIn,
  signOut: async () => {},
  clearStoredToken: auth.clearStoredToken,
  MissingDriveScopeError: auth.MissingDriveScopeError,
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const files: Record<string, unknown> = {}
const uploads: { id: string | null; name: string; data: unknown }[] = []
/** 設成 true 時，Drive 回應 403 權限不足（模擬登入時漏勾 Google 雲端硬碟權限） */
let forbidden = false
vi.mock('../adapters/drive', async (importActual) => ({
  ...(await importActual<typeof import('../adapters/drive')>()),
  findFile: async (_t: string, name: string) => {
    if (forbidden) {
      const { DriveError } = await importActual<typeof import('../adapters/drive')>()
      throw new DriveError('Drive 403', 403, ['insufficientPermissions'])
    }
    return name in files ? name : null
  },
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
    forbidden = false
    auth.signIn.mockClear()
    auth.clearStoredToken.mockClear()
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

  it('登入時逐筆合併：本機與雲端各自的待辦都保留，合併結果上傳（不再整份覆蓋）', async () => {
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [{ id: 'c', title: '雲端', loc: '', date: '', time: '', done: false }] }
    useAppStore.setState({ updatedAt: 200, tasks: [{ id: 'l', title: '本機', loc: '', date: '', time: '', done: false }] })
    await useSyncStore.getState().connect(true)
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['本機', '雲端'])
    expect((files['acacia_data_v2.json'] as { tasks: { title: string }[] }).tasks.map((x) => x.title)).toEqual(['本機', '雲端'])
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

  it('Drive 回應 403 權限不足時改為「尚未授權」，丟掉舊 token，不會一直重送', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    forbidden = true
    await useSyncStore.getState().connect(true)
    const s = useSyncStore.getState()
    expect(s.status).toBe('needsPermission')
    expect(s.token).toBeNull()
    expect(s.profile).toEqual({ name: 'QQ' })
    expect(auth.clearStoredToken).toHaveBeenCalled()
  })

  it('重新授權會強制跳出權限勾選畫面（prompt: consent），授權後同步成功', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    forbidden = true
    await useSyncStore.getState().connect(true)
    expect(auth.signIn).toHaveBeenLastCalledWith({ consent: false })
    forbidden = false
    await useSyncStore.getState().reauthorize()
    expect(auth.signIn).toHaveBeenLastCalledWith({ consent: true })
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useSyncStore.getState().token).toBe('tok')
  })

  it('重新授權時使用者關掉視窗，維持「尚未授權」提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    forbidden = true
    await useSyncStore.getState().connect(true)
    auth.signIn.mockRejectedValueOnce(new Error('popup_closed'))
    await useSyncStore.getState().reauthorize()
    expect(useSyncStore.getState().status).toBe('needsPermission')
  })

  it('登入時漏勾 Google 雲端硬碟權限：直接標示「尚未授權」，不進入同步流程', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    auth.signIn.mockRejectedValueOnce(new auth.MissingDriveScopeError())
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('needsPermission')
    expect(useSyncStore.getState().token).toBeNull()
    expect(uploads).toHaveLength(0)
  })
})

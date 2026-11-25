import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAppData } from '../core/schema'

const auth = vi.hoisted(() => ({
  MissingDriveScopeError: class extends Error {},
  signIn: vi.fn(async (_o?: { consent?: boolean }) => ({ token: 'tok', expiresAt: Date.now() + 3600_000 })),
  clearStoredToken: vi.fn(),
  /** fetchProfile 回傳的帳號；sub 不同代表登入了不同的 Google 帳號 */
  profile: { name: 'QQ', sub: 'account-a' } as { name: string; sub?: string },
}))
vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: auth.signIn,
  signOut: async () => {},
  clearStoredToken: auth.clearStoredToken,
  MissingDriveScopeError: auth.MissingDriveScopeError,
  fetchProfile: async () => ({ ...auth.profile }),
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
const { useBackupStore } = await import('./useBackupStore')
const { kv } = await import('../adapters/kv')
const { accountKey, loadBoundAccount, saveBoundAccount } = await import('../adapters/syncAccount')

const task = (id: string, title: string) => ({ id, title, loc: '', date: '', time: '', done: false })

describe('Drive 同步', () => {
  beforeEach(async () => {
    for (const k of Object.keys(files)) delete files[k]
    uploads.length = 0
    forbidden = false
    auth.signIn.mockClear()
    auth.clearStoredToken.mockClear()
    auth.profile = { name: 'QQ', sub: 'account-a' }
    await kv('state').del('acacia-sync-account')
    useAppStore.setState({ ...emptyAppData(), syncMeta: undefined })
    useSyncStore.setState({ status: 'signedOut', token: null, fileId: null, profile: null, accountSwitch: null })
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
    // 登入會讀寫 IndexedDB，等登入完成才換成假計時器
    await useSyncStore.getState().connect(true)
    vi.useFakeTimers()
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
    expect(s.profile).toMatchObject({ name: 'QQ' })
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

describe('同一個瀏覽器切換不同 Google 帳號', () => {
  beforeEach(async () => {
    for (const k of Object.keys(files)) delete files[k]
    uploads.length = 0
    forbidden = false
    auth.profile = { name: 'B 帳號', sub: 'account-b' }
    await kv('state').del('acacia-sync-account')
    useAppStore.setState({ ...emptyAppData(), syncMeta: undefined })
    useSyncStore.setState({ status: 'signedOut', token: null, fileId: null, profile: null, accountSwitch: null })
  })

  /** 這台裝置上次同步的是 A 帳號，本機還留著 A 的資料 */
  async function leftoverFromA() {
    await saveBoundAccount(await accountKey('account-a'))
    useAppStore.setState({ updatedAt: 200, tasks: [task('a1', 'A 的待辦')] })
  }

  it('第一次登入（從沒綁定過帳號）：照常自動合併，並記下綁定的帳號', async () => {
    useAppStore.setState({ updatedAt: 200, tasks: [task('l', '本機')] })
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('synced')
    expect(uploads).toHaveLength(1)
    expect(await loadBoundAccount()).toBe(await accountKey('account-b'))
  })

  it('登入回同一個帳號：不詢問，照常自動合併', async () => {
    await leftoverFromA()
    auth.profile = { name: 'A 帳號', sub: 'account-a' }
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('c', '雲端')] }
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['A 的待辦', '雲端'])
  })

  it('登入不同帳號且本機有資料：不自動合併上傳，改為等待確認', async () => {
    await leftoverFromA()
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('b1', 'B 的待辦')] }
    await useSyncStore.getState().connect(true)
    const s = useSyncStore.getState()
    expect(s.status).toBe('confirmAccount')
    expect(s.accountSwitch).toEqual({ name: 'B 帳號' })
    // 等待確認期間不拿 token 同步，本機與雲端都不動
    expect(s.token).toBeNull()
    expect(uploads).toHaveLength(0)
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['A 的待辦'])
    expect(await loadBoundAccount()).toBe(await accountKey('account-a'))
  })

  it('選擇切換帳號：先留本機快照，清空本機後改用新帳號的雲端資料，不把舊資料上傳', async () => {
    await leftoverFromA()
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('b1', 'B 的待辦')] }
    await useSyncStore.getState().connect(true)
    await useSyncStore.getState().resolveAccountSwitch('switch')
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['B 的待辦'])
    expect(uploads).toHaveLength(0)
    expect((files['acacia_data_v2.json'] as { tasks: { title: string }[] }).tasks.map((x) => x.title)).toEqual(['B 的待辦'])
    const snap = useBackupStore.getState().snapshots[0]
    expect(snap.reason).toBe('beforeAccountSwitch')
    expect(snap.counts.tasks).toBe(1)
    expect(await loadBoundAccount()).toBe(await accountKey('account-b'))
  })

  it('選擇切換帳號、新帳號雲端還沒有檔案：本機變成全新空白狀態', async () => {
    await leftoverFromA()
    await useSyncStore.getState().connect(true)
    await useSyncStore.getState().resolveAccountSwitch('switch')
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useAppStore.getState().tasks).toEqual([])
    expect(uploads.flatMap((u) => (u.data as { tasks: unknown[] }).tasks)).toEqual([])
  })

  it('選擇合併：才走原本的合併上傳流程', async () => {
    await leftoverFromA()
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('b1', 'B 的待辦')] }
    await useSyncStore.getState().connect(true)
    await useSyncStore.getState().resolveAccountSwitch('merge')
    expect(useSyncStore.getState().status).toBe('synced')
    expect((files['acacia_data_v2.json'] as { tasks: { title: string }[] }).tasks.map((x) => x.title).sort()).toEqual(['A 的待辦', 'B 的待辦'])
    expect(await loadBoundAccount()).toBe(await accountKey('account-b'))
  })

  it('取消：中止登入，本機、雲端與綁定紀錄都不動', async () => {
    await leftoverFromA()
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('b1', 'B 的待辦')] }
    await useSyncStore.getState().connect(true)
    await useSyncStore.getState().resolveAccountSwitch('cancel')
    const s = useSyncStore.getState()
    expect(s.status).toBe('signedOut')
    expect(s.token).toBeNull()
    expect(s.accountSwitch).toBeNull()
    expect(uploads).toHaveLength(0)
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['A 的待辦'])
    expect(await loadBoundAccount()).toBe(await accountKey('account-a'))
  })

  it('登入不同帳號但本機沒有資料：不需詢問，直接載入新帳號', async () => {
    await saveBoundAccount(await accountKey('account-a'))
    files['acacia_data_v2.json'] = { ...emptyAppData(), updatedAt: 100, tasks: [task('b1', 'B 的待辦')] }
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('synced')
    expect(useAppStore.getState().tasks.map((x) => x.title)).toEqual(['B 的待辦'])
  })

  it('登出後保留綁定紀錄，下次登入別的帳號仍會詢問', async () => {
    useAppStore.setState({ updatedAt: 200, tasks: [task('a1', 'A 的待辦')] })
    auth.profile = { name: 'A 帳號', sub: 'account-a' }
    await useSyncStore.getState().connect(true)
    await useSyncStore.getState().disconnect()
    expect(await loadBoundAccount()).toBe(await accountKey('account-a'))
    auth.profile = { name: 'B 帳號', sub: 'account-b' }
    await useSyncStore.getState().connect(true)
    expect(useSyncStore.getState().status).toBe('confirmAccount')
  })
})

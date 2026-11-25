import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_INTERVAL_MS } from '../core/backup'
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
  BACKUP_DRIVE_FILE: 'acacia_backup_v2.json',
  findFile: async (_t: string, name: string) => (name in files ? name : null),
  download: async (_t: string, id: string) => files[id],
  upload: async (_t: string, id: string | null, name: string, data: unknown) => {
    uploads.push({ id, name, data })
    files[name] = data
    return name
  },
  deleteFile: async (_t: string, id: string) => {
    delete files[id]
  },
}))

const { useAppStore } = await import('./useAppStore')
const { useSyncStore } = await import('./useSyncStore')
const { useBackupStore } = await import('./useBackupStore')
const { deleteAllData } = await import('./deleteAllData')
const storage = await import('../adapters/backupStorage')
const { useConsentStore } = await import('./useConsentStore')
const { kv } = await import('../adapters/kv')

const task = (title: string) => ({ title, loc: '', date: '', time: '' })

describe('自動備份', () => {
  beforeEach(async () => {
    for (const k of Object.keys(files)) delete files[k]
    uploads.length = 0
    await storage.clearBackups()
    useBackupStore.setState({ ready: false })
    useBackupStore.getState().reset()
    useBackupStore.setState({ ready: false })
    useAppStore.setState(emptyAppData())
    useSyncStore.setState({ status: 'signedOut', token: null, fileId: null, profile: null })
  })

  it('有資料時建立快照存進 IndexedDB，12 小時內不再自動備份', async () => {
    useAppStore.getState().addTask(task('買牛奶'))
    const t0 = Date.now()
    const first = await useBackupStore.getState().runAuto(t0)
    expect(first?.reason).toBe('auto')
    expect(first?.counts.tasks).toBe(1)
    expect(useBackupStore.getState().lastAt).toBe(t0)
    expect((await storage.loadSnapshotData(first!.id))?.tasks[0].title).toBe('買牛奶')
    // 重新從 IndexedDB 讀取也拿得到
    expect((await storage.loadIndex()).snapshots.map((s) => s.id)).toEqual([first!.id])

    useAppStore.getState().addTask(task('倒垃圾'))
    expect(await useBackupStore.getState().runAuto(t0 + BACKUP_INTERVAL_MS - 1)).toBeNull()
    const second = await useBackupStore.getState().runAuto(t0 + BACKUP_INTERVAL_MS)
    expect(second?.counts.tasks).toBe(2)
    expect(useBackupStore.getState().snapshots).toHaveLength(2)
  })

  it('沒有資料或關閉自動備份時不備份', async () => {
    expect(await useBackupStore.getState().runAuto()).toBeNull()
    await useBackupStore.getState().setEnabled(false)
    useAppStore.getState().addTask(task('x'))
    expect(await useBackupStore.getState().runAuto()).toBeNull()
    expect((await storage.loadIndex()).enabled).toBe(false)
  })

  it('最多保留 7 份，舊快照的資料一起刪掉', async () => {
    const ids: string[] = []
    for (let i = 0; i < 9; i++) {
      useAppStore.getState().addTask(task(`t${i}`))
      useAppStore.setState({ updatedAt: i + 1 })
      ids.push((await useBackupStore.getState().backupNow('manual'))!.id)
    }
    expect(useBackupStore.getState().snapshots).toHaveLength(7)
    expect(await storage.loadSnapshotData(ids[0])).toBeUndefined()
    expect(await storage.loadSnapshotData(ids[1])).toBeUndefined()
    expect(await storage.loadSnapshotData(ids[2])).toBeDefined()
  })

  it('已登入時推到 Drive 備份槽，不覆蓋同步檔', async () => {
    files['acacia_data_v2.json'] = { keep: true }
    useSyncStore.setState({ token: 'tok', status: 'synced' })
    useAppStore.getState().addTask(task('雲端'))
    await useBackupStore.getState().backupNow('manual')
    await vi.waitFor(() => expect(useBackupStore.getState().cloudStatus).toBe('ok'))
    const backup = uploads.find((u) => u.name === 'acacia_backup_v2.json')?.data as { kind: string; data: { tasks: { title: string }[] } }
    expect(backup.kind).toBe('acacia-backup')
    expect(backup.data.tasks[0].title).toBe('雲端')
    expect(files['acacia_data_v2.json']).toEqual({ keep: true })
  })

  it('還原前先替目前資料留一份快照，還原後 updatedAt 是現在', async () => {
    useAppStore.getState().addTask(task('昨天的'))
    const snap = (await useBackupStore.getState().backupNow('auto'))!
    useAppStore.setState({ tasks: [], updatedAt: snap.dataUpdatedAt + 1 }) // 誤刪
    const before = Date.now()
    await useBackupStore.getState().restore(snap.id)
    expect(useAppStore.getState().tasks.map((t) => t.title)).toEqual(['昨天的'])
    expect(useAppStore.getState().updatedAt).toBeGreaterThanOrEqual(before)
    const [latest] = useBackupStore.getState().snapshots
    expect(latest.reason).toBe('beforeRestore')
    expect(latest.counts.tasks).toBe(0)
  })

  it('快照損毀時不動目前資料', async () => {
    useAppStore.getState().addTask(task('現在的'))
    const snap = (await useBackupStore.getState().backupNow('manual'))!
    await storage.saveSnapshotData(snap.id, { schemaVersion: 99 } as never)
    await expect(useBackupStore.getState().restore(snap.id)).rejects.toThrow()
    expect(useAppStore.getState().tasks[0].title).toBe('現在的')
  })
})

describe('刪除所有資料', () => {
  beforeEach(async () => {
    for (const k of Object.keys(files)) delete files[k]
    await storage.clearBackups()
    useBackupStore.getState().reset()
    useAppStore.setState(emptyAppData())
  })

  it('已登入：刪除 Drive 上的同步檔、備份檔、共享行事曆檔與舊版檔，登出並清空本機與快照', async () => {
    files['acacia_data_v2.json'] = {}
    files['acacia_backup_v2.json'] = {}
    files['acacia_spaces_v1.json'] = {}
    files['acacia_data.json'] = {}
    files['other.json'] = {}
    localStorage.setItem('acacia_lang', 'ja')
    localStorage.setItem('unrelated', '1')
    useSyncStore.setState({ token: 'tok', status: 'synced' })
    useAppStore.getState().addTask(task('秘密'))
    await useBackupStore.getState().backupNow('manual')
    await useConsentStore.getState().accept()
    // 舊版共享行事曆留在本機的資料與快照
    await kv('state').set('acacia-spaces', '{"state":{}}')
    await kv('spacesBackups').set('index', { snapshots: [] })

    const r = await deleteAllData()
    expect(r.cloud).toBe(true)
    expect(Object.keys(files)).toEqual(['other.json'])
    expect(useSyncStore.getState().token).toBeNull()
    expect(useAppStore.getState().tasks).toEqual([])
    expect(useAppStore.getState().updatedAt).toBe(0)
    expect(useBackupStore.getState().snapshots).toEqual([])
    expect((await storage.loadIndex()).snapshots).toEqual([])
    expect(localStorage.getItem('acacia_lang')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('1')
    expect(await kv('state').get('acacia-spaces')).toBeUndefined()
    expect(await kv('spacesBackups').keys()).toEqual([])
    // 同意紀錄也清掉，回到第一次使用的狀態
    expect(useConsentStore.getState().status).toBe('required')
    await useConsentStore.getState().load()
    expect(useConsentStore.getState().record).toBeNull()
  })

  it('未登入：只清本機', async () => {
    files['acacia_data_v2.json'] = {}
    useSyncStore.setState({ token: null, status: 'signedOut' })
    useAppStore.getState().addTask(task('本機'))
    files['acacia_spaces_v1.json'] = {}
    const r = await deleteAllData()
    expect(r.cloud).toBe(false)
    expect(files).toHaveProperty('acacia_data_v2.json')
    expect(files).toHaveProperty('acacia_spaces_v1.json')
    expect(useAppStore.getState().tasks).toEqual([])
  })
})

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDriveSyncProvider, type DriveSpacesFile } from '../adapters/sync/driveSyncProvider'
import { DriveError } from '../adapters/drive'
import { createSpace, emptySharedCalendarData, type SharedCalendarData } from '../core/sharing'
import { fakeDrive } from '../test/fakeDrive'
import { makeItem, T0 } from '../test/sharingFixtures'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useSpacesStore } = await import('./useSpacesStore')
const { useSpacesSyncStore, setSpacesSyncProvider, startSpacesSync } = await import('./useSpacesSyncStore')
const { useSyncStore } = await import('./useSyncStore')

const SPACES = 'acacia_spaces_v1.json'
let drive = fakeDrive()
let online = true

/** 一台裝置的本機狀態（模擬兩台裝置輪流使用同一個 store） */
interface Device {
  selfId: string
  data: SharedCalendarData
  cloudSync: boolean
}
const save = (): Device => {
  const s = useSpacesStore.getState()
  return { selfId: s.selfId, data: s.data, cloudSync: s.cloudSync }
}
const use = (d: Device) => useSpacesStore.setState({ ...d, viewerId: d.selfId, filter: 'all' })

function newDevice(selfId: string, spaceName: string, title: string): Device {
  const space = createSpace({ id: `sp-${selfId}`, name: spaceName, kind: 'family', ownerId: selfId, now: T0 })
  const item = makeItem({ id: `it-${selfId}`, spaceId: space.id, createdBy: selfId, title, updatedBy: selfId })
  return { selfId, cloudSync: false, data: { ...emptySharedCalendarData(selfId), spaces: [space], items: [item], updatedAt: T0 } }
}
const file = () => drive.files[SPACES] as DriveSpacesFile | undefined
const titlesIn = (f: DriveSpacesFile | undefined) => (f?.payloads ?? []).flatMap((p) => p.entries.filter((e) => e.deletedAt === null).map((e) => e.title)).sort()
const localTitles = () => useSpacesStore.getState().data.items.filter((i) => i.deletedAt === null).map((i) => i.title).sort()

describe('共享空間的 Drive 同步', () => {
  beforeEach(() => {
    drive = fakeDrive({ 'acacia_data_v2.json': { keep: 'main' }, 'acacia_backup_v2.json': { keep: 'backup' } })
    online = true
    setSpacesSyncProvider(createDriveSyncProvider({ getToken: () => useSyncStore.getState().token, drive: drive.api, isOnline: () => online }))
    useSyncStore.setState({ token: 'tok', status: 'synced' })
    useSpacesSyncStore.setState({ state: 'idle', lastSyncedAt: null, error: null, conflicts: [] })
    use(newDevice('local-a', '陳家', '週日聚餐'))
  })

  it('沒開啟同步或沒登入時，不讀寫雲端', async () => {
    await useSpacesSyncStore.getState().syncNow()
    expect(drive.uploads).toEqual([])
    useSpacesStore.getState().setCloudSync(true)
    useSyncStore.setState({ token: null })
    await useSpacesSyncStore.getState().syncNow()
    expect(file()).toBeUndefined()
  })

  it('開啟同步：只建立 acacia_spaces_v1.json，主資料同步檔與備份檔不動，內容不含同意紀錄', async () => {
    await useSpacesSyncStore.getState().enable()
    expect(useSpacesSyncStore.getState()).toMatchObject({ state: 'idle', error: null })
    expect(useSpacesSyncStore.getState().lastSyncedAt).not.toBeNull()
    expect(drive.uploads.map((u) => u.name)).toEqual([SPACES])
    expect(drive.files['acacia_data_v2.json']).toEqual({ keep: 'main' })
    expect(drive.files['acacia_backup_v2.json']).toEqual({ keep: 'backup' })
    expect(file()!.ownerId).toBe('local-a')
    expect(titlesIn(file())).toEqual(['週日聚餐'])
    expect(JSON.stringify(file())).not.toContain('acacia-consent')
  })

  it('第二台裝置開啟同步：改用雲端檔案的身分，兩台的資料合併，之後雙向同步', async () => {
    await useSpacesSyncStore.getState().enable()
    const a = save()

    // 裝置 B：自己有一份資料、不同的 local id
    use(newDevice('local-b', '設計部', '專案會議'))
    await useSpacesSyncStore.getState().enable()
    const b = save()
    expect(b.selfId).toBe('local-a')
    expect(JSON.stringify(b.data)).not.toContain('"local-b"')
    expect(localTitles()).toEqual(['專案會議', '週日聚餐'])
    expect(titlesIn(file())).toEqual(['專案會議', '週日聚餐'])

    // B 修改、A 同步後拿到
    useSpacesStore.getState().updateItem('it-local-a', { title: '週日聚餐（改晚上）' })
    await useSpacesSyncStore.getState().syncNow()
    use(a)
    await useSpacesSyncStore.getState().syncNow()
    expect(localTitles()).toEqual(['專案會議', '週日聚餐（改晚上）'])
  })

  it('軟刪除：行程、空間、投射規則的刪除都會傳到另一台裝置，不會被帶回來', async () => {
    const st = useSpacesStore.getState()
    const work = st.createSpace({ name: '公司', kind: 'work' })
    st.addRule({ sourceSpaceId: work, targetSpaceId: 'sp-local-a', label: '上班中' })
    await useSpacesSyncStore.getState().enable()
    const a = save()
    // 另一台裝置拿到同樣的資料
    use({ ...newDevice('local-b', '空', '無'), data: { ...emptySharedCalendarData('local-b') } })
    await useSpacesSyncStore.getState().enable()
    const b = save()

    use(a)
    const s = useSpacesStore.getState()
    s.removeItem('it-local-a')
    s.removeRule(s.data.busyProjectionRules[0]!.id)
    s.deleteSpace(work)
    await useSpacesSyncStore.getState().syncNow()

    use(b)
    await useSpacesSyncStore.getState().syncNow()
    const d = useSpacesStore.getState().data
    expect(d.items.find((i) => i.id === 'it-local-a')!.deletedAt).not.toBeNull()
    expect(d.busyProjectionRules.every((r) => r.deletedAt !== null)).toBe(true)
    expect(d.spaces.find((x) => x.id === work)!.deletedAt).not.toBeNull()
    // B 再同步一次，刪除仍然在
    await useSpacesSyncStore.getState().syncNow()
    expect(useSpacesStore.getState().data.items.find((i) => i.id === 'it-local-a')!.deletedAt).not.toBeNull()
  })

  it('兩台同時從同一版修改：狀態顯示衝突，較新的修改勝出', async () => {
    await useSpacesSyncStore.getState().enable()
    const a = save()
    use({ ...a })
    const b = save()

    use(a)
    useSpacesStore.getState().updateItem('it-local-a', { title: 'A 改的' })
    const editedA = save()
    use(b)
    await new Promise((r) => setTimeout(r, 5))
    useSpacesStore.getState().updateItem('it-local-a', { title: 'B 改的（比較晚）' })
    await useSpacesSyncStore.getState().syncNow()

    use(editedA)
    await useSpacesSyncStore.getState().syncNow()
    expect(useSpacesSyncStore.getState().state).toBe('conflict')
    expect(useSpacesSyncStore.getState().conflicts.map((c) => c.id)).toContain('it-local-a')
    expect(localTitles()).toEqual(['B 改的（比較晚）'])
  })

  it('離線與 Drive 錯誤會回報狀態，不改本機資料', async () => {
    useSpacesStore.getState().setCloudSync(true)
    online = false
    const before = useSpacesStore.getState().data
    await useSpacesSyncStore.getState().syncNow()
    expect(useSpacesSyncStore.getState()).toMatchObject({ state: 'offline', error: { code: 'network' } })
    online = true
    drive.fail(new DriveError('Drive 403', 403))
    await useSpacesSyncStore.getState().syncNow()
    expect(useSpacesSyncStore.getState()).toMatchObject({ state: 'error', error: { code: 'forbidden' } })
    expect(useSpacesStore.getState().data).toBe(before)
  })

  it('關閉同步：可以只停止（保留檔案），或停止並刪除 Drive 上的檔案', async () => {
    await useSpacesSyncStore.getState().enable()
    await useSpacesSyncStore.getState().disable({ deleteRemote: false })
    expect(useSpacesStore.getState().cloudSync).toBe(false)
    expect(file()).toBeDefined()
    // 關閉後修改不會上傳
    const uploads = drive.uploads.length
    await useSpacesSyncStore.getState().syncNow()
    expect(drive.uploads.length).toBe(uploads)

    await useSpacesSyncStore.getState().enable()
    await useSpacesSyncStore.getState().disable({ deleteRemote: true })
    expect(file()).toBeUndefined()
    expect(drive.deleted).toEqual([SPACES])
    expect(drive.files['acacia_data_v2.json']).toEqual({ keep: 'main' })
    // 本機資料保留
    expect(localTitles()).toEqual(['週日聚餐'])
  })
})

describe('自動同步時機', () => {
  beforeEach(() => {
    drive = fakeDrive()
    setSpacesSyncProvider(createDriveSyncProvider({ getToken: () => useSyncStore.getState().token, drive: drive.api, isOnline: () => true }))
    useSyncStore.setState({ token: null, status: 'signedOut' })
    use({ ...newDevice('local-a', '陳家', '週日聚餐'), cloudSync: true })
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('登入完成時同步；資料變動 1.5 秒後同步；套用雲端資料不會觸發再上傳', async () => {
    startSpacesSync()
    await vi.advanceTimersByTimeAsync(0)
    expect(drive.uploads).toEqual([])

    useSyncStore.setState({ token: 'tok', status: 'synced' })
    await vi.advanceTimersByTimeAsync(0)
    expect(drive.uploads).toHaveLength(1)

    useSpacesStore.getState().updateItem('it-local-a', { title: '改了' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(drive.uploads).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(drive.uploads).toHaveLength(2)
    expect(titlesIn(file())).toEqual(['改了'])

    // 只有同步本身造成的變動（applyPulled）不會再排一次上傳
    await vi.advanceTimersByTimeAsync(5000)
    expect(drive.uploads).toHaveLength(2)

    // 登出後停止
    useSyncStore.setState({ token: null, status: 'signedOut' })
    useSpacesStore.getState().updateItem('it-local-a', { title: '登出後改' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(drive.uploads).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'
import { emptySharedCalendarData, type SharedCalendarData } from '../../core/sharing'
import { familySpace, makeItem, SECRET, T0, U, workSpace } from '../../test/sharingFixtures'
import { DriveError } from '../drive'
import { createDriveSyncProvider, DRIVE_SPACES_FILE_KIND, driveSpacesFileSchema, type DriveApi, type DriveSpacesFile } from './driveSyncProvider'
import type { SyncProviderStatus } from './types'

const SPACES = 'acacia_spaces_v1.json'

/** 假的 Drive：以檔名當 id，記錄每次上傳 */
function fakeDrive(initial: Record<string, unknown> = {}) {
  const files: Record<string, unknown> = { ...initial }
  const uploads: { id: string | null; name: string; data: unknown }[] = []
  let failWith: Error | null = null
  const api: DriveApi = {
    findFile: async (_t, name) => {
      if (failWith) throw failWith
      return name in files ? name : null
    },
    download: async (_t, id) => JSON.parse(JSON.stringify(files[id])),
    upload: async (_t, id, name, data) => {
      uploads.push({ id, name, data })
      files[name] = JSON.parse(JSON.stringify(data))
      return name
    },
    deleteFile: async (_t, id) => {
      delete files[id]
    },
  }
  return { api, files, uploads, fail: (e: Error | null) => (failWith = e) }
}

function momData(): SharedCalendarData {
  const family = familySpace()
  return {
    ...emptySharedCalendarData(U.mom),
    spaces: [family],
    items: [
      makeItem({ id: 'dinner', spaceId: family.id, createdBy: U.mom, title: '家庭聚餐', updatedAt: T0 + 1 }),
      makeItem({ id: 'dad-clinic', spaceId: family.id, createdBy: U.dad, title: SECRET.title, location: SECRET.location, visibility: { mode: 'busy_only' }, updatedAt: T0 + 2 }),
      makeItem({ id: 'dad-private', spaceId: family.id, createdBy: U.dad, title: SECRET.title, visibility: { mode: 'private' }, updatedAt: T0 + 3 }),
    ],
  }
}

const setup = (initial?: Record<string, unknown>, opts: { token?: string | null; online?: boolean } = {}) => {
  const drive = fakeDrive(initial)
  let clock = T0 + 1000
  const provider = createDriveSyncProvider({
    getToken: () => (opts.token === undefined ? 'tok' : opts.token),
    drive: drive.api,
    now: () => clock++,
    isOnline: () => opts.online ?? true,
  })
  return { drive, provider }
}

describe('Drive 同步：與既有同步／備份共存', () => {
  it('只寫入 acacia_spaces_v1.json，不碰主資料同步檔與備份檔', async () => {
    const { drive, provider } = setup({ 'acacia_data_v2.json': { keep: 1 }, 'acacia_backup_v2.json': { keep: 2 } })
    await provider.push({ viewerId: U.mom, data: momData(), changedSince: null })
    expect(drive.uploads.map((u) => u.name)).toEqual([SPACES])
    expect(drive.files['acacia_data_v2.json']).toEqual({ keep: 1 })
    expect(drive.files['acacia_backup_v2.json']).toEqual({ keep: 2 })
    expect(driveSpacesFileSchema.parse(drive.files[SPACES]).kind).toBe(DRIVE_SPACES_FILE_KIND)
  })

  it('寫進 Drive 的是「自己看得到的版本」：別人的私人行程不存、忙閒行程不含敏感內容', async () => {
    const { drive, provider } = setup()
    await provider.push({ viewerId: U.mom, data: momData(), changedSince: null })
    const file = drive.files[SPACES] as DriveSpacesFile
    const ids = file.payloads[0].entries.map((e) => e.id)
    expect(ids).toEqual(['dinner', 'dad-clinic'])
    expect(JSON.stringify(file)).not.toMatch(new RegExp(`${SECRET.title}|${SECRET.location}`))
    expect(file.payloads[0].entries[1]).toMatchObject({ redaction: 'busy' })
  })

  it('本機專屬資料（acacia-consent）不會被上傳', async () => {
    const { drive, provider } = setup()
    const polluted = { ...momData(), 'acacia-consent': { acceptedAt: 1 } } as SharedCalendarData
    await provider.push({ viewerId: U.mom, data: polluted, changedSince: null })
    expect(JSON.stringify(drive.files[SPACES])).not.toContain('acacia-consent')
  })

  it('只能上傳自己的資料', async () => {
    const { drive, provider } = setup()
    await expect(provider.push({ viewerId: U.dad, data: momData(), changedSince: null })).rejects.toMatchObject({ code: 'forbidden' })
    expect(drive.uploads).toEqual([])
    expect(provider.getStatus().state).toBe('error')
  })
})

describe('Drive 同步：拉取與游標', () => {
  it('雲端沒有檔案：回傳空結果', async () => {
    const { provider } = setup()
    expect(await provider.pull({ viewerId: U.mom, since: null })).toEqual({ payloads: [], rules: [], cursor: null })
    expect(provider.getStatus()).toMatchObject({ state: 'idle', cursor: null })
  })

  it('推送後可以拉回；用游標只拿之後的變更', async () => {
    const { provider } = setup()
    await provider.push({ viewerId: U.mom, data: momData(), changedSince: null })
    const all = await provider.pull({ viewerId: U.mom, since: null })
    expect(all.payloads[0].entries.map((e) => e.id)).toEqual(['dinner', 'dad-clinic'])
    expect(all.cursor).toBe(String(T0 + 2))

    const inc = await provider.pull({ viewerId: U.mom, since: String(T0 + 1) })
    expect(inc.payloads[0].entries.map((e) => e.id)).toEqual(['dad-clinic'])
    expect(provider.getStatus()).toMatchObject({ state: 'idle', cursor: String(T0 + 2), lastSyncedAt: expect.any(Number) })
  })

  it('雲端檔案屬於別人或格式錯誤：回報錯誤且不覆寫', async () => {
    const other = { kind: DRIVE_SPACES_FILE_KIND, fileVersion: 1, ownerId: U.dad, updatedAt: 0, payloads: [], busyProjectionRules: [] }
    const a = setup({ [SPACES]: other })
    await expect(a.provider.pull({ viewerId: U.mom, since: null })).rejects.toMatchObject({ code: 'forbidden' })

    const b = setup({ [SPACES]: { kind: 'broken' } })
    await expect(b.provider.push({ viewerId: U.mom, data: momData(), changedSince: null })).rejects.toMatchObject({ code: 'invalid_payload' })
    expect(b.drive.uploads).toEqual([])
    expect(b.drive.files[SPACES]).toEqual({ kind: 'broken' })
    expect(b.provider.getStatus()).toMatchObject({ state: 'error', error: { code: 'invalid_payload', retryable: false } })
  })
})

describe('Drive 同步：衝突、軟刪除與跨裝置合併', () => {
  it('另一台裝置改了較新版本：本機舊版被標為 stale，雲端保留較新的', async () => {
    const { drive, provider } = setup()
    const data = momData()
    await provider.push({ viewerId: U.mom, data, changedSince: null })

    // 另一台裝置把聚餐改到 v2
    const file = drive.files[SPACES] as DriveSpacesFile
    file.payloads[0].entries[0] = { ...file.payloads[0].entries[0], title: '聚餐改到晚上', version: 2, updatedAt: T0 + 50, updatedBy: U.mom }

    const r = await provider.push({ viewerId: U.mom, data, changedSince: null })
    expect(r.rejected).toEqual([{ id: 'dinner', reason: 'stale' }])
    expect(r.conflicts).toEqual([])
    expect((drive.files[SPACES] as DriveSpacesFile).payloads[0].entries.find((e) => e.id === 'dinner')?.title).toBe('聚餐改到晚上')
  })

  it('兩台裝置從同一版本各自修改：狀態變成 conflict，較新的時間戳記勝出', async () => {
    const { drive, provider } = setup()
    const data = momData()
    await provider.push({ viewerId: U.mom, data, changedSince: null })
    const file = drive.files[SPACES] as DriveSpacesFile
    file.payloads[0].entries[0] = { ...file.payloads[0].entries[0], title: '另一台改的', version: 2, updatedAt: T0 + 10, updatedBy: U.mom }

    const local = { ...data, items: data.items.map((i) => (i.id === 'dinner' ? { ...i, title: '這台改的', version: 2, updatedAt: T0 + 20, updatedBy: U.mom } : i)) }
    const statuses: SyncProviderStatus['state'][] = []
    const off = provider.subscribe((s) => statuses.push(s.state))
    const r = await provider.push({ viewerId: U.mom, data: local, changedSince: null })
    off()

    expect(r.conflicts).toEqual([expect.objectContaining({ id: 'dinner', winner: 'local', localUpdatedAt: T0 + 20, incomingUpdatedAt: T0 + 10 })])
    expect(r.accepted).toContain('dinner')
    expect(provider.getStatus().state).toBe('conflict')
    expect(statuses).toEqual(['syncing', 'conflict'])
    expect((drive.files[SPACES] as DriveSpacesFile).payloads[0].entries.find((e) => e.id === 'dinner')?.title).toBe('這台改的')
  })

  it('軟刪除：墓碑寫進雲端且不含內容；舊裝置的未刪除版本不會讓它復活', async () => {
    const { drive, provider } = setup()
    const data = momData()
    await provider.push({ viewerId: U.mom, data, changedSince: null })

    const deleted = { ...data, items: data.items.map((i) => (i.id === 'dinner' ? { ...i, deletedAt: T0 + 30, version: 2, updatedAt: T0 + 30 } : i)) }
    await provider.push({ viewerId: U.mom, data: deleted, changedSince: null })
    const tomb = (drive.files[SPACES] as DriveSpacesFile).payloads[0].entries.find((e) => e.id === 'dinner')!
    expect(tomb).toMatchObject({ deletedAt: T0 + 30, title: '', version: 2 })

    // 舊裝置還拿著 v1 的聚餐
    const r = await provider.push({ viewerId: U.mom, data, changedSince: null })
    expect(r.rejected).toContainEqual({ id: 'dinner', reason: 'stale' })
    expect((drive.files[SPACES] as DriveSpacesFile).payloads[0].entries.find((e) => e.id === 'dinner')?.deletedAt).toBe(T0 + 30)
  })

  it('其他裝置新增、這台還沒有的空間會保留；忙閒投射規則一起同步（只存自己的）', async () => {
    const { drive, provider } = setup()
    const work = workSpace()
    const fromOtherDevice = {
      ...emptySharedCalendarData(U.dad),
      spaces: [work],
      items: [makeItem({ id: 'mtg', spaceId: work.id, createdBy: U.dad, kind: 'meeting' })],
      busyProjectionRules: [{ id: 'r1', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: 'sp-family', kinds: [], label: '上班中', includePrivate: false, enabled: true, updatedAt: T0, deletedAt: null }],
    }
    await provider.push({ viewerId: U.dad, data: fromOtherDevice, changedSince: null })

    const thisDevice = {
      ...emptySharedCalendarData(U.dad),
      spaces: [familySpace()],
      busyProjectionRules: [{ id: 'r-mom', userId: U.mom, sourceSpaceId: 'a', targetSpaceId: 'b', kinds: [], label: '', includePrivate: false, enabled: true, updatedAt: T0, deletedAt: null }],
    }
    await provider.push({ viewerId: U.dad, data: thisDevice, changedSince: null })
    const file = drive.files[SPACES] as DriveSpacesFile
    expect(file.payloads.map((p) => p.spaceId).sort()).toEqual(['sp-family', 'sp-work'])
    expect(file.busyProjectionRules.map((r) => r.id)).toEqual(['r1'])
  })

  it('changedSince 只回報這段時間之後的變更', async () => {
    const { provider } = setup()
    const r = await provider.push({ viewerId: U.mom, data: momData(), changedSince: T0 + 1 })
    expect(r.accepted).toEqual(['dad-clinic'])
  })
})

describe('Drive 同步：錯誤回報', () => {
  it('離線：狀態 offline、可重試，不呼叫 Drive', async () => {
    const { drive, provider } = setup(undefined, { online: false })
    await expect(provider.pull({ viewerId: U.mom, since: null })).rejects.toMatchObject({ code: 'network', retryable: true })
    expect(provider.getStatus().state).toBe('offline')
    expect(drive.uploads).toEqual([])
  })

  it('沒有登入：auth 錯誤', async () => {
    const { provider } = setup(undefined, { token: null })
    await expect(provider.push({ viewerId: U.mom, data: momData(), changedSince: null })).rejects.toMatchObject({ code: 'auth' })
    expect(provider.getStatus()).toMatchObject({ state: 'error', error: { code: 'auth' } })
  })

  it('Drive HTTP 錯誤對應到錯誤類型；網路中斷視為 offline', async () => {
    const { drive, provider } = setup()
    drive.fail(new DriveError('Drive 401', 401))
    await expect(provider.pull({ viewerId: U.mom, since: null })).rejects.toMatchObject({ code: 'auth', status: 401 })
    drive.fail(new DriveError('Drive 503', 503))
    await expect(provider.pull({ viewerId: U.mom, since: null })).rejects.toMatchObject({ code: 'server', retryable: true })
    drive.fail(new TypeError('Failed to fetch'))
    await expect(provider.pull({ viewerId: U.mom, since: null })).rejects.toMatchObject({ code: 'network' })
    expect(provider.getStatus().state).toBe('offline')
  })

  it('disconnect 清掉狀態與快取', async () => {
    const { provider } = setup()
    await provider.push({ viewerId: U.mom, data: momData(), changedSince: null })
    await provider.disconnect()
    expect(provider.getStatus()).toEqual({ state: 'idle', lastSyncedAt: null, cursor: null, error: null, conflicts: [] })
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_INTERVAL_MS } from '../core/backup'
import { loadSeed } from '../test/spacesSeed'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

const { useSpacesStore } = await import('./useSpacesStore')
const { useSpacesBackupStore } = await import('./useSpacesBackupStore')
const storage = await import('../adapters/spacesBackupStorage')
const mainStorage = await import('../adapters/backupStorage')
const { deleteAllData } = await import('./deleteAllData')

describe('共享空間快照', () => {
  beforeEach(async () => {
    await storage.clearSpacesBackups()
    useSpacesBackupStore.setState({ ready: false })
    useSpacesBackupStore.getState().reset()
    useSpacesBackupStore.setState({ ready: false })
    loadSeed()
    useSpacesStore.setState((s) => ({ data: { ...s.data, updatedAt: 1000 } }))
  })

  it('存在獨立的 IndexedDB，不會混進主資料的快照', async () => {
    const meta = await useSpacesBackupStore.getState().backupNow('manual')
    expect(meta?.counts).toEqual({ spaces: 2, items: 6 })
    expect((await storage.loadSpacesSnapshot(meta!.id))?.items).toHaveLength(6)
    expect((await mainStorage.loadIndex()).snapshots).toEqual([])
    // 資料沒變不重複建立
    expect(await useSpacesBackupStore.getState().backupNow('manual')).toBeNull()
  })

  it('自動快照：超過 12 小時且資料有變才建立，最多 7 份', async () => {
    const t0 = 10 * BACKUP_INTERVAL_MS
    expect(await useSpacesBackupStore.getState().runAuto(t0)).not.toBeNull()
    useSpacesStore.getState().updateItem('clinic', { title: '改了' })
    expect(await useSpacesBackupStore.getState().runAuto(t0 + BACKUP_INTERVAL_MS - 1)).toBeNull()
    expect(await useSpacesBackupStore.getState().runAuto(t0 + BACKUP_INTERVAL_MS)).not.toBeNull()
    for (let i = 0; i < 8; i++) {
      useSpacesStore.getState().updateItem('clinic', { title: `改 ${i}` })
      // 同一毫秒內的修改 updatedAt 相同，會被當成跟最新快照一樣而略過；每次給不同的時間
      useSpacesStore.setState((st) => ({ data: { ...st.data, updatedAt: 5000 + i } }))
      await useSpacesBackupStore.getState().backupNow('manual')
    }
    expect(useSpacesBackupStore.getState().snapshots).toHaveLength(7)
    expect((await storage.loadSpacesIndex()).snapshots).toHaveLength(7)
  })

  it('還原：先替目前資料留一份，還原後版本號比目前大', async () => {
    const meta = (await useSpacesBackupStore.getState().backupNow('manual'))!
    useSpacesStore.getState().updateItem('clinic', { title: '被改壞' })
    useSpacesStore.getState().updateItem('clinic', { title: '又改一次' })
    const broken = useSpacesStore.getState().data.items.find((i) => i.id === 'clinic')!
    await useSpacesBackupStore.getState().restore(meta.id)
    const restored = useSpacesStore.getState().data.items.find((i) => i.id === 'clinic')!
    expect(restored.title).not.toBe('又改一次')
    expect(restored.version).toBeGreaterThan(broken.version)
    expect(useSpacesBackupStore.getState().snapshots[0]!.reason).toBe('beforeRestore')
  })

  it('預覽其他成員時不能還原', async () => {
    const meta = (await useSpacesBackupStore.getState().backupNow('manual'))!
    useSpacesStore.getState().setViewer('u-kid')
    await expect(useSpacesBackupStore.getState().restore(meta.id)).rejects.toThrow()
  })

  it('刪除所有資料：共享空間快照一起清掉', async () => {
    await useSpacesBackupStore.getState().backupNow('manual')
    await deleteAllData()
    expect((await storage.loadSpacesIndex()).snapshots).toEqual([])
    expect(useSpacesBackupStore.getState().snapshots).toEqual([])
    expect(useSpacesStore.getState().cloudSync).toBe(false)
  })
})

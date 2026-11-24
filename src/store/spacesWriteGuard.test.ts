import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { webStorage } from '../adapters/storage'
import { createDriveSyncProvider } from '../adapters/sync/driveSyncProvider'
import { emptyAppData } from '../core/schema'
import { SHARING_SCHEMA_VERSION } from '../core/sharing'
import { fakeDrive } from '../test/fakeDrive'
import { mirrorPersonalBusyNow } from './personalBusyMirror'
import { useAppStore } from './useAppStore'
import { SPACES_STORAGE_KEY, SpacesWriteBlockedError, useSpacesStore } from './useSpacesStore'
import { setSpacesSyncProvider, useSpacesSyncStore } from './useSpacesSyncStore'
import { useSyncStore } from './useSyncStore'

/** 較新版本（v3）的 App 存在這台裝置上的共享資料：這個版本看不懂，必須原封不動保留 */
const NEWER = JSON.stringify({
  state: {
    selfId: 'local-future',
    cloudSync: true,
    data: { schemaVersion: SHARING_SCHEMA_VERSION + 1, ownerId: 'local-future', spaces: [{ id: 'sp-x', name: '未來的空間', somethingNew: true }], items: [], futureField: [1, 2, 3] },
  },
  version: 1,
})
const stored = () => webStorage.getItem(SPACES_STORAGE_KEY)

describe('本機共享資料來自較新版本：寫入保護', () => {
  let drive = fakeDrive()
  beforeEach(async () => {
    useSpacesStore.getState().reset()
    useAppStore.setState(emptyAppData())
    drive = fakeDrive()
    setSpacesSyncProvider(createDriveSyncProvider({ getToken: () => 'tok', drive: drive.api, isOnline: () => true }))
    useSyncStore.setState({ token: 'tok', status: 'synced' })
    useSpacesSyncStore.setState({ state: 'idle', error: null, conflicts: [], lastSyncedAt: null })
    await webStorage.setItem(SPACES_STORAGE_KEY, NEWER)
    await useSpacesStore.persist.rehydrate()
  })
  afterEach(() => useSpacesStore.getState().reset())

  it('讀取時開啟寫入保護，提示更新 App；不把看不懂的資料當成壞掉', () => {
    const s = useSpacesStore.getState()
    expect(s.blockedReason).toContain('請先更新 App')
    expect(s.data.spaces).toEqual([])
  })

  it('所有修改都被擋下，IndexedDB 裡的原始資料原封不動', async () => {
    const st = useSpacesStore.getState()
    expect(() => st.createSpace({ name: '新空間', kind: 'family' })).toThrow(SpacesWriteBlockedError)
    expect(() => st.addRule({ sourceId: 'personal', targetMode: 'all' })).toThrow(SpacesWriteBlockedError)
    expect(() => st.setPersonalBusySlots([])).toThrow(SpacesWriteBlockedError)
    // 不是修改資料的操作（切換分頁、開關同步）照常，但也不會寫進 IndexedDB
    st.setFilter('personal')
    st.setCloudSync(false)
    await new Promise((r) => setTimeout(r, 10))
    expect(await stored()).toBe(NEWER)
  })

  it('同步暫停：回報 update_required，不讀也不寫雲端', async () => {
    useSpacesStore.getState().setCloudSync(true)
    await useSpacesSyncStore.getState().syncNow()
    expect(useSpacesSyncStore.getState()).toMatchObject({ state: 'error', error: { code: 'update_required' } })
    expect(drive.uploads).toEqual([])
  })

  it('鏡像程序暫停：不更新忙碌影子', () => {
    useAppStore.setState({ events: [{ id: 'e1', title: '看牙醫', dateISO: '2026-12-01', start: '14:00', end: '15:00', note: '' }] })
    expect(() => mirrorPersonalBusyNow()).not.toThrow()
    expect(useSpacesStore.getState().data.personalBusySlots).toEqual([])
  })

  it('使用者明確「刪除所有資料」（reset）才解除保護，之後可以正常使用與寫入', async () => {
    useSpacesStore.getState().reset()
    expect(useSpacesStore.getState().blockedReason).toBeNull()
    useSpacesStore.getState().createSpace({ name: '新空間', kind: 'family' })
    await new Promise((r) => setTimeout(r, 10))
    expect(await stored()).not.toBe(NEWER)
  })
})

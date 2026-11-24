import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setConsentPrefsForTests } from '../adapters/consentStorage'
import { setNativeForTests } from '../adapters/kv'
import { createNativeKv } from '../adapters/kv/nativeKv'
import { fakeFs, fakePrefs } from '../test/fakeCapacitor'

vi.mock('../adapters/googleAuth', () => ({
  restoreToken: () => null,
  signIn: async () => ({ token: 'tok', expiresAt: Date.now() + 3600_000 }),
  signOut: async () => {},
  fetchProfile: async () => ({ name: 'QQ' }),
}))

// 模擬在 iOS App 裡：儲存換成記憶體版的檔案系統與 Preferences（要在載入 store 之前設定）
const fs = fakeFs()
const prefs = fakePrefs()
setNativeForTests(true, async (ns) => createNativeKv(ns, fs.api))
setConsentPrefsForTests(prefs.api)

const { useAppStore } = await import('./useAppStore')
const { useBackupStore } = await import('./useBackupStore')
const { useSpacesBackupStore } = await import('./useSpacesBackupStore')
const { useConsentStore } = await import('./useConsentStore')
const { deleteAllData } = await import('./deleteAllData')

const flush = () => new Promise((r) => setTimeout(r, 30))

describe('iOS App：刪除所有資料', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('主資料、共享空間、兩種快照的檔案與 Preferences 裡的同意紀錄都清掉', async () => {
    useAppStore.getState().addTask({ title: '祕密待辦', loc: '', date: '', time: '' })
    await useBackupStore.getState().backupNow('manual')
    await useSpacesBackupStore.getState().backupNow('manual')
    await useConsentStore.getState().accept()
    await flush()
    const paths = () => [...fs.files.keys()]
    expect(paths().some((p) => p.startsWith('acacia/state/'))).toBe(true)
    expect(paths().some((p) => p.startsWith('acacia/backups/'))).toBe(true)
    expect(prefs.values.has('acacia-consent')).toBe(true)

    await deleteAllData()
    await flush()
    expect(paths().filter((p) => p.startsWith('acacia/backups/') || p.startsWith('acacia/spacesBackups/'))).toEqual([])
    expect(JSON.stringify([...fs.files.values()])).not.toContain('祕密待辦')
    expect(prefs.values.has('acacia-consent')).toBe(false)
    expect(useConsentStore.getState().status).toBe('required')
  })
})

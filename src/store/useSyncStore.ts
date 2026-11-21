import { create } from 'zustand'
import { download, DRIVE_FILE, findFile, LEGACY_DRIVE_FILE, upload } from '../adapters/drive'
import { fetchProfile, restoreToken, signIn, signOut, type GoogleProfile } from '../adapters/googleAuth'
import { migrate } from '../core/migrate'
import { decideSync } from '../core/sync'
import { useAppStore } from './useAppStore'

export type SyncStatus = 'signedOut' | 'connecting' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  profile: GoogleProfile | null
  lastSyncedAt: number | null
  token: string | null
  fileId: string | null
  connect: (interactive: boolean) => Promise<void>
  disconnect: () => Promise<void>
  push: () => Promise<void>
}

/** 等 IndexedDB 的本機資料載入完成，避免把尚未載入的空資料當成本機版本 */
const hydrated = () =>
  useAppStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useAppStore.persist.onFinishHydration(() => r()))

let pushTimer: ReturnType<typeof setTimeout> | undefined
let pushing = false
let applyingRemote = false

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: 'signedOut',
  profile: null,
  lastSyncedAt: null,
  token: null,
  fileId: null,

  /** 登入（interactive=false 時只嘗試沿用這個分頁已有的 token） */
  connect: async (interactive) => {
    const stored = restoreToken()
    if (!stored && !interactive) return
    set({ status: 'connecting' })
    try {
      await hydrated()
      const { token } = stored ?? (await signIn())
      const profile = await fetchProfile(token)
      if (!profile) throw new Error('profile')
      set({ token, profile, status: 'syncing' })

      let fileId = await findFile(token, DRIVE_FILE)
      let cloudRaw: unknown = null
      if (fileId) cloudRaw = await download(token, fileId)
      else {
        const legacyId = await findFile(token, LEGACY_DRIVE_FILE)
        if (legacyId) cloudRaw = await download(token, legacyId)
      }

      const cloud = cloudRaw ? migrate(cloudRaw) : null
      const local = useAppStore.getState().exportData()
      const decision = decideSync(local, cloud)
      if (decision === 'useCloud' && cloud) {
        applyingRemote = true
        useAppStore.setState(cloud)
        applyingRemote = false
      }
      if (decision === 'useLocal' || !fileId) {
        fileId = await upload(token, fileId, DRIVE_FILE, useAppStore.getState().exportData())
      }
      set({ fileId, status: 'synced', lastSyncedAt: Date.now() })
    } catch (e) {
      console.error('Drive 同步失敗', e)
      const status = get().token ? 'error' : 'signedOut'
      set({ status })
    }
  },

  disconnect: async () => {
    clearTimeout(pushTimer)
    await signOut(get().token)
    set({ status: 'signedOut', profile: null, token: null, fileId: null, lastSyncedAt: null })
  },

  push: async () => {
    const { token, fileId } = get()
    if (!token || pushing) return
    pushing = true
    set({ status: 'syncing' })
    try {
      const id = await upload(token, fileId, DRIVE_FILE, useAppStore.getState().exportData())
      set({ fileId: id, status: 'synced', lastSyncedAt: Date.now() })
    } catch (e) {
      console.error('Drive 上傳失敗', e)
      set({ status: 'error' })
    } finally {
      pushing = false
    }
  },
}))

/** 資料有變動時，1.2 秒後自動上傳（和舊版相同） */
useAppStore.subscribe((s, prev) => {
  if (applyingRemote || s.updatedAt === prev.updatedAt) return
  if (!useSyncStore.getState().token) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void useSyncStore.getState().push(), 1200)
})

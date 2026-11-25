import { useAppStore } from './useAppStore'
import { useSpacesStore } from './useSpacesStore'

/**
 * 「最近刪除」滿 30 天的自動清理（不需要伺服器排程）：
 * - App 啟動、兩個 store 讀取完成時（startTrashPurge）
 * - 雲端同步合併之後（useSyncStore、useSpacesSyncStore 各自處理，清理結果會跟著寫回雲端）
 * - 打開「最近刪除」時（TrashDialog）
 */
export function purgeTrashNow(now = Date.now()) {
  useAppStore.getState().purgeTrash(now)
  useSpacesStore.getState().purgeTrash(now)
}

const hydrated = (store: { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }) =>
  store.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => store.persist.onFinishHydration(() => r()))

let started = false
/** App 啟動時呼叫一次（main.tsx，同意使用條款之後） */
export function startTrashPurge() {
  if (started) return
  started = true
  void Promise.all([hydrated(useAppStore), hydrated(useSpacesStore)]).then(() => purgeTrashNow())
}

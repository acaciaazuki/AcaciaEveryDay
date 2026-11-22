import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval'
import { emptyBackupIndex, type BackupIndex } from '../core/backup'
import type { AppData } from '../core/schema'

/**
 * 自動備份快照的儲存位置：瀏覽器 IndexedDB 裡獨立的資料庫（acacia-backups），
 * 跟主資料（acacia-next）分開，主資料毀損時快照不受影響，清除時也能整個清掉。
 * 之後 iOS 版只要換掉這個檔案的實作即可。
 */
let store: UseStore | null = null
const db = () => (store ??= createStore('acacia-backups', 'snapshots'))

const INDEX_KEY = 'index'
const dataKey = (id: string) => `snapshot:${id}`

export async function loadIndex(): Promise<BackupIndex> {
  const raw = await get<BackupIndex>(INDEX_KEY, db())
  return raw ? { ...emptyBackupIndex(), ...raw } : emptyBackupIndex()
}

export const saveIndex = (index: BackupIndex) => set(INDEX_KEY, index, db())
export const saveSnapshotData = (id: string, data: AppData) => set(dataKey(id), data, db())
export const loadSnapshotData = (id: string) => get<AppData>(dataKey(id), db())
export const deleteSnapshotData = (id: string) => del(dataKey(id), db())

/** 刪除所有快照與設定 */
export const clearBackups = () => clear(db())

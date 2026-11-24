import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval'
import type { SharedCalendarData } from '../core/sharing'
import { emptySpacesBackupIndex, type SpacesBackupIndex } from '../core/spacesBackup'

/**
 * 共享空間快照的儲存位置：獨立的 IndexedDB 資料庫（acacia-spaces-backups），
 * 跟主資料快照（acacia-backups）與共享空間本身（acacia-spaces）都分開。
 * 之後 iOS 版只要換掉這個檔案的實作即可。
 */
let store: UseStore | null = null
const db = () => (store ??= createStore('acacia-spaces-backups', 'snapshots'))

const INDEX_KEY = 'index'
const dataKey = (id: string) => `snapshot:${id}`

export async function loadSpacesIndex(): Promise<SpacesBackupIndex> {
  const raw = await get<SpacesBackupIndex>(INDEX_KEY, db())
  return raw ? { ...emptySpacesBackupIndex(), ...raw } : emptySpacesBackupIndex()
}

export const saveSpacesIndex = (index: SpacesBackupIndex) => set(INDEX_KEY, index, db())
export const saveSpacesSnapshot = (id: string, data: SharedCalendarData) => set(dataKey(id), data, db())
export const loadSpacesSnapshot = (id: string) => get<SharedCalendarData>(dataKey(id), db())
export const deleteSpacesSnapshot = (id: string) => del(dataKey(id), db())

/** 刪除所有共享空間快照 */
export const clearSpacesBackups = () => clear(db())

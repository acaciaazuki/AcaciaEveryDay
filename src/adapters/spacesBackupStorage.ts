import { kv } from './kv'
import type { SharedCalendarData } from '../core/sharing'
import { emptySpacesBackupIndex, type SpacesBackupIndex } from '../core/spacesBackup'

/**
 * 共享空間快照的儲存位置，跟主資料快照與共享空間本身（acacia-spaces）都分開。
 * 網頁版：IndexedDB 裡獨立的資料庫（acacia-spaces-backups）；iOS App：Library/acacia/spacesBackups/ 的 JSON 檔（見 adapters/kv）。
 */
const db = kv('spacesBackups')

const INDEX_KEY = 'index'
const dataKey = (id: string) => `snapshot:${id}`

export async function loadSpacesIndex(): Promise<SpacesBackupIndex> {
  const raw = await db.get<SpacesBackupIndex>(INDEX_KEY)
  return raw ? { ...emptySpacesBackupIndex(), ...raw } : emptySpacesBackupIndex()
}

export const saveSpacesIndex = (index: SpacesBackupIndex) => db.set(INDEX_KEY, index)
export const saveSpacesSnapshot = (id: string, data: SharedCalendarData) => db.set(dataKey(id), data)
export const loadSpacesSnapshot = (id: string) => db.get<SharedCalendarData>(dataKey(id))
export const deleteSpacesSnapshot = (id: string) => db.del(dataKey(id))

/** 刪除所有共享空間快照 */
export const clearSpacesBackups = () => db.clear()

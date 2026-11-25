/**
 * 鍵值儲存介面：網頁版用 IndexedDB（idb-keyval），iOS（Capacitor）用 App 內的 JSON 檔案。
 * 主資料與快照都透過這個介面讀寫，store 與畫面不需要知道底層是哪一種。
 */
export interface KeyValueStore {
  get<T = unknown>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  /** 清空這個命名空間的所有資料 */
  clear(): Promise<void>
  keys(): Promise<string[]>
}

/**
 * 命名空間，對應網頁版既有的 IndexedDB 位置（沿用原本的資料庫與 store 名稱，網頁版資料不需要搬移）：
 * - state：主資料（acacia-next；舊版也在這裡存共享空間 acacia-spaces，新版轉換後會清掉），在預設的 keyval-store
 * - backups：主資料快照（acacia-backups 資料庫）
 * - spacesBackups：舊版共享空間快照（acacia-spaces-backups 資料庫）；共享功能已移除，只保留位置讓轉換與「刪除所有資料」能清掉
 */
export const KV_NAMESPACES = ['state', 'backups', 'spacesBackups'] as const
export type KvNamespace = (typeof KV_NAMESPACES)[number]

/** 網頁版 IndexedDB 位置；null 表示 idb-keyval 預設的 keyval-store／keyval */
export const IDB_LOCATION: Record<KvNamespace, readonly [db: string, store: string] | null> = {
  state: null,
  backups: ['acacia-backups', 'snapshots'],
  spacesBackups: ['acacia-spaces-backups', 'snapshots'],
}

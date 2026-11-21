import type { AppData } from './schema'

export type SyncDecision = 'useCloud' | 'useLocal' | 'same'

/**
 * 登入時決定以哪一邊為準：較新的 updatedAt 獲勝（沿用舊版規則）。
 * 本機從沒有改過資料（updatedAt 為 0）時一律用雲端。
 */
export function decideSync(local: Pick<AppData, 'updatedAt'>, cloud: Pick<AppData, 'updatedAt'> | null): SyncDecision {
  if (!cloud) return 'useLocal'
  if (local.updatedAt === 0) return 'useCloud'
  if (cloud.updatedAt === local.updatedAt) return 'same'
  return cloud.updatedAt > local.updatedAt ? 'useCloud' : 'useLocal'
}

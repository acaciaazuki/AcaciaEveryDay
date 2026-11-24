import type { BusyProjectionRule, SharedCalendarData } from '../../core/sharing'
import type { SpaceSyncPayload, SyncConflict, SyncCursor } from '../../core/syncEnvelope'

/**
 * 共享行事曆的同步介面。
 *
 * 和現有的 useSyncStore（同步 AppData → acacia_data_v2.json）並存，互不影響：
 * - 這裡只同步共享行事曆（SharedCalendarData），Drive 版寫在 acacia_spaces_v1.json
 * - 不碰主資料檔、自動備份檔（acacia_backup_v2.json），也不碰本機同意紀錄（acacia-consent）
 *
 * 實作：
 * - driveSyncProvider：使用者自己的 Google Drive appDataFolder（單人多裝置）
 * - backendSyncProvider：未來的後端 API（多人協作、伺服器端權限驗證）
 */

export type SyncProviderId = 'drive' | 'backend'

/** idle 閒置／syncing 同步中／error 錯誤／offline 離線／conflict 已自動解決但有衝突需要使用者確認 */
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline' | 'conflict'

/** update_required：雲端資料來自較新版本的 App，要先更新才能同步（不會覆寫雲端） */
export type SyncErrorCode = 'auth' | 'forbidden' | 'not_found' | 'network' | 'server' | 'invalid_payload' | 'conflict' | 'update_required' | 'unknown'

export interface SyncErrorInfo {
  code: SyncErrorCode
  message: string
  /** HTTP 狀態碼（有的話） */
  status?: number
  /** 稍後重試可能就會成功（網路、伺服器暫時錯誤） */
  retryable: boolean
}

export class SyncProviderError extends Error {
  readonly code: SyncErrorCode
  readonly status?: number
  readonly retryable: boolean
  constructor(info: SyncErrorInfo) {
    super(info.message)
    this.code = info.code
    this.status = info.status
    this.retryable = info.retryable
  }
  toInfo(): SyncErrorInfo {
    return { code: this.code, message: this.message, status: this.status, retryable: this.retryable }
  }
}

export interface SyncProviderStatus {
  state: SyncState
  lastSyncedAt: number | null
  /** 最後一次成功拉取後的游標 */
  cursor: SyncCursor | null
  error: SyncErrorInfo | null
  /** 最近一次同步自動解決的衝突（state 為 conflict 時給畫面提示） */
  conflicts: SyncConflict[]
}

export interface PullRequest {
  viewerId: string
  /** 增量拉取的起點；null 表示全部 */
  since: SyncCursor | null
}

export interface PullResult {
  /** 每個空間一份、已依 viewerId 過濾的封包 */
  payloads: SpaceSyncPayload[]
  /** 使用者自己的忙閒投射規則（個人設定，跨裝置同步） */
  rules: BusyProjectionRule[]
  cursor: SyncCursor | null
}

export interface PushRequest {
  viewerId: string
  /** 本機的共享行事曆資料，provider 會自行依權限過濾，呼叫端不需要（也不應該）先處理 */
  data: SharedCalendarData
  /** 只推送這個本機時間點之後修改的行程；null 表示全部 */
  changedSince: number | null
}

export type RejectReason = 'stale' | 'forbidden' | 'invalid'

export interface PushResult {
  accepted: string[]
  rejected: { id: string; reason: RejectReason }[]
  conflicts: SyncConflict[]
  cursor: SyncCursor | null
}

export interface SyncProvider {
  readonly id: SyncProviderId
  pull(req: PullRequest): Promise<PullResult>
  push(req: PushRequest): Promise<PushResult>
  getStatus(): SyncProviderStatus
  /** 狀態變化通知（給之後的 store／畫面訂閱），回傳取消訂閱函式 */
  subscribe(listener: (status: SyncProviderStatus) => void): () => void
  /** 中斷連線並清掉快取的游標／檔案 id；不刪除雲端資料 */
  disconnect(): Promise<void>
}

export const initialSyncStatus = (): SyncProviderStatus => ({ state: 'idle', lastSyncedAt: null, cursor: null, error: null, conflicts: [] })

/** 兩個 provider 共用的狀態容器 */
export function createStatusTracker() {
  let status = initialSyncStatus()
  const listeners = new Set<(s: SyncProviderStatus) => void>()
  return {
    get: () => status,
    set(patch: Partial<SyncProviderStatus>) {
      status = { ...status, ...patch }
      for (const l of listeners) l(status)
    },
    reset() {
      status = initialSyncStatus()
      for (const l of listeners) l(status)
    },
    subscribe(listener: (s: SyncProviderStatus) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

/** 依 HTTP 狀態碼對應錯誤類型 */
export function errorFromStatus(status: number, message = `HTTP ${status}`): SyncProviderError {
  if (status === 401) return new SyncProviderError({ code: 'auth', message, status, retryable: false })
  if (status === 403) return new SyncProviderError({ code: 'forbidden', message, status, retryable: false })
  if (status === 404) return new SyncProviderError({ code: 'not_found', message, status, retryable: false })
  if (status === 409 || status === 412) return new SyncProviderError({ code: 'conflict', message, status, retryable: true })
  if (status === 429 || status >= 500) return new SyncProviderError({ code: 'server', message, status, retryable: true })
  return new SyncProviderError({ code: 'unknown', message, status, retryable: false })
}

/** 把任何例外轉成 SyncProviderError（fetch 失敗的 TypeError 視為網路錯誤） */
export function toSyncError(e: unknown): SyncProviderError {
  if (e instanceof SyncProviderError) return e
  if (e instanceof TypeError) return new SyncProviderError({ code: 'network', message: e.message, retryable: true })
  return new SyncProviderError({ code: 'unknown', message: e instanceof Error ? e.message : String(e), retryable: false })
}

export const browserIsOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

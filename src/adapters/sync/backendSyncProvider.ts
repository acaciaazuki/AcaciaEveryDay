import { z } from 'zod'
import { busyProjectionRuleSchema, roleOf, toWireRule } from '../../core/sharing'
import { selectPushableChanges, spaceSyncPayloadSchema, SPACE_SYNC_PAYLOAD_VERSION, syncConflictSchema, syncEntrySchema, type SpaceSyncPayload } from '../../core/syncEnvelope'
import {
  browserIsOnline,
  createStatusTracker,
  errorFromStatus,
  SyncProviderError,
  toSyncError,
  type PullRequest,
  type PullResult,
  type PushRequest,
  type PushResult,
  type SyncProvider,
} from './types'

/**
 * 未來後端 API 的同步適配器（骨架）。多人協作時，家人／同學／同事的資料要經過伺服器交換，
 * Drive 的 appDataFolder 只有本人讀得到，做不到跨帳號分享，所以需要這一層。
 *
 * ── 伺服器端權限驗證（必須做，不能只靠用戶端）──
 * - 身分只看 Authorization token，不相信請求內容裡的 userId／createdBy
 * - pull：伺服器用和 core/permissions.ts 相同的規則過濾（busy_only、selected_members、
 *   hiddenUserIds、maskedFields、private），只回傳過濾後的副本；原始內容絕不離開伺服器
 * - push：逐筆檢查 canEdit；非建立者送來的 visibility 一律忽略；redaction／projection 副本拒收
 * - 忙閒投射區塊由伺服器依規則產生，或只接受規則擁有者本人的投射
 *
 * ── 增量拉取（cursor / since）──
 * - GET /v1/sync/changes?since=<cursor>，cursor 對用戶端不透明（伺服器可用序號或時間戳記）
 * - hasMore=true 時用新的 cursor 繼續拉，直到拉完
 * - 權限被收回時，伺服器要送「收回墓碑」讓用戶端刪掉舊副本
 *
 * ── 軟刪除同步 ──
 * - 刪除是一筆 deletedAt 不為 null 的變更（墓碑），內容清空
 * - 伺服器保留墓碑至少到所有裝置的 cursor 都超過它，之後才可以清除
 *
 * ── iOS（Capacitor）／多端協作的銜接點 ──
 * - getToken：網頁用 Google 登入；iOS 可換成 Sign in with Apple／原生 Google 登入
 * - fetch：iOS 可注入 CapacitorHttp 版本的 fetch（避開 WKWebView 的 CORS 限制）
 * - deviceId：每台裝置固定的 id，伺服器用來追蹤各裝置 cursor 與清除墓碑
 * - 即時更新：之後可加上 WebSocket／APNs 推播，收到通知時呼叫 pull 即可，介面不用改
 */

export const BACKEND_API_VERSION = 'v1'

export interface BackendSyncConfig {
  baseUrl: string
  getToken: () => string | null | Promise<string | null>
  deviceId?: string
  fetch?: typeof fetch
  now?: () => number
  isOnline?: () => boolean
  /** 一次 pull 最多翻幾頁，避免伺服器 bug 造成無限迴圈 */
  maxPages?: number
}

const pullResponseSchema = z.object({
  cursor: z.string().nullable(),
  hasMore: z.boolean().default(false),
  payloads: z.array(spaceSyncPayloadSchema),
  busyProjectionRules: z.array(busyProjectionRuleSchema).default([]),
})

const pushResponseSchema = z.object({
  accepted: z.array(z.string()),
  rejected: z.array(z.object({ id: z.string(), reason: z.enum(['stale', 'forbidden', 'invalid']) })).default([]),
  conflicts: z.array(syncConflictSchema).default([]),
  cursor: z.string().nullable(),
})

/** 送到伺服器的推送內容（身分由 token 決定，所以不帶 viewerId） */
export const pushRequestBodySchema = z.object({
  payloadVersion: z.literal(SPACE_SYNC_PAYLOAD_VERSION),
  deviceId: z.string().optional(),
  changes: z.array(syncEntrySchema),
  busyProjectionRules: z.array(busyProjectionRuleSchema),
})
export type PushRequestBody = z.infer<typeof pushRequestBodySchema>

/**
 * 用戶端的第二道防線：即使伺服器回了不該給的東西，也不收進本機。
 * 檢視者不是成員的空間整包丟掉；spaceId 不符的變更丟掉。
 */
export function sanitizeIncomingPayload(p: SpaceSyncPayload, viewerId: string): SpaceSyncPayload | null {
  if (p.viewerId !== viewerId || !roleOf(p.space, viewerId)) return null
  return { ...p, entries: p.entries.filter((e) => e.spaceId === p.spaceId) }
}

export function createBackendSyncProvider(config: BackendSyncConfig): SyncProvider {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const now = config.now ?? Date.now
  const isOnline = config.isOnline ?? browserIsOnline
  const maxPages = config.maxPages ?? 20
  const base = config.baseUrl.replace(/\/+$/, '')
  const status = createStatusTracker()

  async function begin(): Promise<string> {
    if (!isOnline()) {
      const err = new SyncProviderError({ code: 'network', message: 'offline', retryable: true })
      status.set({ state: 'offline', error: err.toInfo() })
      throw err
    }
    const token = await config.getToken()
    if (!token) {
      const err = new SyncProviderError({ code: 'auth', message: '尚未登入', retryable: false })
      status.set({ state: 'error', error: err.toInfo() })
      throw err
    }
    status.set({ state: 'syncing', error: null })
    return token
  }

  function fail(e: unknown): never {
    const err = toSyncError(e)
    const state = err.code === 'network' ? 'offline' : err.code === 'conflict' ? 'conflict' : 'error'
    status.set({ state, error: err.toInfo() })
    throw err
  }

  async function request<T>(token: string, path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    if (config.deviceId) headers['X-Acacia-Device'] = config.deviceId
    if (init.body) headers['Content-Type'] = 'application/json'
    const res = await doFetch(`${base}/${BACKEND_API_VERSION}${path}`, { ...init, headers })
    if (!res.ok) throw errorFromStatus(res.status)
    const parsed = schema.safeParse(await res.json())
    if (!parsed.success) throw new SyncProviderError({ code: 'invalid_payload', message: parsed.error.message, retryable: false })
    return parsed.data
  }

  return {
    id: 'backend',
    getStatus: status.get,
    subscribe: status.subscribe,

    async pull({ viewerId, since }: PullRequest): Promise<PullResult> {
      const token = await begin()
      try {
        let cursor = since
        const payloads: SpaceSyncPayload[] = []
        const rules = new Map<string, PullResult['rules'][number]>()
        for (let page = 0; page < maxPages; page++) {
          const q = cursor === null ? '' : `?since=${encodeURIComponent(cursor)}`
          const res = await request(token, `/sync/changes${q}`, pullResponseSchema)
          for (const p of res.payloads) {
            const safe = sanitizeIncomingPayload(p, viewerId)
            if (safe) payloads.push(safe)
          }
          // 規則是個人設定：只收自己的
          for (const r of res.busyProjectionRules) if (r.userId === viewerId) rules.set(r.id, r)
          cursor = res.cursor ?? cursor
          if (!res.hasMore) break
        }
        status.set({ state: 'idle', lastSyncedAt: now(), cursor, conflicts: [] })
        return { payloads, rules: [...rules.values()], cursor }
      } catch (e) {
        fail(e)
      }
    },

    async push({ viewerId, data, changedSince }: PushRequest): Promise<PushResult> {
      const token = await begin()
      try {
        if (data.ownerId !== viewerId) throw new SyncProviderError({ code: 'forbidden', message: '只能推送自己的資料', retryable: false })
        const body: PushRequestBody = {
          payloadVersion: SPACE_SYNC_PAYLOAD_VERSION,
          deviceId: config.deviceId,
          changes: selectPushableChanges(data, viewerId, changedSince),
          // 能用 v1 表示的規則附上 v1 欄位，舊版伺服器／App 也讀得懂
          busyProjectionRules: data.busyProjectionRules.filter((r) => r.userId === viewerId).map(toWireRule),
        }
        const res = await request(token, '/sync/changes', pushResponseSchema, { method: 'POST', body: JSON.stringify(body) })
        status.set({ state: res.conflicts.length ? 'conflict' : 'idle', lastSyncedAt: now(), cursor: res.cursor, conflicts: res.conflicts, error: null })
        return res
      } catch (e) {
        fail(e)
      }
    },

    async disconnect() {
      status.reset()
    },
  }
}

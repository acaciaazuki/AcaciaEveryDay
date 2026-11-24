import { z } from 'zod'
import { busyProjectionRuleSchema, type BusyProjectionRule, type Space } from '../../core/sharing'
import {
  buildViewerExport,
  containsLocalOnlyData,
  mergeSyncEntries,
  spaceSyncPayloadSchema,
  type SpaceSyncPayload,
  type SyncConflict,
} from '../../core/syncEnvelope'
import { download, DriveError, findFile, SPACES_DRIVE_FILE, upload } from '../drive'
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
 * Google Drive 版的共享行事曆同步（使用者自己的 appDataFolder，單人多裝置）。
 *
 * 跟既有機制並存、不互相干擾：
 * - 只讀寫 acacia_spaces_v1.json；不碰 acacia_data_v2.json（useSyncStore）與 acacia_backup_v2.json（useBackupStore）
 * - 沿用 useSyncStore 的 Google 登入 token（getToken 注入），登出仍由 useSyncStore 負責
 * - 刪除所有資料時，deleteAllData 的 CLOUD_FILES 已包含這個檔案
 *
 * 隱私：檔案內容是 buildViewerExport(data, 自己) 的結果，也就是「自己看得到的版本」，
 * 別人的 busy_only／遮罩行程以過濾後的副本存放，原始內容不會因為同步而寫進自己的 Drive。
 *
 * 衝突處理：Drive 沒有交易，採「讀 → 合併 → 寫」：
 * - 同一筆行程依 version → updatedAt → 刪除優先 → updatedBy 決定勝負（見 core/syncEnvelope.ts 的 pickWinner）
 * - 有衝突時狀態變成 conflict（仍會寫入合併後的結果），讓畫面提示使用者確認
 * - 雲端檔案壞掉（驗證失敗）時不覆寫，回報 invalid_payload
 */

export const DRIVE_SPACES_FILE_KIND = 'acacia-spaces'
export const DRIVE_SPACES_FILE_VERSION = 1

export const driveSpacesFileSchema = z.object({
  kind: z.literal(DRIVE_SPACES_FILE_KIND),
  fileVersion: z.literal(DRIVE_SPACES_FILE_VERSION),
  ownerId: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  payloads: z.array(spaceSyncPayloadSchema),
  busyProjectionRules: z.array(busyProjectionRuleSchema).default([]),
})
export type DriveSpacesFile = z.infer<typeof driveSpacesFileSchema>

/** 用得到的 Drive 操作（測試時換成假的） */
export interface DriveApi {
  findFile: (token: string, name: string) => Promise<string | null>
  download: (token: string, id: string) => Promise<unknown>
  upload: (token: string, id: string | null, name: string, data: unknown) => Promise<string>
}

export interface DriveSyncDeps {
  /** 目前的 Google 存取 token（通常是 () => useSyncStore.getState().token） */
  getToken: () => string | null | Promise<string | null>
  drive?: DriveApi
  now?: () => number
  isOnline?: () => boolean
}

const realDrive: DriveApi = { findFile, download, upload }

const maxCursor = (a: string | null, b: number | null) => {
  const n = Math.max(a === null ? -1 : Number(a), b ?? -1)
  return n < 0 ? null : String(n)
}

function driveError(e: unknown): SyncProviderError {
  if (e instanceof DriveError && e.status !== undefined) return errorFromStatus(e.status, e.message)
  return toSyncError(e)
}

const asThisDevice = (c: SyncConflict): SyncConflict => ({
  id: c.id,
  spaceId: c.spaceId,
  localVersion: c.incomingVersion,
  incomingVersion: c.localVersion,
  localUpdatedAt: c.incomingUpdatedAt,
  incomingUpdatedAt: c.localUpdatedAt,
  winner: c.winner === 'local' ? 'incoming' : 'local',
})

const newerSpace = (a: Space, b: Space) => (b.version > a.version || (b.version === a.version && b.updatedAt > a.updatedAt) ? b : a)

/** 合併規則：同 id 以 updatedAt 較新的為準 */
function mergeRules(remote: readonly BusyProjectionRule[], local: readonly BusyProjectionRule[]): BusyProjectionRule[] {
  const byId = new Map(remote.map((r) => [r.id, r]))
  for (const r of local) {
    const cur = byId.get(r.id)
    if (!cur || r.updatedAt >= cur.updatedAt) byId.set(r.id, r)
  }
  return [...byId.values()]
}

export function createDriveSyncProvider(deps: DriveSyncDeps): SyncProvider {
  const drive = deps.drive ?? realDrive
  const now = deps.now ?? Date.now
  const isOnline = deps.isOnline ?? browserIsOnline
  const status = createStatusTracker()
  let fileId: string | null = null

  async function begin(): Promise<string> {
    if (!isOnline()) {
      const err = new SyncProviderError({ code: 'network', message: 'offline', retryable: true })
      status.set({ state: 'offline', error: err.toInfo() })
      throw err
    }
    const token = await deps.getToken()
    if (!token) {
      const err = new SyncProviderError({ code: 'auth', message: '尚未登入 Google', retryable: false })
      status.set({ state: 'error', error: err.toInfo() })
      throw err
    }
    status.set({ state: 'syncing', error: null })
    return token
  }

  function fail(e: unknown): never {
    const err = driveError(e)
    if (err.code === 'not_found') fileId = null // 檔案被刪掉了，下次重新尋找
    status.set({ state: err.code === 'network' ? 'offline' : 'error', error: err.toInfo() })
    throw err
  }

  /** 讀雲端檔案；不存在回傳 null，格式錯誤丟出 invalid_payload */
  async function readRemote(token: string, viewerId: string): Promise<DriveSpacesFile | null> {
    fileId ??= await drive.findFile(token, SPACES_DRIVE_FILE)
    if (!fileId) return null
    const parsed = driveSpacesFileSchema.safeParse(await drive.download(token, fileId))
    if (!parsed.success) throw new SyncProviderError({ code: 'invalid_payload', message: parsed.error.message, retryable: false })
    if (parsed.data.ownerId !== viewerId) {
      throw new SyncProviderError({ code: 'forbidden', message: '雲端檔案屬於另一位使用者', retryable: false })
    }
    return parsed.data
  }

  return {
    id: 'drive',
    getStatus: status.get,
    subscribe: status.subscribe,

    async pull({ viewerId, since }: PullRequest): Promise<PullResult> {
      const token = await begin()
      try {
        const remote = await readRemote(token, viewerId)
        const sinceNum = since === null ? null : Number(since)
        let cursor: string | null = since
        const payloads: SpaceSyncPayload[] = (remote?.payloads ?? []).map((p) => {
          const entries = sinceNum === null ? p.entries : p.entries.filter((e) => e.updatedAt > sinceNum)
          for (const e of entries) cursor = maxCursor(cursor, e.updatedAt)
          return { ...p, since: sinceNum, entries }
        })
        status.set({ state: 'idle', lastSyncedAt: now(), cursor, conflicts: [] })
        return { payloads, rules: remote?.busyProjectionRules ?? [], cursor }
      } catch (e) {
        fail(e)
      }
    },

    async push({ viewerId, data, changedSince }: PushRequest): Promise<PushResult> {
      const token = await begin()
      try {
        if (data.ownerId !== viewerId) throw new SyncProviderError({ code: 'forbidden', message: '只能上傳自己的資料', retryable: false })
        const at = now()
        const remote = await readRemote(token, viewerId)
        // 一律重新依權限產生（呼叫端傳進來的資料不能繞過過濾）
        const local = buildViewerExport(data, viewerId, at)
        const remoteBySpace = new Map((remote?.payloads ?? []).map((p) => [p.spaceId, p]))

        const conflicts: SyncConflict[] = []
        const accepted: string[] = []
        const rejected: PushResult['rejected'] = []
        const payloads: SpaceSyncPayload[] = []
        let cursor: string | null = null

        for (const mine of local) {
          const theirs = remoteBySpace.get(mine.spaceId)
          remoteBySpace.delete(mine.spaceId)
          const merged = mergeSyncEntries(theirs?.entries ?? [], mine.entries, { viewerId })
          // 以雲端為底合併本機變更；回報時翻轉成「local = 這台裝置」的視角
          conflicts.push(...merged.conflicts.map(asThisDevice))
          const finalById = new Map(merged.items.map((i) => [i.id, i]))
          for (const e of mine.entries) {
            if (changedSince !== null && e.updatedAt <= changedSince) continue
            const kept = finalById.get(e.id)
            const same = kept && kept.version === e.version && kept.updatedAt === e.updatedAt && kept.updatedBy === e.updatedBy
            if (same) accepted.push(e.id)
            else rejected.push({ id: e.id, reason: 'stale' }) // 雲端有較新的版本，下次 pull 會拿到
          }
          for (const i of merged.items) cursor = maxCursor(cursor, i.updatedAt)
          payloads.push({ ...mine, space: theirs ? newerSpace(theirs.space, mine.space) : mine.space, since: null, cursor, entries: merged.items })
        }
        // 其他裝置新增、這台還沒拉到的空間：保留，不要覆蓋掉
        for (const p of remoteBySpace.values()) {
          payloads.push(p)
          for (const i of p.entries) cursor = maxCursor(cursor, i.updatedAt)
        }

        const file: DriveSpacesFile = {
          kind: DRIVE_SPACES_FILE_KIND,
          fileVersion: DRIVE_SPACES_FILE_VERSION,
          ownerId: viewerId,
          updatedAt: at,
          payloads,
          busyProjectionRules: mergeRules(remote?.busyProjectionRules ?? [], data.busyProjectionRules.filter((r) => r.userId === viewerId)),
        }
        // 上傳前的最後保險：本機專屬資料不能出現在雲端檔案裡
        if (containsLocalOnlyData(file)) throw new SyncProviderError({ code: 'invalid_payload', message: '同步內容含有本機專屬資料', retryable: false })
        // 驗證後再上傳，確保寫出去的一定是讀得回來的格式
        const checked = driveSpacesFileSchema.parse(file)
        fileId = await drive.upload(token, fileId, SPACES_DRIVE_FILE, checked)

        status.set({ state: conflicts.length ? 'conflict' : 'idle', lastSyncedAt: at, cursor, conflicts, error: null })
        return { accepted, rejected, conflicts, cursor }
      } catch (e) {
        fail(e)
      }
    },

    async disconnect() {
      fileId = null
      status.reset()
    },
  }
}

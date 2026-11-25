import { kv } from '../adapters/kv'
import { eventSchema, type CalendarEvent } from '../core/schema'
import { useAppStore } from './useAppStore'
import { useBackupStore } from './useBackupStore'

/**
 * 共享行事曆功能移除後的一次性轉換：
 * 舊版把共享空間存在本機的 acacia-spaces（跟個人資料 acacia-next 分開）。第一次開啟新版時：
 * 1. 讀出舊的共享空間資料；沒有就什麼都不做
 * 2. 把「自己建立、還沒刪除」的共享行程轉成個人行程（地點與細節併進備註；跨日行程保留結束日）
 * 3. 轉換前先替個人資料留一份本機快照（原因：轉換共享行程前），並把舊的共享資料原樣另存一份
 * 4. 加進個人行程後，清掉本機的 acacia-spaces 與共享空間快照
 * 任何一步失敗（例如資料損毀）就整個跳過、不清除，也不影響畫面；下次開啟會再試一次。
 * Google Drive 上的 acacia_spaces_v1.json 不動，只在「刪除所有資料」時一併刪除。
 */
export const LEGACY_SPACES_KEY = 'acacia-spaces'
/** 舊的共享空間資料原樣另存的位置（在主資料快照的資料庫裡，「刪除所有資料」會一起清掉） */
export const LEGACY_SPACES_COPY_KEY = 'legacy:acacia-spaces'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * 舊的共享空間資料 → 要加進來的個人行程（純函式，不改動輸入）。
 * raw 是 zustand persist 存的內容（JSON 字串或已解析的物件）；格式看不懂時回傳空陣列。
 * existingIds：已經有的個人行程 id，加上同步刪除標記裡的行程 id（已永久刪除的）。撞到時視為「已經轉換過」直接略過（冪等）：
 * 例如另一台裝置已經轉換並同步過來、或上次轉換到一半中斷，重跑都不會多出重複的行程，
 * 也不會把已經移到「最近刪除」或已經永久刪除的行程救回來。共享行程的 id 是隨機 UUID，不會跟一般個人行程撞到。
 */
export function legacySharedToEvents(raw: unknown, existingIds: ReadonlySet<string>): CalendarEvent[] {
  let root: unknown = raw
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root)
    } catch {
      return []
    }
  }
  const state = isObj(root) && isObj(root.state) ? root.state : null
  const data = state && isObj(state.data) ? state.data : null
  if (!state || !data) return []
  const selfId = str(state.selfId) || str(data.ownerId)
  if (!selfId) return []
  const liveSpaces = new Set((Array.isArray(data.spaces) ? data.spaces : []).filter((s): s is Obj => isObj(s) && (s.deletedAt === null || s.deletedAt === undefined)).map((s) => str(s.id)))

  const used = new Set(existingIds)
  const out: CalendarEvent[] = []
  for (const it of Array.isArray(data.items) ? data.items : []) {
    if (!isObj(it)) continue
    // 只轉自己建立、還沒刪除、所在空間還在的原生行程；忙碌投射區塊與別人的（過濾過的）副本不轉
    if (str(it.createdBy) !== selfId || (it.deletedAt !== null && it.deletedAt !== undefined) || it.redaction || it.projection) continue
    if (!liveSpaces.has(str(it.spaceId))) continue
    const title = str(it.title).trim()
    if (!title) continue
    const details = isObj(it.details) ? Object.values(it.details).filter((v): v is string => typeof v === 'string' && v.trim() !== '') : []
    const endDate = str(it.endDateISO)
    const note = [str(it.note), str(it.location), ...details].map((x) => x.trim()).filter(Boolean).join(' · ')
    const endDateISO = endDate && endDate > str(it.dateISO) ? endDate : ''
    const id = str(it.id)
    if (!id || used.has(id)) continue
    const parsed = eventSchema.safeParse({
      id,
      title,
      dateISO: str(it.dateISO),
      ...(endDateISO && { endDateISO }),
      start: str(it.start),
      end: str(it.end),
      note,
      ...(typeof it.titleColor === 'string' && { titleColor: it.titleColor }),
      ...(typeof it.bgColor === 'string' && { bgColor: it.bgColor }),
      ...(typeof it.icon === 'string' && { icon: it.icon }),
    })
    // 個別欄位格式不對（例如圖示是新版才有的）：去掉圖示再試一次；還是不行就略過這一筆
    const ok = parsed.success ? parsed.data : eventSchema.safeParse({ id, title, dateISO: str(it.dateISO), ...(endDateISO && { endDateISO }), start: str(it.start), end: str(it.end), note }).data
    if (!ok || !ok.dateISO) continue
    used.add(ok.id)
    out.push(ok)
  }
  return out
}

/** 目前已知的行程 id：個人行程，以及同步刪除標記（syncMeta.del 的 events:<id>）裡已永久刪除的 */
function knownEventIds(): Set<string> {
  const { events, syncMeta } = useAppStore.getState()
  const ids = new Set(events.map((e) => e.id))
  for (const key of Object.keys(syncMeta?.del ?? {})) if (key.startsWith('events:')) ids.add(key.slice('events:'.length))
  return ids
}

let running: Promise<number> | null = null

/** 執行轉換；回傳加進來的行程數。只會同時跑一次 */
export function migrateLegacySpaces(): Promise<number> {
  running ??= (async () => {
    try {
      const state = kv('state')
      const raw = await state.get(LEGACY_SPACES_KEY)
      if (raw === undefined || raw === null) return 0
      const events = legacySharedToEvents(raw, knownEventIds())
      // 先備份：個人資料快照＋舊的共享資料原樣另存
      await useBackupStore.getState().backupNow('beforeMigration')
      await kv('backups').set(LEGACY_SPACES_COPY_KEY, raw)
      // 備份是非同步的，期間雲端同步可能已經帶進同一批行程：加入前再比對一次，只加真的還沒有的
      const have = knownEventIds()
      const fresh = events.filter((e) => !have.has(e.id))
      if (fresh.length) useAppStore.getState().restoreEvents(fresh)
      await state.del(LEGACY_SPACES_KEY)
      await kv('spacesBackups').clear()
      return fresh.length
    } catch (e) {
      console.error('舊的共享行事曆資料轉換失敗，已略過（資料保留原樣，下次開啟會再試）', e)
      return 0
    } finally {
      running = null
    }
  })()
  return running
}

const hydrated = () =>
  useAppStore.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => useAppStore.persist.onFinishHydration(() => r()))

/** App 啟動時呼叫一次（main.tsx，同意使用條款之後；個人資料讀取完成才轉換） */
export function startLegacySpacesMigration() {
  void hydrated().then(() => migrateLegacySpaces())
}

import type { AppData, SyncMeta } from './schema'

/**
 * 主資料（AppData）的逐筆同步：兩台裝置各自離線修改後，合併時每一筆分別取較新的版本，不會整份被蓋掉。
 *
 * 規則：
 * - 清單（行程、待辦、記帳、地點…）每一筆各自比較修改時間，較新的勝出
 * - 刪除留下刪除標記；刪除時間比另一邊的修改晚才刪除（另一邊之後又改過就保留）
 * - 只在一邊存在、另一邊也沒有刪除標記的紀錄一律保留（離線新增的資料不會遺失）
 * - 清單的順序（例如最愛地點的自訂順序）也是一筆紀錄：以較新的順序為準，另一邊新增的接在後面
 * - 設定逐欄位比較；其他欄位（例如庫存分類、範例是否已帶入）整個欄位比較
 * - 時間相同時用內容排序決定，確保每台裝置合併出一樣的結果
 * - 沒有修改紀錄的舊資料：每一筆都當作整份 updatedAt 的時間（跟舊版「較新的整份勝出」一致）
 */

/** 每種清單怎麼取得一筆紀錄的識別 */
const COLLECTIONS = {
  events: (x: { id: string }) => x.id,
  tasks: (x: { id: string }) => x.id,
  shopping: (x: { id: string }) => x.id,
  places: (x: { id: string }) => x.id,
  favorites: (x: string) => x,
  reminders: (x: { id: string }) => x.id,
  archives: (x: { start: string }) => x.start,
  subscriptions: (x: { id: string }) => x.id,
  inventory: (x: { id: string }) => x.id,
  recurring: (x: { id: string }) => x.id,
  holidays: (x: { country: string; year: number }) => `${x.country}-${x.year}`,
} as const
type CollectionName = keyof typeof COLLECTIONS
const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[]
/** 整個欄位一起比較的欄位 */
const FIELDS = ['subscriptionsSeeded', 'inventorySeeded', 'invCats'] as const

/** 刪除標記保留多久：超過就清掉（離線超過這麼久的裝置，刪掉的資料可能會回來） */
export const TOMBSTONE_TTL = 180 * 24 * 60 * 60 * 1000

const keyOf = (name: CollectionName, item: unknown) => (COLLECTIONS[name] as (x: unknown) => string)(item)
const itemsOf = (data: AppData, name: CollectionName) => data[name] as unknown[]

/** 內容比較用：物件 key 排序後的 JSON，順序不同但內容相同時結果一樣 */
export function canonical(value: unknown): string {
  // undefined（例如沒設定的設定欄位）回傳空字串，比較時才不會出錯
  return (
    JSON.stringify(value, (_k, v: unknown) =>
      v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
    ) ?? ''
  )
}

/**
 * 內容是否相同（結果跟比較 canonical 字串一樣，但不用把整筆資料轉成字串，快很多）：
 * 物件不看 key 順序、值是 undefined 的 key 視為不存在（跟 JSON 一樣）。
 */
export function sameContent(x: unknown, y: unknown): boolean {
  if (x === y) return true
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) {
    // JSON 裡 undefined 不存在、NaN 變成 null；資料本身不會出現這些，這裡只求跟 canonical 一致
    return x === undefined && y === undefined
  }
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (!sameContent(x[i], y[i])) return false
    return true
  }
  const a = x as Record<string, unknown>
  const b = y as Record<string, unknown>
  let n = 0
  for (const k in a) {
    if (a[k] === undefined) continue
    n++
    if (!sameContent(a[k], b[k])) return false
  }
  for (const k in b) if (b[k] !== undefined) n--
  return n === 0
}

const emptyMeta = (base: number): SyncMeta => ({ base, t: {}, del: {} })

/**
 * 依修改前後的資料，更新修改紀錄（store 每次寫入時呼叫）。
 * 同一個物件參照視為沒改；參照不同時再比對內容，只記錄真的有變的紀錄。
 */
export function trackChanges(prev: AppData, next: AppData, now: number): SyncMeta {
  const before = prev.syncMeta ?? emptyMeta(prev.updatedAt)
  // 有變動時才複製修改紀錄；完全沒變時回傳原本的物件（store 就不用重寫、也不會多存一次）
  let t = before.t
  let del = before.del
  let changed = false
  const own = () => {
    if (changed) return
    changed = true
    t = { ...before.t }
    del = { ...before.del }
  }
  const touch = (key: string) => {
    if (t[key] === now && !(key in del)) return
    own()
    t[key] = now
    delete del[key]
  }
  const remove = (key: string) => {
    if (del[key] === now && !(key in t)) return
    own()
    del[key] = now
    delete t[key]
  }

  for (const name of COLLECTION_NAMES) {
    const a = itemsOf(prev, name)
    const b = itemsOf(next, name)
    if (a === b) continue
    const prevById = new Map(a.map((x) => [keyOf(name, x), x]))
    const nextById = new Map(b.map((x) => [keyOf(name, x), x]))
    for (const [id, item] of nextById) {
      const old = prevById.get(id)
      if (old === undefined || (old !== item && !sameContent(old, item))) touch(`${name}:${id}`)
    }
    for (const id of prevById.keys()) if (!nextById.has(id)) remove(`${name}:${id}`)
    // 順序：兩邊都有的紀錄，相對順序變了才算（新增、刪除不算改順序）
    const common = (list: unknown[], other: Map<string, unknown>) => list.map((x) => keyOf(name, x)).filter((id) => other.has(id))
    if (common(a, nextById).join('\n') !== common(b, prevById).join('\n')) touch(`${name}:$order`)
  }

  if (prev.settings !== next.settings) {
    const keys = new Set([...Object.keys(prev.settings), ...Object.keys(next.settings)])
    for (const k of keys) {
      const x = (prev.settings as Record<string, unknown>)[k]
      const y = (next.settings as Record<string, unknown>)[k]
      if (x !== y && !sameContent(x, y)) touch(`settings:${k}`)
    }
  }
  for (const f of FIELDS) if (prev[f] !== next[f] && !sameContent(prev[f], next[f])) touch(`field:${f}`)

  if (!changed) return before
  return { base: before.base, t, del }
}

/** 一邊的資料：修改紀錄（舊資料沒有時以整份 updatedAt 為準） */
function sideOf(data: AppData) {
  const meta = data.syncMeta ?? emptyMeta(data.updatedAt)
  return { data, meta, time: (key: string) => meta.t[key] ?? meta.base, deleted: (key: string) => meta.del[key] }
}
type Side = ReturnType<typeof sideOf>

/**
 * 兩邊對同一個 key 的結果：誰的版本勝出、或已刪除。
 * 比較「本機修改」「本機刪除」「雲端修改」「雲端刪除」四個時間，最新的那個決定結果；
 * 時間相同時刪除優先（避免刪掉的又復活），再用內容排序，確保每台裝置結果一致。
 * 內容排序要把資料轉成字串，很花時間，所以只在兩邊修改時間剛好相同、內容又不一樣時才做。
 */
function decide(key: string, a: Side, aHas: boolean, aValue: unknown, b: Side, bHas: boolean, bValue: unknown): { keep: 'a' | 'b' | null; time: number } {
  const at = aHas ? a.time(key) : -Infinity
  const bt = bHas ? b.time(key) : -Infinity
  const ad = a.deleted(key)
  const bd = b.deleted(key)
  const delTime = Math.max(ad ?? -Infinity, bd ?? -Infinity)
  const liveTime = Math.max(at, bt)
  if (delTime !== -Infinity && delTime >= liveTime) return { keep: null, time: delTime }
  if (at > bt) return { keep: 'a', time: at }
  if (bt > at) return { keep: 'b', time: bt }
  // 時間相同：內容一樣就用本機的；不一樣時內容排序較大的勝出
  if (sameContent(aValue, bValue)) return { keep: 'a', time: at }
  return { keep: canonical(aValue) > canonical(bValue) ? 'a' : 'b', time: at }
}

/** 合併結果，加上「跟本機一樣嗎」「跟雲端一樣嗎」（不看 updatedAt），同步時用來決定要不要套用、要不要上傳 */
export interface MergeResult {
  data: AppData
  sameAsLocal: boolean
  sameAsRemote: boolean
}

/**
 * 合併兩份主資料（local：這台裝置；remote：雲端）。純函式，不改動輸入。
 * now 用來清掉太舊的刪除標記。
 */
export function mergeAppData(local: AppData, remote: AppData, now: number): AppData {
  return mergeAppDataWithDiff(local, remote, now).data
}

/**
 * 同 mergeAppData，並在逐筆比較的同時判斷結果跟兩邊是否相同，
 * 不必事後再把整份資料轉成字串比對（資料多時那一步非常慢，手機會卡住）。
 */
export function mergeAppDataWithDiff(local: AppData, remote: AppData, now: number): MergeResult {
  const a = sideOf(local)
  const b = sideOf(remote)
  const base = Math.min(a.meta.base, b.meta.base)
  let sameAsLocal = true
  let sameAsRemote = true
  /** 修改時間等於 base 的不用記（沒記的就當作 base），兩邊同步後的修改紀錄才會完全相同、不會一直重新上傳 */
  const t: Record<string, number> = {}
  const record = (key: string, time: number) => {
    if (time !== base) t[key] = time
  }
  const del: Record<string, number> = {}
  const keepTombstone = (key: string, time: number) => {
    if (now - time < TOMBSTONE_TTL) del[key] = time
  }
  const out = { ...local } as AppData
  /** 合併後還存在的紀錄（修改時間等於 base 時不會寫進 t，另外記下來） */
  const kept = new Set<string>()

  for (const name of COLLECTION_NAMES) {
    const aItems = itemsOf(local, name)
    const bItems = itemsOf(remote, name)
    const aById = new Map(aItems.map((x) => [keyOf(name, x), x]))
    const bById = new Map(bItems.map((x) => [keyOf(name, x), x]))
    const result = new Map<string, unknown>()
    for (const id of new Set([...aById.keys(), ...bById.keys()])) {
      const key = `${name}:${id}`
      const aHas = aById.has(id)
      const bHas = bById.has(id)
      const r = decide(key, a, aHas, aById.get(id), b, bHas, bById.get(id))
      if (r.keep === null) {
        keepTombstone(key, r.time)
        if (aHas) sameAsLocal = false
        if (bHas) sameAsRemote = false
      } else {
        const value = r.keep === 'a' ? aById.get(id) : bById.get(id)
        result.set(id, value)
        kept.add(key)
        record(key, r.time)
        // 勝出的那一邊一定相同；另一邊要比對內容（兩邊都有、內容又一樣時也算相同）
        const otherHas = r.keep === 'a' ? bHas : aHas
        const same = otherHas && sameContent(aById.get(id), bById.get(id))
        if (r.keep === 'a' && !same) sameAsRemote = false
        if (r.keep === 'b' && !same) sameAsLocal = false
      }
    }
    // 順序：較新的那一邊為準，另一邊才有的接在後面
    const orderKey = `${name}:$order`
    const aOrder = a.time(orderKey)
    const bOrder = b.time(orderKey)
    const [first, second] = bOrder > aOrder ? [bItems, aItems] : [aItems, bItems]
    const ids = [...new Set([...first, ...second].map((x) => keyOf(name, x)))].filter((id) => result.has(id))
    ;(out as Record<string, unknown>)[name] = ids.map((id) => result.get(id))
    record(orderKey, Math.max(aOrder, bOrder))
    if (sameAsLocal && !sameIds(ids, aItems, name)) sameAsLocal = false
    if (sameAsRemote && !sameIds(ids, bItems, name)) sameAsRemote = false
  }

  const settings: Record<string, unknown> = {}
  const aSettings = local.settings as Record<string, unknown>
  const bSettings = remote.settings as Record<string, unknown>
  for (const k of new Set([...Object.keys(aSettings), ...Object.keys(bSettings)])) {
    const key = `settings:${k}`
    // 設定欄位被清掉（例如重設排序）也算一次修改：沒有值的一邊照樣參與比較
    const r = decide(key, a, true, aSettings[k], b, true, bSettings[k])
    const value = r.keep === 'b' ? bSettings[k] : aSettings[k]
    if (value !== undefined) settings[k] = value
    record(key, r.time)
    if (!sameContent(aSettings[k], bSettings[k])) {
      if (r.keep === 'b') sameAsLocal = false
      else sameAsRemote = false
    }
  }
  out.settings = settings as AppData['settings']

  for (const f of FIELDS) {
    const key = `field:${f}`
    const r = decide(key, a, true, local[f], b, true, remote[f])
    ;(out as Record<string, unknown>)[f] = r.keep === 'b' ? remote[f] : local[f]
    record(key, r.time)
    if (!sameContent(local[f], remote[f])) {
      if (r.keep === 'b') sameAsLocal = false
      else sameAsRemote = false
    }
  }

  // 兩邊都已經沒有這筆紀錄的刪除標記也要保留：還沒同步的第三台裝置手上可能還有舊資料，不能讓它復活
  for (const [key, time] of [...Object.entries(a.meta.del), ...Object.entries(b.meta.del)]) {
    if (t[key] === undefined && !kept.has(key)) keepTombstone(key, Math.max(time, del[key] ?? 0))
  }

  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt)
  out.syncMeta = { base, t, del }
  // 修改紀錄也要一樣（另一台裝置合併時要用），只比對 key 與時間，很快
  if (sameAsLocal && !sameContent(local.syncMeta, out.syncMeta)) sameAsLocal = false
  if (sameAsRemote && !sameContent(remote.syncMeta, out.syncMeta)) sameAsRemote = false
  // 其他欄位（例如 schemaVersion）沿用本機；跟雲端不同時要上傳
  if (sameAsRemote && local.schemaVersion !== remote.schemaVersion) sameAsRemote = false
  return { data: out, sameAsLocal, sameAsRemote }
}

/** 合併後的順序（ids）跟某一邊的清單是否完全一樣 */
function sameIds(ids: readonly string[], items: readonly unknown[], name: CollectionName): boolean {
  if (ids.length !== items.length) return false
  for (let i = 0; i < ids.length; i++) if (ids[i] !== keyOf(name, items[i])) return false
  return true
}

/** 兩份資料內容是否相同（不看 updatedAt；用來判斷要不要套用到本機、要不要上傳） */
export const sameAppData = (x: AppData, y: AppData) => sameContent({ ...x, updatedAt: 0 }, { ...y, updatedAt: 0 })

/**
 * 庫存分類：內建分類＋使用者自訂分類，以及使用者排序（純函式，不依賴 React）。
 *
 * - 內建分類的 key 存在 INV_CATEGORIES，畫面再依語系翻譯；不可刪除
 * - 自訂分類存在 data.invCats.custom（id 以 c_ 開頭），名稱由使用者輸入
 * - 排序存在 data.invCats.order（內建 key 與自訂 id 混排）；空陣列代表預設順序
 * 讀取排序時一律跟目前的分類清單對照：忽略已不存在的、把沒排過的補進去，
 * 舊資料與其他裝置同步來的資料都能安全使用。
 */
import { INV_CAT_NAME_MAX, INV_CATEGORIES, type InvCategory, type InvCats, type InvCustomCat, type InventoryItem } from './schema'

export const BUILTIN_INV_CATS: readonly string[] = INV_CATEGORIES
export const isBuiltinInvCat = (key: string): key is InvCategory => BUILTIN_INV_CATS.includes(key)
export const isCustomInvCat = (key: string) => key.startsWith('c_')

/** 預設順序：內建分類依定義順序，自訂分類依建立先後接在「其他」前面 */
export function defaultInvCatOrder(custom: readonly InvCustomCat[]): string[] {
  const builtins = BUILTIN_INV_CATS.filter((k) => k !== 'other')
  return [...builtins, ...custom.map((c) => c.id), 'other']
}

/**
 * 依使用者存的順序排列所有分類：
 * - 已刪除的自訂分類、未知的 key → 忽略
 * - 存的順序裡沒有的內建分類（之後新增的，例如低溫食材）→ 插在預設順序中前一個分類的後面
 * - 存的順序裡沒有的自訂分類（剛新增的）→ 插在「其他」前面；「其他」不在就放最後
 */
export function orderedInvCatKeys(cats: InvCats): string[] {
  const all = defaultInvCatOrder(cats.custom)
  if (cats.order.length === 0) return all
  const valid = new Set(all)
  const seen = new Set<string>()
  const result: string[] = []
  for (const k of cats.order) {
    if (valid.has(k) && !seen.has(k)) {
      result.push(k)
      seen.add(k)
    }
  }
  // 內建：依預設順序找前一個已在清單裡的分類，插在它後面；前面都沒有就放最前面
  BUILTIN_INV_CATS.forEach((k, i) => {
    if (seen.has(k)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const idx = result.indexOf(BUILTIN_INV_CATS[j])
      if (idx >= 0) {
        at = idx + 1
        break
      }
    }
    result.splice(at, 0, k)
    seen.add(k)
  })
  for (const c of cats.custom) {
    if (seen.has(c.id)) continue
    const other = result.indexOf('other')
    result.splice(other >= 0 ? other : result.length, 0, c.id)
    seen.add(c.id)
  }
  return result
}

/** 順序跟預設一樣時不必存（之後新增的分類才會出現在預設位置） */
export const isDefaultInvCatOrder = (cats: InvCats, keys: readonly string[]) => {
  const d = defaultInvCatOrder(cats.custom)
  return d.length === keys.length && d.every((k, i) => k === keys[i])
}

/** 用品的分類若已不存在（例如在別的裝置刪掉的自訂分類），一律當「其他」 */
export function resolveInvCat(cat: string, cats: InvCats): string {
  if (isBuiltinInvCat(cat)) return cat
  return cats.custom.some((c) => c.id === cat) ? cat : 'other'
}

/** 名稱比對用：全形半形統一、去頭尾空白、不分大小寫 */
export const normCatName = (s: string) => s.normalize('NFKC').trim().toLowerCase()

export type CatNameError = 'empty' | 'tooLong' | 'duplicate'

/**
 * 驗證自訂分類名稱：不可空白、不可超過上限、不可跟現有分類（含內建分類目前語系的名稱）重複。
 * 通過時回傳整理過的名稱。
 */
export function validateCatName(input: string, existingLabels: readonly string[]): { ok: true; name: string } | { ok: false; error: CatNameError } {
  const name = input.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'empty' }
  if ([...name].length > INV_CAT_NAME_MAX) return { ok: false, error: 'tooLong' }
  const n = normCatName(name)
  if (existingLabels.some((l) => normCatName(l) === n)) return { ok: false, error: 'duplicate' }
  return { ok: true, name }
}

/** 新增自訂分類（回傳新的設定與新分類 id）；有排過序時把它插在「其他」前面 */
export function addCustomCat(cats: InvCats, name: string, id: string): InvCats {
  const custom = [...cats.custom, { id, name }]
  if (cats.order.length === 0) return { custom, order: [] }
  return { custom, order: orderedInvCatKeys({ custom, order: cats.order }) }
}

/** 刪除自訂分類：從清單與排序移除，原本屬於它的用品改歸「其他」 */
export function removeCustomCat(cats: InvCats, inventory: InventoryItem[], id: string): { invCats: InvCats; inventory: InventoryItem[]; moved: number } {
  if (!isCustomInvCat(id)) return { invCats: cats, inventory, moved: 0 }
  let moved = 0
  const next = inventory.map((x) => {
    if (x.cat !== id) return x
    moved++
    return { ...x, cat: 'other' }
  })
  return {
    invCats: { custom: cats.custom.filter((c) => c.id !== id), order: cats.order.filter((k) => k !== id) },
    inventory: moved ? next : inventory,
    moved,
  }
}

/** 某分類目前有幾個用品（已不存在的分類算在「其他」） */
export const countInCat = (inventory: InventoryItem[], cats: InvCats, key: string) => inventory.filter((x) => resolveInvCat(x.cat, cats) === key).length

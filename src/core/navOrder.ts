/**
 * 側邊欄區塊的自訂排序（純函式，不依賴 React）。
 *
 * 設定裡只存每個區塊的項目 key 順序（settings.navOrder[區塊]）。
 * 讀取時一律跟程式內建的預設清單對照：
 * - 沒存過 → 用預設順序
 * - 存了已經移除的項目 → 忽略
 * - 之後新增的項目（存的順序裡沒有）→ 依預設順序補在最後
 * 這樣舊資料、其他裝置同步來的資料都能安全使用。
 */

/** 依存的順序排列預設項目；回傳新的陣列，不改動輸入 */
export function applyOrder<T extends { key: string }>(items: readonly T[], saved: readonly string[] | undefined): T[] {
  if (!saved || saved.length === 0) return [...items]
  const byKey = new Map(items.map((i) => [i.key, i]))
  const seen = new Set<string>()
  const ordered: T[] = []
  for (const k of saved) {
    const item = byKey.get(k)
    if (item && !seen.has(k)) {
      ordered.push(item)
      seen.add(k)
    }
  }
  for (const item of items) if (!seen.has(item.key)) ordered.push(item)
  return ordered
}

/** 把 from 位置的項目移到 to 位置；超出範圍時回傳原陣列的複本 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** 順序是否跟預設相同（相同時不必存，之後新增的項目也能維持預設位置） */
export function isDefaultOrder(defaults: readonly string[], keys: readonly string[]): boolean {
  return defaults.length === keys.length && defaults.every((k, i) => k === keys[i])
}

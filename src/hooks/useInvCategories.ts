import { useTranslation } from 'react-i18next'
import { invCatStyle } from '../core/inventory'
import { isBuiltinInvCat, orderedInvCatKeys, resolveInvCat } from '../core/invCategories'
import type { IconName } from '../core/icons'
import type { InvCats } from '../core/schema'
import { useAppStore } from '../store/useAppStore'

/** 分類名稱：內建分類依語系翻譯，自訂分類用使用者輸入的名稱，找不到時是「其他」 */
export function invCatLabel(cat: string, invCats: InvCats, t: (key: string) => string): string {
  const key = resolveInvCat(cat, invCats)
  return isBuiltinInvCat(key) ? t(`inv.cat.${key}`) : (invCats.custom.find((c) => c.id === key)?.name ?? t('inv.cat.other'))
}

export interface InvCatView {
  key: string
  label: string
  builtin: boolean
  bg: string
  fg: string
  icon: IconName
}

/**
 * 庫存分類（內建＋自訂），依使用者排序；並提供用品分類的名稱與樣式查詢。
 * 用品的分類已不存在時（例如已刪除的自訂分類）一律當「其他」顯示。
 */
export function useInvCategories() {
  const { t } = useTranslation()
  const invCats = useAppStore((s) => s.invCats)
  const nameOf = (key: string) => invCatLabel(key, invCats, t)
  const view = (key: string): InvCatView => ({ key, label: nameOf(key), builtin: isBuiltinInvCat(key), ...invCatStyle(key, invCats.custom.findIndex((c) => c.id === key)) })
  const list = orderedInvCatKeys(invCats).map(view)
  return {
    invCats,
    list,
    /** 用品的分類（已解析，找不到時是 other） */
    of: (cat: string) => view(resolveInvCat(cat, invCats)),
    labelOf: nameOf,
  }
}

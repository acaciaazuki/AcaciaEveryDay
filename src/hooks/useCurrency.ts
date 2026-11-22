import { DEFAULT_CURRENCY } from '../core/schema'
import { useAppStore } from '../store/useAppStore'

/** 設定頁選的預設貨幣；舊資料還沒有這個欄位時回傳 TWD */
export const useCurrency = () => useAppStore((s) => s.settings.currency || DEFAULT_CURRENCY)

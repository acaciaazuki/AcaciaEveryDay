import { useEffect } from 'react'
import { FONT_SCALE } from '../core/schema'
import { useAppStore } from '../store/useAppStore'

/** index.html 的開機小腳本會讀這個 key，讓重新整理時第一個畫面就是對的字體大小 */
export const FONT_SIZE_CACHE_KEY = 'acacia_font_size'

/** 把設定裡的字體大小套到整個網站（CSS 變數 --fs） */
export function useFontScale() {
  const size = useAppStore((s) => s.settings.fontSize)
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(FONT_SCALE[size]))
    try {
      localStorage.setItem(FONT_SIZE_CACHE_KEY, size)
    } catch {
      // 無痕模式等情況讀寫 localStorage 可能失敗，不影響功能
    }
  }, [size])
}

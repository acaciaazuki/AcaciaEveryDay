import { NAV_SECTIONS, type NavItem, type NavSection } from '../app/navSections'
import { applyOrder } from '../core/navOrder'
import { useAppStore } from '../store/useAppStore'

/** 讀取側邊欄某個區塊依使用者設定排列後的項目 */
export function useNavOrder(section: NavSection): NavItem[] {
  const saved = useAppStore((s) => s.settings.navOrder?.[section])
  return applyOrder<NavItem>(NAV_SECTIONS[section], saved)
}

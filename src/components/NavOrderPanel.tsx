import { useTranslation } from 'react-i18next'
import { NAV_SECTIONS, type NavSection } from '../app/navSections'
import { isDefaultOrder } from '../core/navOrder'
import { useNavOrder } from '../hooks/useNavOrder'
import { useAppStore } from '../store/useAppStore'
import { Button } from './Button'
import { SortableList } from './SortableList'

/** 設定頁：調整側邊欄某個區塊的項目順序，可恢復預設 */
export function NavOrderPanel({ section, title }: { section: NavSection; title: string }) {
  const { t } = useTranslation()
  const items = useNavOrder(section)
  const setNavOrder = useAppStore((s) => s.setNavOrder)
  const defaults = NAV_SECTIONS[section].map((i) => i.key)
  const isDefault = isDefaultOrder(defaults, items.map((i) => i.key))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <SortableList
        label={title}
        items={items.map((i) => ({ id: i.key, label: t(`nav.${i.key}`), icon: i.ico }))}
        // 跟預設一樣時不存，之後新增的項目才會出現在預設位置
        onChange={(keys) => setNavOrder(section, isDefaultOrder(defaults, keys) ? null : keys)}
      />
      <div>
        <Button variant="ghost" disabled={isDefault} onClick={() => setNavOrder(section, null)}>
          {t('settings.navOrder.reset')}
        </Button>
      </div>
    </div>
  )
}

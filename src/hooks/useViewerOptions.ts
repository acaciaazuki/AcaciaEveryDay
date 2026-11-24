import { useTranslation } from 'react-i18next'
import { roleOf } from '../core/sharing'
import { useSpacesStore } from '../store/useSpacesStore'

/** 我所屬、未刪除的空間（只用空間與成員名單，不讀行程） */
export function useMySpaces() {
  const spaces = useSpacesStore((s) => s.data.spaces)
  const selfId = useSpacesStore((s) => s.selfId)
  return spaces.filter((s) => roleOf(s, selfId))
}

/** 可以切換的檢視身份：自己＋我所屬空間的其他成員（同一人只列一次） */
export function useViewerOptions() {
  const { t } = useTranslation()
  const selfId = useSpacesStore((s) => s.selfId)
  const seen = new Map<string, string>([[selfId, t('sharing.me')]])
  for (const space of useMySpaces()) for (const m of space.members) if (!seen.has(m.userId)) seen.set(m.userId, m.displayName || t('sharing.unnamed'))
  return [...seen].map(([id, name]) => ({ id, name }))
}

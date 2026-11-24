import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BusyRuleDialog } from './BusySyncRules'
import { useMySpaces, useViewerOptions } from '../hooks/useViewerOptions'
import { useSpacesStore } from '../store/useSpacesStore'

/** 行事曆上方：空間篩選與檢視身份切換 */
export function SpaceSwitcher() {
  const { t } = useTranslation()
  const filter = useSpacesStore((s) => s.filter)
  const setFilter = useSpacesStore((s) => s.setFilter)
  const viewerId = useSpacesStore((s) => s.viewerId)
  const setViewer = useSpacesStore((s) => s.setViewer)
  const spaces = useMySpaces()
  const viewers = useViewerOptions()
  const isSelf = useSpacesStore((s) => s.viewerId === s.selfId)
  const [syncing, setSyncing] = useState(false)
  if (spaces.length === 0) return null

  const tabs = [
    { id: 'all', label: t('sharing.all') },
    { id: 'personal', label: t('sharing.myCalendar') },
    ...spaces.map((s) => ({ id: s.id, label: s.name, kind: t(`sharing.spaceKind.${s.kind}`) })),
  ]
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label={t('sharing.filterLabel')} className="flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-paper p-1.5 shadow-soft">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[length:calc(14px*var(--fs))] font-bold whitespace-nowrap transition ${filter === tab.id ? 'bg-sage text-white' : 'text-muted hover:bg-sage-light hover:text-ink'}`}
          >
            {tab.label}
            {'kind' in tab && <span className="ml-1.5 text-[length:calc(12px*var(--fs))] font-semibold opacity-75">{tab.kind}</span>}
          </button>
        ))}
      </div>
      {/* 切到單一行事曆時的快捷入口：把其他行事曆的忙碌時段同步到這裡（預覽其他成員時不顯示） */}
      {isSelf && filter !== 'all' && (
        <button type="button" onClick={() => setSyncing(true)} className="mr-auto rounded-full px-3 py-1.5 text-[length:calc(13px*var(--fs))] font-semibold text-sage-dark hover:bg-sage-light">
          {t('sharing.rules.shortcut')}
        </button>
      )}
      {syncing && <BusyRuleDialog presetTarget={filter} onClose={() => setSyncing(false)} />}
      {viewers.length > 1 && (
        <label className="flex items-center gap-2.5 text-[length:calc(14px*var(--fs))] font-semibold text-muted">
          {t('sharing.viewerLabel')}
          <select
            value={viewerId}
            onChange={(e) => setViewer(e.target.value)}
            className="rounded-(--radius-control) border border-line bg-paper px-3 py-2 text-[length:calc(14px*var(--fs))] font-semibold text-ink outline-none focus:border-sage"
          >
            {viewers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

/** 正在預覽其他成員的視角時，所有頁面上方都顯示的提示 */
export function ViewerBanner() {
  const { t } = useTranslation()
  const viewerId = useSpacesStore((s) => s.viewerId)
  const selfId = useSpacesStore((s) => s.selfId)
  const setViewer = useSpacesStore((s) => s.setViewer)
  const viewers = useViewerOptions()
  if (viewerId === selfId) return null
  const name = viewers.find((v) => v.id === viewerId)?.name ?? t('sharing.unnamed')
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-(--radius-card) border border-dashed border-sage/50 bg-sage-light px-4 py-2.5 text-xs text-sage-dark">
      <span>{t('sharing.previewBanner', { name })}</span>
      <button type="button" onClick={() => setViewer(selfId)} className="rounded-full bg-paper px-3 py-1 font-bold hover:bg-mint">
        {t('sharing.backToMe')}
      </button>
    </div>
  )
}

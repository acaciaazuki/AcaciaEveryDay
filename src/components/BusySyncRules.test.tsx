import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { visibleCalendar } from '../core/calendarView'
import { PERSONAL_CALENDAR_ID } from '../core/sharing'
import { useSpacesStore } from '../store/useSpacesStore'
import { BusySyncRules } from './BusySyncRules'
import { SharedCard, SharedDetailDialog } from './SharedAgenda'
import { SpaceSwitcher } from './SpaceSwitcher'

const rules = () => useSpacesStore.getState().data.busyProjectionRules.filter((r) => r.deletedAt === null)
const dialog = () => screen.getByRole('dialog')

describe('忙碌時段同步：設定介面', () => {
  let family = ''
  let work = ''
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useSpacesStore.getState().reset()
    family = useSpacesStore.getState().createSpace({ name: '陳家', kind: 'family' })
    work = useSpacesStore.getState().createSpace({ name: '中榮開刀房', kind: 'work' })
  })

  it('新增：預設「我的行事曆 → 全部行事曆」、顯示忙碌；預覽顯示其他成員會看到的樣子', () => {
    render(<BusySyncRules readOnly={false} />)
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增同步規則' }))
    const d = within(dialog())
    expect(d.getByLabelText('來源行事曆')).toHaveValue(PERSONAL_CALENDAR_ID)
    expect(d.getByRole('radio', { name: /全部行事曆/ })).toBeChecked()
    expect(d.getByRole('radio', { name: '忙碌（可自訂文字）' })).toBeChecked()
    // 個人行程沒有隱私等級：不顯示「包含私人行程」
    expect(d.queryByLabelText('包含私人行程')).toBeNull()
    expect(d.getByLabelText(/整天行程也同步/)).not.toBeChecked()
    fireEvent.change(d.getByLabelText('忙碌時顯示的文字'), { target: { value: '有事' } })
    expect(dialog().querySelector('[data-rule-preview]')).toHaveTextContent('「陳家」的成員會看到 → 14:00–16:00 有事')
    fireEvent.click(d.getByRole('button', { name: '儲存' }))

    expect(rules()[0]).toMatchObject({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'all', targetIds: [], display: 'busy', label: '有事', includeAllDay: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('我的行事曆 → 全部行事曆')).toBeInTheDocument()
  })

  it('指定行事曆：沒勾任何一個不能儲存；來源是空間時可以勾「我的行事曆」，也可以包含私人行程', () => {
    render(<BusySyncRules readOnly={false} />)
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增同步規則' }))
    const d = within(dialog())
    fireEvent.change(d.getByLabelText('來源行事曆'), { target: { value: work } })
    fireEvent.click(d.getByRole('radio', { name: '指定行事曆' }))
    const group = within(d.getByRole('group', { name: '指定行事曆' }))
    // 來源本身不會出現在目標裡
    expect(group.getAllByRole('checkbox').map((c) => c.parentElement!.textContent)).toEqual(['我的行事曆', '陳家'])
    fireEvent.click(d.getByRole('button', { name: '儲存' }))
    expect(d.getByRole('alert')).toHaveTextContent('請至少選一個要同步到的行事曆')

    fireEvent.click(group.getByRole('checkbox', { name: '陳家' }))
    fireEvent.click(d.getByRole('radio', { name: '只顯示時間區間' }))
    fireEvent.click(d.getByLabelText('包含私人行程'))
    expect(dialog().querySelector('[data-rule-preview]')).toHaveTextContent('「陳家」的成員會看到 → 14:00–16:00')
    fireEvent.click(d.getByRole('button', { name: '儲存' }))
    expect(rules()[0]).toMatchObject({ sourceId: work, targetMode: 'selected', targetIds: [family], display: 'time_only', label: '', includePrivate: true, legacyTargetId: family })
    expect(screen.getByText('中榮開刀房 → 陳家')).toBeInTheDocument()
    expect(screen.getByText('顯示方式：只顯示時間區間')).toBeInTheDocument()
  })

  it('清單：啟用開關、編輯（不能換來源）、刪除', () => {
    const id = useSpacesStore.getState().addRule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'all', label: '有事' })
    render(<BusySyncRules readOnly={false} />)
    const row = within(document.querySelector(`[data-rule="${id}"]`) as HTMLElement)
    fireEvent.click(row.getByLabelText('啟用'))
    expect(rules()[0]!.enabled).toBe(false)

    fireEvent.click(row.getByRole('button', { name: '編輯' }))
    const d = within(screen.getByRole('dialog', { name: '編輯忙碌時段同步' }))
    expect(d.getByLabelText('來源行事曆')).toBeDisabled()
    expect(d.getByLabelText('忙碌時顯示的文字')).toHaveValue('有事')
    fireEvent.click(d.getByRole('radio', { name: '指定行事曆' }))
    fireEvent.click(d.getByRole('checkbox', { name: '中榮開刀房' }))
    fireEvent.click(d.getByRole('button', { name: '儲存' }))
    // 從全部改成只有一個：其他目標記下來，同步時送墓碑
    expect(rules()[0]).toMatchObject({ targetMode: 'selected', targetIds: [work], retiredTargetIds: [family] })
    expect(screen.getByText('我的行事曆 → 中榮開刀房')).toBeInTheDocument()

    fireEvent.click(row.getByRole('button', { name: '刪除' }))
    expect(rules()).toEqual([])
    expect(screen.getByText('還沒有同步規則')).toBeInTheDocument()
  })

  it('預覽其他成員的視角時唯讀：沒有新增、編輯、刪除', () => {
    useSpacesStore.getState().addRule({ sourceId: PERSONAL_CALENDAR_ID, targetMode: 'all' })
    render(<BusySyncRules readOnly />)
    expect(screen.queryByRole('button', { name: '＋ 新增同步規則' })).toBeNull()
    expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
  })

  it('行事曆切到某個空間時有快捷入口，打開後預先勾選那個空間', () => {
    useSpacesStore.getState().setFilter(family)
    render(<SpaceSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: '同步忙碌時段…' }))
    const d = within(dialog())
    expect(d.getByRole('radio', { name: '指定行事曆' })).toBeChecked()
    expect(d.getByRole('checkbox', { name: '陳家' })).toBeChecked()
    expect(d.getByRole('checkbox', { name: '中榮開刀房' })).not.toBeChecked()
  })

  it('「全部」分頁沒有快捷入口', () => {
    render(<SpaceSwitcher />)
    expect(screen.queryByRole('button', { name: '同步忙碌時段…' })).toBeNull()
  })
})

describe('忙碌時段同步：行事曆上的呈現', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useSpacesStore.getState().reset()
  })

  function ownEntry(display: 'busy' | 'time_only') {
    const st = useSpacesStore.getState()
    const family = st.createSpace({ name: '陳家', kind: 'family' })
    st.addRule({ sourceId: PERSONAL_CALENDAR_ID, targetIds: [family], display, label: '有事' })
    useSpacesStore.getState().setPersonalBusySlots([{ id: 'e1', dateISO: '2026-12-01', start: '14:00', end: '16:00', version: 1, updatedAt: 1, deletedAt: null }])
    const s = useSpacesStore.getState()
    return visibleCalendar(s.data, s.selfId, s.selfId, family).shared.find((e) => e.projected)!
  }

  it('自己投射過去的區塊：顯示文字與「來自我的行事曆」，詳情有來源', () => {
    const entry = ownEntry('busy')
    render(<SharedCard entry={entry} onOpen={() => {}} />)
    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('data-busy-display', 'busy')
    expect(card).toHaveTextContent('有事')
    expect(card.querySelector('[data-projected-from]')).toHaveTextContent('來自我的行事曆')
    render(<SharedDetailDialog entry={entry} previewing={false} onClose={() => {}} />)
    expect(within(screen.getByRole('dialog')).getByText('來源').nextElementSibling).toHaveTextContent('我的行事曆')
  })

  it('只顯示時間：標題就是時間區間、不寫「忙碌」或自訂文字', () => {
    const entry = ownEntry('time_only')
    render(<SharedCard entry={entry} onOpen={() => {}} />)
    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('data-busy-display', 'time_only')
    expect(card.querySelector('strong')).toHaveTextContent('14:00–16:00')
    expect(card).not.toHaveTextContent('有事')
    expect(card).not.toHaveTextContent('忙碌')
  })
})

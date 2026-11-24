import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { visibleCalendar } from '../core/calendarView'
import { emptyAppData } from '../core/schema'
import { PERSONAL_CALENDAR_ID } from '../core/sharing'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { CalendarPage } from './CalendarPage'

const sp = () => useSpacesStore.getState()
const app = () => useAppStore.getState()
const ev = (id: string, title: string, dateISO: string, start = '09:00') => ({ id, title, dateISO, start, end: '10:00', note: '' })
const liveItems = () => sp().data.items.filter((i) => i.deletedAt === null)
const dayBox = (iso: string) => screen.queryByRole('checkbox', { name: `全選 ${iso}` }) as HTMLInputElement | null
const chip = (title: string) => screen.getByRole('checkbox', { name: `選取「${title}」` })
const bar = () => screen.getByRole('toolbar', { name: '批次操作' })

describe('行事曆批次管理', () => {
  let school = ''
  let work = ''
  let family = ''
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0))
    sp().reset()
    useAppStore.setState({ ...emptyAppData(), events: [ev('e1', '早會', '2026-11-10'), ev('e2', '查房', '2026-11-10', '11:00'), ev('e3', '晚餐', '2026-11-12')] })
    school = sp().createSpace({ name: '老服二B', kind: 'school' })
    work = sp().createSpace({ name: '中榮開刀房', kind: 'work' })
    family = sp().createSpace({ name: '陳家', kind: 'family' })
    sp().addItem(work, { title: '刀房排班', dateISO: '2026-11-12', start: '08:00', end: '16:00', location: '第三手術室' })
    // 開刀房的行程以忙碌投射到陳家；11/20 只有投射的忙碌區塊
    sp().addItem(work, { title: '夜班', dateISO: '2026-11-20', start: '20:00', end: '23:00' })
    sp().addRule({ sourceId: work, targetIds: [family], label: '上班中' })
  })
  afterEach(() => vi.useRealTimers())

  const open = () => render(<MemoryRouter><CalendarPage /></MemoryRouter>)
  const startManaging = () => fireEvent.click(screen.getByRole('button', { name: '批次管理' }))

  it('一般瀏覽時沒有勾選框與操作列；進入批次管理後才出現', () => {
    open()
    expect(dayBox('2026-11-10')).toBeNull()
    expect(screen.queryByRole('toolbar')).toBeNull()
    startManaging()
    expect(dayBox('2026-11-10')).not.toBeNull()
    expect(bar()).toHaveTextContent('已選 0 項')
    expect(within(bar()).getByRole('button', { name: '批次刪除' })).toBeDisabled()
  })

  it('全選當天只在有可以操作的行程時出現；只有投射忙碌區塊的那天沒有', () => {
    sp().setFilter(family)
    open()
    startManaging()
    // 陳家分頁：11/12、11/20 只有從開刀房投射過來的忙碌區塊
    expect(dayBox('2026-11-20')).toBeNull()
    expect(dayBox('2026-11-12')).toBeNull()
    expect(document.querySelectorAll('[data-unpickable]').length).toBeGreaterThan(0)
  })

  it('三態：手動勾一部分是半選，全部勾滿變全選；點全選當天整天加入或移除，底部數量即時更新', () => {
    open()
    startManaging()
    fireEvent.click(chip('早會'))
    expect(dayBox('2026-11-10')!.indeterminate).toBe(true)
    expect(dayBox('2026-11-10')!.checked).toBe(false)
    expect(bar()).toHaveTextContent('已選 1 項')
    fireEvent.click(chip('查房'))
    expect(dayBox('2026-11-10')!.indeterminate).toBe(false)
    expect(dayBox('2026-11-10')!.checked).toBe(true)
    // 取消全選當天：當天全部移除
    fireEvent.click(dayBox('2026-11-10')!)
    expect(chip('早會')).toHaveAttribute('aria-checked', 'false')
    expect(chip('查房')).toHaveAttribute('aria-checked', 'false')
    expect(bar()).toHaveTextContent('已選 0 項')
    // 勾選全選當天：當天可以操作的全部打勾（11/12 有個人行程與開刀房行程）
    fireEvent.click(dayBox('2026-11-12')!)
    expect(chip('晚餐')).toHaveAttribute('aria-checked', 'true')
    expect(chip('刀房排班')).toHaveAttribute('aria-checked', 'true')
    expect(bar()).toHaveTextContent('已選 2 項')
  })

  it('批次刪除：一次刪掉全選當天的行程；復原時原樣放回（id 不變）', () => {
    open()
    startManaging()
    fireEvent.click(dayBox('2026-11-12')!)
    fireEvent.click(within(bar()).getByRole('button', { name: '批次刪除' }))
    expect(app().events.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(liveItems().map((i) => i.title)).toEqual(['夜班'])
    expect(screen.getByText('已刪除 2 項行程')).toBeInTheDocument()
    expect(bar()).toHaveTextContent('已選 0 項')

    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    act(() => void vi.runOnlyPendingTimers())
    expect(app().events.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3'])
    expect(liveItems().map((i) => i.title).sort()).toEqual(['刀房排班', '夜班'])
    expect(screen.getByText('已復原')).toBeInTheDocument()
  })

  it('移到老服二B：個人行程變成老服二B 的原生行程（自己可以編輯、不是投射），提示與復原', () => {
    open()
    startManaging()
    fireEvent.click(dayBox('2026-11-10')!)
    fireEvent.change(within(bar()).getByLabelText('移至'), { target: { value: school } })
    fireEvent.click(within(bar()).getByRole('button', { name: '確認移動' }))

    expect(app().events.map((e) => e.title)).toEqual(['晚餐'])
    const moved = liveItems().filter((i) => i.spaceId === school)
    expect(moved.map((i) => i.title).sort()).toEqual(['早會', '查房'])
    expect(moved.every((i) => i.createdBy === sp().selfId && !i.projection)).toBe(true)
    const entries = visibleCalendar(sp().data, sp().selfId, sp().selfId, school).shared
    expect(entries.every((e) => e.canEdit && !e.projected && e.space.name === '老服二B')).toBe(true)
    expect(screen.getByText('已成功將 2 項行程移至【老服二B】')).toBeInTheDocument()
    expect(bar()).toHaveTextContent('已選 0 項')

    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    act(() => void vi.runOnlyPendingTimers())
    expect(app().events.map((e) => e.title).sort()).toEqual(['早會', '晚餐', '查房'])
    expect(liveItems().filter((i) => i.spaceId === school)).toEqual([])
  })

  it('空間 → 我的行事曆、空間 → 空間：地點保留（我的行事曆寫進備註），原本那筆刪除', () => {
    open()
    startManaging()
    fireEvent.click(chip('刀房排班'))
    fireEvent.change(within(bar()).getByLabelText('移至'), { target: { value: school } })
    fireEvent.click(within(bar()).getByRole('button', { name: '確認移動' }))
    const inSchool = liveItems().find((i) => i.title === '刀房排班')!
    expect(inSchool).toMatchObject({ spaceId: school, location: '第三手術室', start: '08:00', end: '16:00' })

    fireEvent.click(chip('刀房排班'))
    fireEvent.change(within(bar()).getByLabelText('移至'), { target: { value: PERSONAL_CALENDAR_ID } })
    fireEvent.click(within(bar()).getByRole('button', { name: '確認移動' }))
    expect(liveItems().find((i) => i.title === '刀房排班')).toBeUndefined()
    expect(app().events.find((e) => e.title === '刀房排班')).toMatchObject({ dateISO: '2026-11-12', note: '第三手術室' })
    expect(screen.getByText('已成功將 1 項行程移至【我的行事曆】')).toBeInTheDocument()
  })

  it('已經在目標行事曆：不重複建立，提示已經在那裡', () => {
    open()
    startManaging()
    fireEvent.click(chip('早會'))
    fireEvent.click(within(bar()).getByRole('button', { name: '確認移動' }))
    expect(app().events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
    expect(screen.getByText('選取的行程已經在【我的行事曆】')).toBeInTheDocument()
  })

  it('忙碌投射自動重算：把開刀房的行程移走，陳家的忙碌區塊跟著消失', () => {
    const projected = () => visibleCalendar(sp().data, sp().selfId, sp().selfId, family).shared.filter((e) => e.projected).map((e) => e.dateISO)
    expect(projected()).toEqual(['2026-11-12', '2026-11-20'])
    open()
    startManaging()
    fireEvent.click(chip('刀房排班'))
    fireEvent.change(within(bar()).getByLabelText('移至'), { target: { value: school } })
    fireEvent.click(within(bar()).getByRole('button', { name: '確認移動' }))
    expect(projected()).toEqual(['2026-11-20'])
  })

  it('點「完成」離開批次管理，選取清空', () => {
    open()
    startManaging()
    fireEvent.click(chip('早會'))
    fireEvent.click(within(bar()).getByRole('button', { name: '完成' }))
    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(dayBox('2026-11-10')).toBeNull()
  })
})

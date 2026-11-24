import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { visibleCalendar } from '../core/calendarView'
import { emptyAppData } from '../core/schema'
import { createSpace, orderedKinds, PERSONAL_CALENDAR_ID, upsertMember } from '../core/sharing'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { CalendarPage } from './CalendarPage'

const pick = (dialog: HTMLElement, iso: string) => fireEvent.click(within(dialog).getByRole('button', { name: iso }))
const sp = () => useSpacesStore.getState()

describe('批次新增：選擇放在哪個行事曆', () => {
  let school = ''
  let work = ''
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    sp().reset()
    school = sp().createSpace({ name: '老服二B', kind: 'school' })
    work = sp().createSpace({ name: '中榮開刀房', kind: 'work' })
    // 只能檢視的空間：別人建立、自己是 viewer
    const readOnly = upsertMember(createSpace({ id: 'sp-ro', name: '別人的空間', kind: 'family', ownerId: 'someone', now: 1 }), 'someone', { userId: sp().selfId, role: 'viewer' }, 1)
    useSpacesStore.setState({ data: { ...sp().data, spaces: [...sp().data.spaces, readOnly] } })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 10, 24, 10, 0))
  })
  afterEach(() => vi.useRealTimers())

  const openBatch = () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '批次新增' }))
    return screen.getByRole('dialog')
  }

  it('選項是我的行事曆與自己可以編輯的空間（只能檢視的不列）；在「全部」分頁打開預設是我的行事曆', () => {
    const dialog = openBatch()
    const select = within(dialog).getByLabelText('放在哪裡') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['我的行事曆', '老服二B（學校）', '中榮開刀房（工作）'])
    expect(select.value).toBe(PERSONAL_CALENDAR_ID)
  })

  it('在「老服二B」分頁打開：預設帶入老服二B；只能檢視的空間分頁打開時改成我的行事曆', () => {
    sp().setFilter(school)
    const { unmount } = render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '批次新增' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('放在哪裡')).toHaveValue(school)
    unmount()
    sp().setFilter('sp-ro')
    const dialog = openBatch()
    expect(within(dialog).getByLabelText('放在哪裡')).toHaveValue(PERSONAL_CALENDAR_ID)
  })

  it('選老服二B：建立該空間的共享行程（綁定空間、自己可以編輯刪除、不是忙碌投射），不放進我的行事曆', () => {
    const dialog = openBatch()
    fireEvent.change(within(dialog).getByLabelText('放在哪裡'), { target: { value: school } })
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '臨床實習' } })
    pick(dialog, '2026-11-25')
    pick(dialog, '2026-11-26')
    fireEvent.click(within(dialog).getByText('加入 2 天'))

    expect(useAppStore.getState().events).toEqual([])
    const items = sp().data.items.filter((i) => i.deletedAt === null)
    expect(items).toHaveLength(2)
    for (const i of items) {
      expect(i).toMatchObject({ spaceId: school, title: '臨床實習', start: '09:00', end: '17:00', createdBy: sp().selfId, kind: orderedKinds('school')[0], note: '' })
      expect(i.projection).toBeUndefined()
    }
    // 畫面上：出現在老服二B，可以直接編輯
    const entries = visibleCalendar(sp().data, sp().selfId, sp().selfId, school).shared
    expect(entries.map((e) => e.dateISO)).toEqual(['2026-11-25', '2026-11-26'])
    expect(entries.every((e) => e.canEdit && !e.projected && e.space.name === '老服二B')).toBe(true)
    // 工作空間不受影響
    expect(visibleCalendar(sp().data, sp().selfId, sp().selfId, work).shared).toEqual([])
  })

  it('建立在空間後按「復原」：刪掉剛建立的空間行程（軟刪除，會同步給其他成員）', () => {
    const dialog = openBatch()
    fireEvent.change(within(dialog).getByLabelText('放在哪裡'), { target: { value: work } })
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '值班' } })
    pick(dialog, '2026-11-27')
    fireEvent.click(within(dialog).getByText('加入 1 天'))
    expect(sp().data.items.filter((i) => i.deletedAt === null)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    act(() => void vi.runOnlyPendingTimers())
    expect(sp().data.items.filter((i) => i.deletedAt === null)).toEqual([])
    expect(sp().data.items[0]!.deletedAt).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('已復原，移除了 1 筆行程')
  })

  it('選我的行事曆：跟原本一樣建立個人行程', () => {
    const dialog = openBatch()
    fireEvent.change(within(dialog).getByLabelText('行程名稱'), { target: { value: '上班' } })
    pick(dialog, '2026-11-25')
    fireEvent.click(within(dialog).getByText('加入 1 天'))
    expect(useAppStore.getState().events).toMatchObject([{ title: '上班', dateISO: '2026-11-25', note: '批次建立' }])
    expect(sp().data.items).toEqual([])
  })

  it('沒有可以編輯的空間：不顯示「放在哪裡」', () => {
    sp().reset()
    const dialog = openBatch()
    expect(within(dialog).queryByLabelText('放在哪裡')).toBeNull()
  })
})

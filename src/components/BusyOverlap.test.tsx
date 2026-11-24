import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { busyConflicts, type SharedEntry } from '../core/calendarView'
import { emptyAppData } from '../core/schema'
import { PERSONAL_CALENDAR_ID } from '../core/sharing'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { EventDialog } from './EventDialog'

/** 測試用的忙碌區塊（只填 busyConflicts 用得到的欄位） */
const block = (start: string, end: string, extra: Partial<SharedEntry> = {}) =>
  ({ id: `b-${start}`, dateISO: '2026-12-01', lastDateISO: '2026-12-01', start, end, projected: true, access: 'busy', ...extra }) as SharedEntry

describe('重疊判斷 busyConflicts', () => {
  const entries = [block('14:00', '16:00')]
  it('時間有交集才算；剛好接在前後不算', () => {
    expect(busyConflicts(entries, '2026-12-01', '15:00', '17:00')).toHaveLength(1)
    expect(busyConflicts(entries, '2026-12-01', '13:00', '14:30')).toHaveLength(1)
    expect(busyConflicts(entries, '2026-12-01', '12:00', '14:00')).toEqual([])
    expect(busyConflicts(entries, '2026-12-01', '16:00', '17:00')).toEqual([])
    expect(busyConflicts(entries, '2026-12-02', '15:00', '17:00')).toEqual([])
  })

  it('整天行程、整天的忙碌區塊：同一天就算重疊；跨日區塊涵蓋的每一天都算', () => {
    expect(busyConflicts(entries, '2026-12-01', '', '')).toHaveLength(1)
    expect(busyConflicts([block('', '')], '2026-12-01', '09:00', '10:00')).toHaveLength(1)
    const trip = block('20:00', '08:00', { lastDateISO: '2026-12-03' })
    expect(busyConflicts([trip], '2026-12-02', '09:00', '10:00')).toHaveLength(1)
  })

  it('沒有結束時間：當成時間點；一般共享行程（不是忙碌區塊）不提醒', () => {
    expect(busyConflicts(entries, '2026-12-01', '15:00', '')).toHaveLength(1)
    expect(busyConflicts(entries, '2026-12-01', '14:00', '')).toHaveLength(1)
    expect(busyConflicts(entries, '2026-12-01', '16:30', '')).toEqual([])
    expect(busyConflicts([block('14:00', '16:00', { projected: false, access: 'full' })], '2026-12-01', '15:00', '17:00')).toEqual([])
  })
})

describe('新增行程時的重疊提醒', () => {
  let family = ''
  let work = ''
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    useSpacesStore.getState().reset()
    const st = useSpacesStore.getState()
    family = st.createSpace({ name: '陳家', kind: 'family' })
    work = st.createSpace({ name: '中榮開刀房', kind: 'work' })
    // 個人行程 14:00–16:00 以「有事」同步到陳家；開刀房的手術只顯示時間同步到陳家
    st.addRule({ sourceId: PERSONAL_CALENDAR_ID, targetIds: [family], label: '有事' })
    st.addRule({ sourceId: work, targetIds: [family], display: 'time_only' })
    useSpacesStore.getState().setPersonalBusySlots([{ id: 'dent', dateISO: '2026-12-01', start: '14:00', end: '16:00', version: 1, updatedAt: 1, deletedAt: null }])
    useSpacesStore.getState().addItem(work, { title: '腹腔鏡手術', dateISO: '2026-12-01', start: '08:00', end: '12:00' })
  })

  const openDialog = () => {
    render(<EventDialog event={null} date="2026-12-01" onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('放在哪裡'), { target: { value: family } })
  }
  /** 時間欄位分成小時、分鐘兩格；預設 09:00–10:00，這裡只改小時（分鐘維持 00） */
  const setHour = (label: '開始' | '結束', hh: string) => fireEvent.change(screen.getByLabelText(`${label} 小時`), { target: { value: hh } })

  it('放進陳家、時間跟忙碌區塊重疊：列出重疊的時段與來源，提示仍然可以儲存', () => {
    openDialog()
    setHour('開始', '15')
    setHour('結束', '17')
    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-busy-overlap')
    expect(notice).toHaveTextContent('這個時段跟忙碌時段重疊')
    expect(notice).toHaveTextContent('14:00–16:00 有事（來自我的行事曆）')
    expect(notice).toHaveTextContent('仍然可以儲存')
    expect(notice).not.toHaveTextContent('08:00')
  })

  it('只顯示時間的區塊：只列時間與來源，不寫「忙碌」', () => {
    openDialog()
    setHour('開始', '09')
    setHour('結束', '10')
    const items = within(screen.getByRole('status')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['・08:00–12:00（來自中榮開刀房）'])
  })

  it('沒有重疊、或放進沒有忙碌區塊的行事曆：不提醒', () => {
    openDialog()
    setHour('開始', '12')
    setHour('結束', '14')
    expect(document.querySelector('[data-busy-overlap]')).toBeNull()
    // 改成我的行事曆：沒有任何規則投射到這裡
    setHour('開始', '15')
    fireEvent.change(screen.getByLabelText('放在哪裡'), { target: { value: PERSONAL_CALENDAR_ID } })
    expect(document.querySelector('[data-busy-overlap]')).toBeNull()
  })

  it('整天行程：當天有忙碌區塊就提醒', () => {
    openDialog()
    fireEvent.click(screen.getByRole('switch', { name: '整天' }))
    expect(within(screen.getByRole('status')).getAllByRole('listitem')).toHaveLength(2)
  })

  it('提醒不擋儲存', () => {
    openDialog()
    fireEvent.change(screen.getByLabelText('要做什麼？'), { target: { value: '家庭聚餐' } })
    setHour('開始', '15')
    setHour('結束', '17')
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(useSpacesStore.getState().data.items.some((i) => i.title === '家庭聚餐' && i.spaceId === family)).toBe(true)
  })
})

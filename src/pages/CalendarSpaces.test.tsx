import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { ViewerBanner } from '../components/SpaceSwitcher'
import { toLocalISO } from '../core/date'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { useSpacesStore } from '../store/useSpacesStore'
import { makeItem, U } from '../test/sharingFixtures'
import { clearSpaces, LEAK, loadSeed, SEEN } from '../test/spacesSeed'
import { CalendarPage } from './CalendarPage'

const leakRe = new RegExp(Object.values(LEAK).join('|'))
const renderPage = (path = '/calendar') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ViewerBanner />
      <CalendarPage />
    </MemoryRouter>,
  )
const today = toLocalISO()
/** 月曆格子裡的行程標籤 */
const chip = (id: string) => document.querySelector(`[role="gridcell"] [data-shared="${id}"]`)!
/** 點今天的格子，打開「這一天」 */
const openToday = () => {
  fireEvent.click(screen.getAllByRole('gridcell').find((c) => c.getAttribute('aria-selected') === 'true')!)
  return screen.getByRole('dialog')
}

describe('行事曆：共享空間', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({ ...emptyAppData(), events: [{ id: 'p1', title: '我的私人瑜珈', dateISO: today, start: '07:00', end: '08:00', note: '' }] })
    loadSeed()
  })

  it('沒有共享空間時不顯示切換列，行事曆跟原本一樣', () => {
    clearSpaces()
    renderPage()
    expect(screen.queryByRole('tablist', { name: '顯示哪些行程' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/我的私人瑜珈/).length).toBeGreaterThan(0)
  })

  it('全部：個人行程與共享行程一起顯示，並標出空間', () => {
    renderPage()
    expect(screen.getAllByText(/我的私人瑜珈/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(new RegExp(SEEN.dinner)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('陳家').length).toBeGreaterThan(0)
    // 媽媽只分享給小孩的驚喜，爸爸看不到
    expect(screen.queryByText(new RegExp(SEEN.surprise))).not.toBeInTheDocument()
  })

  it('篩選某個空間：只顯示該空間，不顯示個人行程', () => {
    renderPage()
    const tabs = screen.getByRole('tablist', { name: '顯示哪些行程' })
    fireEvent.click(within(tabs).getByRole('tab', { name: /設計部/ }))
    expect(screen.getAllByText(new RegExp(LEAK.merger)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/我的私人瑜珈/)).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(SEEN.dinner))).not.toBeInTheDocument()
    fireEvent.click(within(tabs).getByRole('tab', { name: '我的行事曆' }))
    expect(screen.getAllByText(/我的私人瑜珈/).length).toBeGreaterThan(0)
    expect(screen.queryByText(new RegExp(LEAK.merger))).not.toBeInTheDocument()
  })

  it('切換成小孩的視角：顯示唯讀提示，敏感內容不出現在畫面上', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('檢視身份'), { target: { value: U.kid } })
    expect(screen.getByRole('status')).toHaveTextContent('正在以「小孩」的視角預覽')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(leakRe)
    expect(text).not.toContain('我的私人瑜珈')
    // 忙閒：只有自訂文字；投射：上班中；遮罩：標題顯示已隱藏、地點照常
    expect(screen.getAllByText(/外出/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/上班中/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/（已隱藏）/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(new RegExp(SEEN.surprise)).length).toBeGreaterThan(0)
    // 預覽時沒有新增按鈕
    expect(screen.queryByText('＋ 新增事件')).not.toBeInTheDocument()
    // 忙閒區塊有明顯不同的樣式標記
    expect(document.querySelector('[data-shared="clinic"][data-access="busy"]')).not.toBeNull()
    // 「這一天」的卡片標出部分隱藏，也不洩漏內容
    const day = openToday()
    expect(within(day).getByText('部分隱藏')).toBeInTheDocument()
    expect(day.textContent).not.toMatch(leakRe)
    fireEvent.keyDown(day, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: '回到我的視角' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(LEAK.clinicTitle)).length).toBeGreaterThan(0)
  })

  it('預覽中點行程只開唯讀詳情，不會打開編輯表單', () => {
    useSpacesStore.getState().setViewer(U.kid)
    renderPage()
    // 從「這一天」點進去：先收起這一天，只剩唯讀詳情
    fireEvent.click(within(openToday()).getByText(SEEN.dinner).closest('button')!)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('note')).toHaveTextContent('預覽其他成員的視角時只能查看')
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('本人視角下，別人的忙閒行程也只開唯讀詳情，不會洩漏內容', () => {
    const data = useSpacesStore.getState().data
    const momBusy = makeItem({ id: 'mom-busy', spaceId: 'sp-family', createdBy: U.mom, dateISO: today, title: '媽媽的私事', location: '某某診所', start: '10:00', end: '11:00', visibility: { mode: 'busy_only' } })
    useSpacesStore.setState({ data: { ...data, items: [...data.items, momBusy] } })
    renderPage()
    expect(document.body.textContent).not.toMatch(/媽媽的私事|某某診所/)
    fireEvent.click(chip('mom-busy'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('note')).toHaveTextContent('只顯示忙碌時段')
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/媽媽的私事|某某診所/)
  })

  it('新增共享行程：選空間、類型與「只顯示忙碌」，小孩只看得到自訂文字', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增事件'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('放在哪裡'), { target: { value: 'sp-family' } })
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '陪奶奶洗腎' } })
    fireEvent.change(within(dialog).getByLabelText('行程類型'), { target: { value: 'medical_ride' } })
    fireEvent.change(within(dialog).getByLabelText('地點（選填）'), { target: { value: '洗腎中心' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '只顯示忙碌' }))
    fireEvent.change(within(dialog).getByLabelText('忙碌時顯示的文字'), { target: { value: '家裡有事' } })
    fireEvent.click(within(dialog).getByText('儲存'))

    const item = useSpacesStore.getState().data.items.at(-1)!
    expect(item).toMatchObject({ spaceId: 'sp-family', title: '陪奶奶洗腎', kind: 'medical_ride', location: '洗腎中心', createdBy: U.dad, visibility: { mode: 'busy_only', busyLabel: '家裡有事' } })
    expect(useAppStore.getState().events).toHaveLength(1)

    act(() => {
      useSpacesStore.getState().setViewer(U.kid)
    })
    expect(screen.getAllByText(/家裡有事/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/陪奶奶洗腎|洗腎中心/)
  })

  it('指定成員與排除成員：白名單一定要選人；排除的人看不到', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增事件'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('放在哪裡'), { target: { value: 'sp-family' } })
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '準備媽媽的禮物' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '只給指定成員' }))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(within(dialog).getByText('請至少選一位成員')).toBeInTheDocument()

    const allowed = within(dialog).getByRole('group', { name: '只給這些成員' })
    fireEvent.click(within(allowed).getByLabelText('小孩'))
    fireEvent.click(within(allowed).getByLabelText('奶奶'))
    const hidden = within(dialog).getByRole('group', { name: '對這些人隱藏' })
    fireEvent.click(within(hidden).getByLabelText('奶奶'))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useSpacesStore.getState().data.items.at(-1)!.visibility).toMatchObject({ mode: 'selected_members', allowedUserIds: [U.kid, U.grandma], hiddenUserIds: [U.grandma] })

    act(() => {
      useSpacesStore.getState().setViewer(U.grandma)
    })
    expect(document.body.textContent).not.toContain('準備媽媽的禮物')
    act(() => {
      useSpacesStore.getState().setViewer(U.kid)
    })
    expect(screen.getAllByText(/準備媽媽的禮物/).length).toBeGreaterThan(0)
  })

  it('欄位遮罩：選了標題與備註，其他成員看到「已隱藏」', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增事件'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('放在哪裡'), { target: { value: 'sp-family' } })
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '面試新工作' } })
    const mask = within(dialog).getByRole('group', { name: '對其他成員隱藏這些欄位' })
    fireEvent.click(within(mask).getByLabelText('標題'))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useSpacesStore.getState().data.items.at(-1)!.visibility.maskedFields).toEqual(['title'])
    act(() => {
      useSpacesStore.getState().setViewer(U.mom)
    })
    expect(document.body.textContent).not.toContain('面試新工作')
  })

  it('編輯自己的共享行程可以改隱私；編輯別人的行程時隱私設定鎖住', () => {
    renderPage()
    fireEvent.click(chip('clinic'))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('共享空間：陳家')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('放在哪裡')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: '只顯示忙碌' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('radio', { name: '只有自己' }))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useSpacesStore.getState().data.items.find((i) => i.id === 'clinic')!.visibility.mode).toBe('private')

    fireEvent.click(chip('dinner'))
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('只有建立者可以變更誰看得到')).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: '只有自己' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '週日家庭聚餐（晚上）' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    const dinner = useSpacesStore.getState().data.items.find((i) => i.id === 'dinner')!
    expect(dinner).toMatchObject({ title: '週日家庭聚餐（晚上）', createdBy: U.mom, visibility: { mode: 'group_full' } })
  })

  it('刪除共享行程是軟刪除', () => {
    renderPage()
    fireEvent.click(chip('clinic'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('刪除'))
    expect(useSpacesStore.getState().data.items.find((i) => i.id === 'clinic')!.deletedAt).not.toBeNull()
    expect(screen.queryByText(new RegExp(LEAK.clinicTitle))).not.toBeInTheDocument()
  })

  it('搜尋結果的連結 ?open=<id> 可以開啟共享行程；預覽中只開唯讀詳情', () => {
    useSpacesStore.getState().setViewer(U.kid)
    renderPage('/calendar?open=home')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(SEEN.homePlace)).toBeInTheDocument()
    expect(within(dialog).queryByText('儲存')).not.toBeInTheDocument()
    expect(dialog.textContent).not.toMatch(leakRe)
  })
})

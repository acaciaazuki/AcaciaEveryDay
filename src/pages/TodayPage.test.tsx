import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { addDays, toLocalISO } from '../core/date'
import { emptyAppData } from '../core/schema'
import { useAppStore } from '../store/useAppStore'
import { TodayPage } from './TodayPage'

const renderPage = () => render(<MemoryRouter><TodayPage /></MemoryRouter>)

describe('TodayPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
  })

  it('依行程時間計算空檔', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '午餐', dateISO: d, start: '12:00', end: '13:00', note: '' },
        { id: 'b', title: '開會', dateISO: d, start: '15:00', end: '16:30', note: '' },
      ],
    })
    renderPage()
    expect(screen.getByText('已安排 2.5 小時')).toBeInTheDocument()
    expect(screen.getByText('還有 13.5 小時空檔')).toBeInTheDocument()
    expect(screen.getByText(/留給自己的空檔 · 2h/)).toBeInTheDocument()
  })

  it('可以調整起床與就寢時間，存進設定並重新計算', () => {
    renderPage()
    expect(screen.getByText('還有 16 小時空檔')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '調整起床與就寢時間' }))
    const dialog = screen.getByRole('dialog', { name: '調整今天的節奏' })
    fireEvent.change(within(dialog).getByLabelText('起床 小時'), { target: { value: '06' } })
    fireEvent.change(within(dialog).getByLabelText('就寢 小時'), { target: { value: '21' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().settings.rhythm).toEqual({ wake: '06:00', sleep: '21:00' })
    expect(screen.getByText('還有 15 小時空檔')).toBeInTheDocument()
  })

  it('起床與就寢相同時不能儲存；恢復預設會清掉設定', () => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, rhythm: { wake: '06:00', sleep: '21:00' } } }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '調整起床與就寢時間' }))
    const dialog = screen.getByRole('dialog', { name: '調整今天的節奏' })
    fireEvent.change(within(dialog).getByLabelText('起床 小時'), { target: { value: '21' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('起床與就寢時間不能相同')
    fireEvent.click(within(dialog).getByText(/恢復預設/))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().settings.rhythm).toBeUndefined()
  })

  it('從今天頁新增行程', () => {
    renderPage()
    fireEvent.click(screen.getByText('今天還沒有安排，點擊新增 ＋'))
    fireEvent.change(screen.getByLabelText('要做什麼？'), { target: { value: '散步' } })
    fireEvent.click(screen.getByText('儲存'))
    expect(screen.getAllByText('散步').length).toBeGreaterThan(0)
    expect(useAppStore.getState().events).toHaveLength(1)
  })

  it('快速新增待辦', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增待辦'))
    fireEvent.change(screen.getByLabelText('輸入待辦事項按 Enter…'), { target: { value: '倒垃圾' } })
    fireEvent.submit(screen.getByLabelText('輸入待辦事項按 Enter…'))
    expect(screen.getByText('倒垃圾')).toBeInTheDocument()
  })

  it('用箭頭切換到明天、後天，並可回到今天', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '今天的事', dateISO: d, start: '10:00', end: '11:00', note: '' },
        { id: 'b', title: '明天的事', dateISO: addDays(d, 1), start: '09:00', end: '12:00', note: '' },
      ],
    })
    renderPage()
    expect(screen.getByText('今天的事')).toBeInTheDocument()
    expect(screen.queryByText('回到今天')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('明天')
    expect(screen.getByText('明天的事')).toBeInTheDocument()
    expect(screen.queryByText('今天的事')).not.toBeInTheDocument()
    expect(screen.getByText('已安排 3 小時')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('後天')
    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('大後天')

    fireEvent.click(screen.getByText('回到今天'))
    expect(screen.getByText('今天的事')).toBeInTheDocument()
  })

  it('一週檢視依日期列出未來 7 天的行程', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '第三天', dateISO: addDays(d, 2), start: '10:00', end: '11:00', note: '' },
        { id: 'b', title: '第八天', dateISO: addDays(d, 7), start: '10:00', end: '11:00', note: '' },
      ],
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    expect(screen.getByText('第三天')).toBeInTheDocument()
    expect(screen.queryByText('第八天')).not.toBeInTheDocument()
    expect(screen.getAllByText('沒有行程')).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: '兩週' }))
    expect(screen.getByText('第八天')).toBeInTheDocument()
    expect(screen.getAllByText('沒有行程')).toHaveLength(12)

    // 一週檢視用箭頭整段往後翻
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    fireEvent.click(screen.getByLabelText('往後'))
    expect(screen.getByText('第八天')).toBeInTheDocument()
    expect(screen.queryByText('第三天')).not.toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '檢視範圍' })).getByRole('button', { name: '一週' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('時間軸依標題自動帶出小圖示，手動選的圖示優先', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'a', title: '早餐', dateISO: d, start: '08:00', end: '08:30', note: '' },
        { id: 'b', title: '開會', dateISO: d, start: '10:00', end: '11:00', note: '' },
        { id: 'c', title: '隨便', dateISO: d, start: '13:00', end: '14:00', note: '', icon: 'exercise' },
        { id: 'd', title: '繳費', dateISO: d, start: '15:00', end: '15:30', note: '' },
      ],
    })
    const { container } = renderPage()
    expect([...container.querySelectorAll('[data-icon]')].map((n) => n.getAttribute('data-icon'))).toEqual(['meal', 'work', 'exercise', 'default'])
  })

  it('在行程表單手動選圖示會存進資料，選回自動就清掉', () => {
    const d = toLocalISO()
    useAppStore.setState({ events: [{ id: 'a', title: '早餐', dateISO: d, start: '08:00', end: '08:30', note: '' }] })
    const { container } = renderPage()
    fireEvent.click(screen.getByText('早餐'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: '自動' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByRole('radio', { name: '運動' }))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().events[0].icon).toBe('exercise')
    expect(container.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'exercise')

    fireEvent.click(screen.getByText('早餐'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: '自動' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('儲存'))
    expect(useAppStore.getState().events[0].icon).toBeUndefined()
    expect(container.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'meal')
  })
  it('時間軸與節奏都用 24 小時制，不顯示 AM／PM', () => {
    const d = toLocalISO()
    useAppStore.setState({ events: [{ id: 'n', title: '晚上散步', dateISO: d, start: '21:00', end: '21:45', note: '' }] })
    renderPage()
    expect(screen.getByText('21:00', { selector: 'time' })).toBeInTheDocument()
    expect(screen.getByText(/21:00–21:45/)).toBeInTheDocument()
    expect(screen.getByText(/07:00/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/AM|PM|上午|下午/)
  })
  it('時間軸不顯示批次新增自動加上的「批次建立」，自己寫的備註照常顯示', () => {
    const d = toLocalISO()
    useAppStore.setState({
      events: [
        { id: 'b1', title: '上班', dateISO: d, start: '09:00', end: '17:00', note: '批次建立' },
        { id: 'b2', title: '値班', dateISO: d, start: '18:00', end: '19:00', note: 'Added in bulk' },
        { id: 'n', title: '看牙醫', dateISO: d, start: '20:00', end: '20:30', note: '帶健保卡' },
      ],
    })
    renderPage()
    expect(document.body.textContent).not.toMatch(/批次建立|Added in bulk/)
    expect(screen.getByText(/帶健保卡/)).toBeInTheDocument()
    // 今天頁沒有批次新增的入口，資料也不變
    expect(screen.queryByText('批次新增')).not.toBeInTheDocument()
    expect(useAppStore.getState().events[0]!.note).toBe('批次建立')
    fireEvent.click(screen.getByRole('button', { name: '一週' }))
    expect(document.body.textContent).not.toMatch(/批次建立/)
  })

  it('選「慶祝」圖示存檔後，時間軸顯示慶祝圖示', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增安排'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/要做什麼/), { target: { value: '小聚' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '慶祝' }))
    expect(within(dialog).getByRole('radio', { name: '慶祝' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().events[0]).toMatchObject({ title: '小聚', icon: 'celebrate' })
  })

  it('字級：問候與橫幅標題跟說明文字一樣大（13px）；日期、按鈕、摘要、檢視切換與小連結放大到 14px', () => {
    useAppStore.setState({ events: [{ id: 'x', title: '散步', dateISO: toLocalISO(), start: '18:00', end: '18:30', note: '' }] })
    renderPage()
    const t13 = 'text-[length:calc(13px*var(--fs))]'
    const t14 = 'text-[length:calc(14px*var(--fs))]'
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(t13)
    expect(screen.getByRole('heading', { name: '慢慢來，一切都會剛剛好。' })).toHaveClass(t13)
    expect(screen.getByText('你有幾件重要的事，還有足夠的空檔好好呼吸。')).toHaveClass(t13)
    expect(screen.getByRole('heading', { level: 1 }).previousElementSibling).toHaveClass(t14)
    expect(screen.getByRole('link', { name: /查看月曆/ })).toHaveClass(t14)
    expect(screen.getByRole('button', { name: '＋ 新增安排' })).toHaveClass(`${t14}!`)
    expect(screen.getByText('個行程').closest('span')).toHaveClass(t14)
    for (const b of within(screen.getByRole('group', { name: '檢視範圍' })).getAllByRole('button')) expect(b).toHaveClass(t14)
    for (const name of ['查看完整日程 →', '全部 →']) expect(screen.getByRole('link', { name })).toHaveClass(t14)
    for (const name of ['調整起床與就寢時間', '＋ 新增待辦', '＋ 加一個行程']) expect(screen.getByRole('button', { name })).toHaveClass(t14)
  })
})

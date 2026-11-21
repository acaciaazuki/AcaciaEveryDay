import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLocationAdapter, setLocationAdapter, webLocation, type LocationAdapter } from '../adapters/geofence'
import { ReminderBanner } from '../components/ReminderBanner'
import type { Fix } from '../core/reminders'
import { emptyAppData } from '../core/schema'
import i18n from '../i18n'
import { useReminderMonitor } from '../hooks/useReminderMonitor'
import { useAppStore } from '../store/useAppStore'
import { useReminderRuntime } from '../store/useReminderRuntime'
import { RemindersPage } from './RemindersPage'

function Harness() {
  useReminderMonitor()
  return (
    <>
      <RemindersPage />
      <ReminderBanner />
    </>
  )
}
const renderPage = () => render(<MemoryRouter><Harness /></MemoryRouter>)

/** 假的定位轉接層：測試手動餵位置 */
function fakeLocation() {
  let push: (f: Fix) => void = () => {}
  const adapter: LocationAdapter = {
    supported: true,
    watch: (onFix) => {
      push = onFix
      return () => {}
    },
    getCurrent: () => Promise.resolve({ lat: 25.04, lng: 121.55, accuracy: 15 }),
  }
  return { adapter, move: (f: Fix) => act(() => push(f)) }
}

const HOME = { lat: 25.033, lng: 121.5654 }

describe('防遺漏提醒頁', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    useReminderRuntime.setState({ alerts: [], status: 'idle' })
  })
  afterEach(() => setLocationAdapter(webLocation))

  it('建立提醒：預覽即時更新、物品標籤可新增與刪除', () => {
    renderPage()
    expect(screen.getByText(/還沒有提醒/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('＋ 新增'))
    const dialog = screen.getByRole('dialog')
    const preview = within(dialog).getByTestId('reminder-preview')
    expect(preview).toHaveTextContent('每天，離開（地點）時，請確認（隨身物品）。')

    fireEvent.change(within(dialog).getByLabelText('地點'), { target: { value: '公司' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '平日' }))
    fireEvent.change(within(dialog).getByLabelText('隨身物品'), { target: { value: '錢包、鑰匙' } })
    fireEvent.click(within(dialog).getByText('新增'))
    fireEvent.change(within(dialog).getByLabelText('隨身物品'), { target: { value: '識別證' } })
    fireEvent.keyDown(within(dialog).getByLabelText('隨身物品'), { key: 'Enter' })
    expect(preview).toHaveTextContent('平日，離開（公司）時，請確認（錢包、鑰匙、識別證）。')

    fireEvent.click(within(dialog).getByRole('button', { name: '移除 鑰匙' }))
    expect(preview).toHaveTextContent('請確認（錢包、識別證）')
    fireEvent.click(within(dialog).getByRole('radio', { name: '抵達時' }))
    expect(preview).toHaveTextContent('平日，抵達（公司）時')
    fireEvent.click(within(dialog).getByRole('radio', { name: '500m' }))
    fireEvent.change(within(dialog).getByLabelText('開始時間'), { target: { value: '08:00' } })
    fireEvent.change(within(dialog).getByLabelText('結束時間'), { target: { value: '18:00' } })
    expect(preview).toHaveTextContent('平日 08:00–18:00，抵達（公司）時')

    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().reminders[0]).toMatchObject({ place: '公司', radius: 500, trigger: 'arrive', days: 'weekdays', start: '08:00', end: '18:00', items: ['錢包', '識別證'], enabled: true })
    expect(screen.getByText(/公司/)).toBeInTheDocument()
    expect(screen.getByText(/還沒有座標/)).toBeInTheDocument()
  })

  it('自訂星期、預設通知範圍 300m，驗證必填欄位', () => {
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: '300m' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(within(dialog).getByText('請輸入地點名稱')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('地點'), { target: { value: '家' } })
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(within(dialog).getByText('請至少加入一項隨身物品')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('隨身物品'), { target: { value: '手機' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: '自訂' }))
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(within(dialog).getByText('請至少選一天')).toBeInTheDocument()
    const group = within(dialog).getByRole('group', { name: '自訂' })
    fireEvent.click(within(group).getAllByRole('button')[0]) // 週一
    expect(within(dialog).getByTestId('reminder-preview')).toHaveTextContent(/週一，離開（家）時，請確認（手機）/)
    fireEvent.click(within(dialog).getByText('儲存'))
    expect(useAppStore.getState().reminders[0]).toMatchObject({ days: 'custom', customDays: [1], items: ['手機'] })
  })

  it('用目前位置與貼上座標設定地點', async () => {
    setLocationAdapter(fakeLocation().adapter)
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/座標/), { target: { value: 'abc' } })
    expect(within(dialog).getByText(/看不懂這個座標/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/座標/), { target: { value: 'https://www.google.com/maps/@25.033,121.5654,17z' } })
    expect(within(dialog).getByText(/已設定座標 25.03300, 121.56540/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('清除座標'))
    await act(async () => {
      fireEvent.click(within(dialog).getByText('使用目前位置'))
    })
    expect(within(dialog).getByText(/已設定座標 25.04000, 121.55000/)).toBeInTheDocument()
    expect((within(dialog).getByLabelText('地點') as HTMLInputElement).value).toBe('目前位置')
  })

  it('從最愛地點帶入名稱', () => {
    useAppStore.setState({ places: [{ id: 'p1', name: '星巴克', cat: 'cafe', address: '', hours: '', note: '', url: 'https://maps.google.com/?q=25.0330,121.5654' }] })
    renderPage()
    fireEvent.click(screen.getByText('＋ 新增'))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('從最愛地點帶入'), { target: { value: 'p1' } })
    expect((within(dialog).getByLabelText('地點') as HTMLInputElement).value).toBe('星巴克')
    expect(within(dialog).getByText(/已設定座標 25.03300/)).toBeInTheDocument()
  })

  it('開關、刪除', () => {
    useAppStore.setState({ reminders: [{ id: 'r', place: '公司', radius: 300, trigger: 'leave', days: 'every', customDays: [], start: '', end: '', items: ['鑰匙'], enabled: true }] })
    renderPage()
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(useAppStore.getState().reminders[0].enabled).toBe(false)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByText('刪除'))
    expect(useAppStore.getState().reminders).toHaveLength(0)
  })
})

describe('進出提醒', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState({
      ...emptyAppData(),
      reminders: [{ id: 'r', place: '公司', ...HOME, radius: 300, trigger: 'leave', days: 'every', customDays: [], start: '', end: '', items: ['錢包', '鑰匙'], enabled: true }],
    })
    useReminderRuntime.setState({ alerts: [], status: 'idle' })
  })
  afterEach(() => setLocationAdapter(webLocation))

  it('離開範圍時顯示橫幅、可勾選物品，同一趟不重複，關閉後下次離開才再提醒', () => {
    const geo = fakeLocation()
    setLocationAdapter(geo.adapter)
    renderPage()
    expect(useReminderRuntime.getState().status).toBe('watching')
    expect(screen.getByRole('status')).toHaveTextContent('定位監測中')

    geo.move({ ...HOME, accuracy: 10 }) // 人在公司裡
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    geo.move({ lat: HOME.lat + 0.005, lng: HOME.lng, accuracy: 10 }) // 約 550m，離開
    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('離開公司，請確認帶齊')
    fireEvent.click(within(banner).getByLabelText('錢包'))
    expect(within(banner).getByLabelText('錢包')).toBeChecked()
    geo.move({ lat: HOME.lat + 0.006, lng: HOME.lng, accuracy: 10 })
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    fireEvent.click(within(banner).getByText('都帶齊了'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    geo.move({ lat: HOME.lat + 0.008, lng: HOME.lng, accuracy: 10 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('停用或沒有座標的提醒不會開始定位；沒有定位功能時顯示不支援', () => {
    const watch = vi.fn(() => () => {})
    setLocationAdapter({ supported: true, watch, getCurrent: () => Promise.reject('unavailable') })
    useAppStore.setState({ reminders: [{ ...useAppStore.getState().reminders[0], enabled: false }] })
    renderPage()
    expect(watch).not.toHaveBeenCalled()
    expect(useReminderRuntime.getState().status).toBe('idle')

    useAppStore.setState({ reminders: [{ ...useAppStore.getState().reminders[0], enabled: true }] })
    setLocationAdapter({ supported: false, watch, getCurrent: () => Promise.reject('unavailable') })
    renderPage()
    expect(useReminderRuntime.getState().status).toBe('unsupported')
  })

  it('測試按鈕直接顯示橫幅', () => {
    setLocationAdapter(fakeLocation().adapter)
    renderPage()
    fireEvent.click(screen.getByText('測試提醒'))
    expect(screen.getByRole('alert')).toHaveTextContent('離開公司')
    expect(getLocationAdapter().supported).toBe(true)
  })

  it('已允許通知時送出系統通知（同一條規則用同一個 tag，不堆疊）', () => {
    const made: { title: string; opts: NotificationOptions }[] = []
    class FakeNotification {
      static permission = 'granted'
      constructor(title: string, opts: NotificationOptions) {
        made.push({ title, opts })
      }
    }
    vi.stubGlobal('Notification', FakeNotification)
    try {
      setLocationAdapter(fakeLocation().adapter)
      renderPage()
      fireEvent.click(screen.getByText('測試提醒'))
      fireEvent.click(screen.getByText('測試提醒'))
      expect(made).toHaveLength(2)
      expect(made[0].title).toBe('防遺漏提醒')
      expect(made[0].opts.body).toBe('離開公司：請確認 錢包、鑰匙')
      expect(made[0].opts.tag).toBe(made[1].opts.tag)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

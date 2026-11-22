import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { Layout } from '../app/Layout'
import { migrate } from '../core/migrate'
import { emptyAppData } from '../core/schema'
import i18n from '../i18n'
import { useAppStore } from '../store/useAppStore'
import { useConsentStore } from '../store/useConsentStore'
import { SettingsPage } from './SettingsPage'

function renderApp(path = '/settings') {
  const router = createMemoryRouter(
    [{ path: '/', Component: Layout, children: [{ path: 'settings', Component: SettingsPage }, { path: '*', element: null }] }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** 側邊欄「收集與整理」目前的項目文字 */
const sidebar = () => {
  const aside = document.querySelector('aside')!
  const navs = aside.querySelectorAll('nav')
  return [...navs[1].querySelectorAll('a')].map((a) => a.textContent?.replace(/\d+$/, ''))
}
const list = () => screen.getByRole('list', { name: '收集與整理' })
const rows = () => within(list()).getAllByRole('listitem').map((li) => li.textContent?.replace(/^\d+/, ''))

describe('側邊欄「收集與整理」排序', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
    useAppStore.setState(emptyAppData())
    useConsentStore.setState({ status: 'accepted' })
  })

  it('預設順序，沒存過時不寫入設定', () => {
    renderApp()
    expect(rows()).toEqual(['購物清單', '防遺漏提醒', '訂閱與續費', '庫存與提醒'])
    expect(sidebar()).toEqual(['購物清單', '防遺漏提醒', '訂閱與續費', '庫存與提醒'])
    expect(useAppStore.getState().settings.navOrder).toBeUndefined()
    expect(screen.getByRole('button', { name: '恢復預設順序' })).toBeDisabled()
    // 頂端的上移、底端的下移按鈕停用
    expect(screen.getByRole('button', { name: '上移「購物清單」' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下移「庫存與提醒」' })).toBeDisabled()
  })

  it('上下移動按鈕會改變側邊欄順序、存進設定並跟著同步資料匯出', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '上移「庫存與提醒」' }))
    fireEvent.click(screen.getByRole('button', { name: '上移「庫存與提醒」' }))
    expect(rows()).toEqual(['購物清單', '庫存與提醒', '防遺漏提醒', '訂閱與續費'])
    expect(sidebar()).toEqual(['購物清單', '庫存與提醒', '防遺漏提醒', '訂閱與續費'])
    expect(useAppStore.getState().exportData().settings.navOrder).toEqual({ collect: ['shopping', 'inventory', 'reminders', 'subscriptions'] })
    expect(screen.getByText('「庫存與提醒」已移到第 2 個，共 4 個')).toHaveAttribute('aria-live', 'polite')
    // 焦點留在同一顆按鈕，可以連續按
    expect(screen.getByRole('button', { name: '上移「庫存與提醒」' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '恢復預設順序' }))
    expect(rows()).toEqual(['購物清單', '防遺漏提醒', '訂閱與續費', '庫存與提醒'])
    expect(useAppStore.getState().settings.navOrder).toBeUndefined()
  })

  it('移回預設順序時不另外存', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '下移「購物清單」' }))
    expect(useAppStore.getState().settings.navOrder).toEqual({ collect: ['reminders', 'shopping', 'subscriptions', 'inventory'] })
    fireEvent.click(screen.getByRole('button', { name: '上移「購物清單」' }))
    expect(useAppStore.getState().settings.navOrder).toBeUndefined()
  })

  it('把手可以用上下方向鍵移動，焦點留在把手', () => {
    renderApp()
    const handle = screen.getByRole('button', { name: '拖曳調整「防遺漏提醒」的順序' })
    handle.focus()
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(rows()).toEqual(['購物清單', '訂閱與續費', '庫存與提醒', '防遺漏提醒'])
    expect(screen.getByRole('button', { name: '拖曳調整「防遺漏提醒」的順序' })).toHaveFocus()
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(rows()).toEqual(['購物清單', '訂閱與續費', '防遺漏提醒', '庫存與提醒'])
  })

  it('拖曳把手（滑鼠或觸控）可以排序，放開才存', () => {
    renderApp()
    // jsdom 沒有版面，給每一列假的位置：每列高 50px
    within(list())
      .getAllByRole('listitem')
      .forEach((li, i) => {
        li.getBoundingClientRect = () => ({ top: i * 50, height: 50, bottom: i * 50 + 50, left: 0, right: 300, width: 300, x: 0, y: i * 50, toJSON: () => ({}) })
      })
    const handle = screen.getByRole('button', { name: '拖曳調整「購物清單」的順序' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 25 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 140 })
    expect(rows()).toEqual(['防遺漏提醒', '訂閱與續費', '購物清單', '庫存與提醒'])
    expect(useAppStore.getState().settings.navOrder).toBeUndefined()
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 140 })
    expect(useAppStore.getState().settings.navOrder).toEqual({ collect: ['reminders', 'subscriptions', 'shopping', 'inventory'] })
    expect(sidebar()).toEqual(['防遺漏提醒', '訂閱與續費', '購物清單', '庫存與提醒'])
  })

  it('拖曳被取消時不改變順序', () => {
    renderApp()
    within(list())
      .getAllByRole('listitem')
      .forEach((li, i) => {
        li.getBoundingClientRect = () => ({ top: i * 50, height: 50, bottom: i * 50 + 50, left: 0, right: 300, width: 300, x: 0, y: i * 50, toJSON: () => ({}) })
      })
    const handle = screen.getByRole('button', { name: '拖曳調整「購物清單」的順序' })
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 25 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 190 })
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    expect(rows()).toEqual(['購物清單', '防遺漏提醒', '訂閱與續費', '庫存與提醒'])
    expect(useAppStore.getState().settings.navOrder).toBeUndefined()
  })

  it('同步或備份來的順序含已移除項目、缺新項目時仍能正常顯示', () => {
    const data = migrate({ ...emptyAppData(), settings: { fontSize: 'md', currency: 'TWD', navOrder: { collect: ['inventory', 'oldFeature', 'shopping'] } } })
    expect(data.settings.navOrder).toEqual({ collect: ['inventory', 'oldFeature', 'shopping'] })
    useAppStore.setState(data)
    renderApp()
    expect(sidebar()).toEqual(['庫存與提醒', '購物清單', '防遺漏提醒', '訂閱與續費'])
  })

  it('側邊欄有編輯排序的入口，連到設定頁的排序區塊', () => {
    renderApp('/')
    const link = screen.getByRole('link', { name: '編輯「收集與整理」的排序' })
    expect(link).toHaveAttribute('href', '/settings#nav-order')
  })

  it('日文與英文也有翻譯', async () => {
    await i18n.changeLanguage('ja')
    renderApp()
    expect(screen.getByRole('heading', { name: 'サイドバーの並び順' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '初期の並び順に戻す' })).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'

describe('背景預先下載頁面', () => {
  it('依序下載每個頁面（一次一個），只啟動一次', async () => {
    vi.useFakeTimers()
    // @ts-expect-error 測試環境移除 requestIdleCallback，走 setTimeout 的備用路徑
    delete window.requestIdleCallback
    const { prefetchPages } = await import('./router')
    const loaded: string[] = []
    let inFlight = 0
    let maxInFlight = 0
    const load = (key: string) => {
      loaded.push(key)
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      return Promise.resolve().then(() => void inFlight--)
    }
    prefetchPages(load)
    prefetchPages(load)
    await vi.runAllTimersAsync()
    expect(loaded[0]).toBe('calendar')
    expect(new Set(loaded).size).toBe(loaded.length)
    expect(loaded).toEqual(expect.arrayContaining(['calendar', 'tasks', 'shopping', 'places', 'reminders', 'settings', 'subscriptions', 'inventory']))
    expect(maxInFlight).toBe(1)
    vi.useRealTimers()
  })
})

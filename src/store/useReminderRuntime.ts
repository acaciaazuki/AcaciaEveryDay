import { create } from 'zustand'
import type { Reminder } from '../core/schema'

export type MonitorStatus = 'idle' | 'watching' | 'denied' | 'unsupported' | 'error'

export interface ReminderAlert {
  /** 同一條規則同一個方向只留一張提醒 */
  id: string
  ruleId: string
  place: string
  kind: 'arrive' | 'leave'
  items: string[]
  checked: string[]
  at: number
}

interface RuntimeState {
  status: MonitorStatus
  alerts: ReminderAlert[]
  setStatus: (s: MonitorStatus) => void
  push: (r: Reminder, kind: 'arrive' | 'leave') => void
  toggleItem: (alertId: string, item: string) => void
  dismiss: (alertId: string) => void
}

/** 執行中的狀態（定位監測、頁面內提醒），不存檔也不同步 */
export const useReminderRuntime = create<RuntimeState>()((set) => ({
  status: 'idle',
  alerts: [],
  setStatus: (status) => set({ status }),
  push: (r, kind) =>
    set((s) => {
      const id = `${r.id}:${kind}`
      const alert: ReminderAlert = { id, ruleId: r.id, place: r.place, kind, items: r.items, checked: [], at: Date.now() }
      return { alerts: [alert, ...s.alerts.filter((a) => a.id !== id)] }
    }),
  toggleItem: (alertId, item) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, checked: a.checked.includes(item) ? a.checked.filter((x) => x !== item) : [...a.checked, item] } : a)),
    })),
  dismiss: (alertId) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== alertId) })),
}))

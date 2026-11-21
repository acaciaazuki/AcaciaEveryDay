import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { webStorage } from '../adapters/storage'
import { migrate } from '../core/migrate'
import { emptyAppData, newId, type AppData, type CalendarEvent, type Expense, type Task } from '../core/schema'

type TaskInput = Omit<Task, 'id' | 'done'>
type ExpenseInput = Omit<Expense, 'id' | 'done'>
type EventInput = Omit<CalendarEvent, 'id'>

interface Actions {
  addEvent: (input: EventInput) => void
  addEvents: (inputs: EventInput[]) => void
  updateEvent: (id: string, patch: Partial<EventInput>) => void
  removeEvent: (id: string) => void
  addTask: (input: TaskInput) => void
  updateTask: (id: string, patch: Partial<TaskInput>) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  addExpense: (input: ExpenseInput) => void
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => void
  toggleExpense: (id: string) => void
  removeExpense: (id: string) => void
  /** 匯入（舊版或新版 JSON），失敗時丟出錯誤、不覆蓋現有資料 */
  importData: (raw: unknown) => void
  exportData: () => AppData
}

export type AppState = AppData & Actions

const touch = () => ({ updatedAt: Date.now() })

export const useAppStore = create<AppState>()(
  persist(
    (setState, getState) => ({
      ...emptyAppData(),

      addEvent: (input) => setState((s) => ({ events: [...s.events, { id: newId(), ...input }], ...touch() })),
      addEvents: (inputs) =>
        setState((s) => ({ events: [...s.events, ...inputs.map((i) => ({ id: newId(), ...i }))], ...touch() })),
      updateEvent: (id, patch) =>
        setState((s) => ({ events: s.events.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeEvent: (id) => setState((s) => ({ events: s.events.filter((x) => x.id !== id), ...touch() })),

      addTask: (input) =>
        setState((s) => ({ tasks: [{ id: newId(), done: false, ...input }, ...s.tasks], ...touch() })),
      updateTask: (id, patch) =>
        setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)), ...touch() })),
      toggleTask: (id) =>
        setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)), ...touch() })),
      removeTask: (id) => setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), ...touch() })),

      addExpense: (input) =>
        setState((s) => ({ shopping: [{ id: newId(), done: false, ...input }, ...s.shopping], ...touch() })),
      updateExpense: (id, patch) =>
        setState((s) => ({ shopping: s.shopping.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      toggleExpense: (id) =>
        setState((s) => ({ shopping: s.shopping.map((x) => (x.id === id ? { ...x, done: !x.done } : x)), ...touch() })),
      removeExpense: (id) => setState((s) => ({ shopping: s.shopping.filter((x) => x.id !== id), ...touch() })),

      importData: (raw) => setState(migrate(raw)),
      exportData: () => {
        const { schemaVersion, events, tasks, shopping, places, favorites, updatedAt } = getState()
        return { schemaVersion, events, tasks, shopping, places, favorites, updatedAt }
      },
    }),
    {
      name: 'acacia-next',
      storage: createJSONStorage(() => webStorage),
      partialize: (s) => s.exportData(),
      version: 2,
    },
  ),
)

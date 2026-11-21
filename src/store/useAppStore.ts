import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { webStorage } from '../adapters/storage'
import { archiveCurrent, archiveEnded, restoreArchive as restoreArchiveData } from '../core/archive'
import { migrate } from '../core/migrate'
import { emptyAppData, newId, type AppData, type FontSize, type CalendarEvent, type Expense, type Place, type Reminder, type Task } from '../core/schema'

type TaskInput = Omit<Task, 'id' | 'done'>
type ExpenseInput = Omit<Expense, 'id' | 'done'>
type EventInput = Omit<CalendarEvent, 'id'>
type PlaceInput = Omit<Place, 'id'>
type ReminderInput = Omit<Reminder, 'id'>

interface Actions {
  addEvent: (input: EventInput) => void
  addEvents: (inputs: EventInput[]) => void
  updateEvent: (id: string, patch: Partial<EventInput>) => void
  removeEvent: (id: string) => void
  addPlace: (input: PlaceInput) => void
  updatePlace: (id: string, patch: Partial<PlaceInput>) => void
  removePlace: (id: string) => void
  addReminder: (input: ReminderInput) => void
  updateReminder: (id: string, patch: Partial<ReminderInput>) => void
  removeReminder: (id: string) => void
  addTask: (input: TaskInput) => void
  updateTask: (id: string, patch: Partial<TaskInput>) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  addExpense: (input: ExpenseInput) => void
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => void
  toggleExpense: (id: string) => void
  removeExpense: (id: string) => void
  setFontSize: (size: FontSize) => void
  /** 歸檔記帳：'ended' 把已結束週期的記帳收進年度記帳本，'current' 立即封存本期。回傳歸檔的筆數 */
  archiveShopping: (mode: 'ended' | 'current', todayISO: string) => number
  /** 把某個歸檔還原回記帳清單 */
  restoreArchive: (start: string) => void
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

      addPlace: (input) => setState((s) => ({ places: [{ id: newId(), ...input }, ...s.places], ...touch() })),
      updatePlace: (id, patch) =>
        setState((s) => ({ places: s.places.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removePlace: (id) =>
        setState((s) => ({ places: s.places.filter((x) => x.id !== id), favorites: s.favorites.filter((f) => f !== id), ...touch() })),

      addReminder: (input) => setState((s) => ({ reminders: [{ id: newId(), ...input }, ...s.reminders], ...touch() })),
      updateReminder: (id, patch) =>
        setState((s) => ({ reminders: s.reminders.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeReminder: (id) => setState((s) => ({ reminders: s.reminders.filter((x) => x.id !== id), ...touch() })),

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

      setFontSize: (fontSize) => setState((s) => ({ settings: { ...s.settings, fontSize }, ...touch() })),

      archiveShopping: (mode, todayISO) => {
        const { shopping, archives } = getState()
        const r = (mode === 'ended' ? archiveEnded : archiveCurrent)(shopping, archives, todayISO, Date.now())
        if (r.count === 0) return 0
        setState({ shopping: r.shopping, archives: r.archives, ...touch() })
        return r.count
      },
      restoreArchive: (start) => {
        const { shopping, archives } = getState()
        const r = restoreArchiveData(shopping, archives, start)
        setState({ shopping: r.shopping, archives: r.archives, ...touch() })
      },

      importData: (raw) => setState(migrate(raw)),
      exportData: () => {
        const { schemaVersion, settings, events, tasks, shopping, places, favorites, reminders, archives, updatedAt } = getState()
        return { schemaVersion, settings, events, tasks, shopping, places, favorites, reminders, archives, updatedAt }
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

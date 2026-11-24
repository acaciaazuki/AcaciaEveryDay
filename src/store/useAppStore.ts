import { create } from 'zustand'
import { trackChanges } from '../core/appMerge'
import { createJSONStorage, persist } from 'zustand/middleware'
import { webStorage } from '../adapters/storage'
import { archiveCurrent, archiveEnded, periodOf, restoreArchive as restoreArchiveData } from '../core/archive'
import { clearCountry, importSets, type HolidayFile, type ImportResult } from '../core/holidays'
import { addCustomCat, removeCustomCat } from '../core/invCategories'
import { invToExpense, restockQty, toggleShoppingStock, type StockChange } from '../core/inventory'
import { migrate } from '../core/migrate'
import type { PlaceSort } from '../core/placeSort'
import { buildImports, importedKeys, rollbackInstallment, type ImportPick } from '../core/recurring'
import { DEFAULT_CURRENCY, emptyAppData, newId, type AppData, type FontSize, type CalendarEvent, type Expense, type InventoryItem, type Place, type Recurring, type Reminder, type Subscription, type Task } from '../core/schema'

type TaskInput = Omit<Task, 'id' | 'done'>
type ExpenseInput = Omit<Expense, 'id' | 'done'>
type EventInput = Omit<CalendarEvent, 'id'>
type PlaceInput = Omit<Place, 'id'>
type ReminderInput = Omit<Reminder, 'id'>
export type SubscriptionInput = Omit<Subscription, 'id'>
export type InventoryInput = Omit<InventoryItem, 'id'>
export type RecurringInput = Omit<Recurring, 'id'>

interface Actions {
  addEvent: (input: EventInput) => void
  /** 一次新增多筆（批次建立）；回傳新行程的 id，給「復原」使用 */
  addEvents: (inputs: EventInput[]) => string[]
  updateEvent: (id: string, patch: Partial<EventInput>) => void
  removeEvent: (id: string) => void
  /** 一次刪除多筆（批次建立的復原） */
  removeEvents: (ids: readonly string[]) => void
  addPlace: (input: PlaceInput) => void
  updatePlace: (id: string, patch: Partial<PlaceInput>) => void
  removePlace: (id: string) => void
  /** 最愛地點的自訂順序：傳入新的 id 順序（漏掉的地點依原順序補在最後） */
  reorderPlaces: (ids: string[]) => void
  /** 最愛地點的排序方式 */
  setPlaceSort: (sort: PlaceSort) => void
  addReminder: (input: ReminderInput) => void
  updateReminder: (id: string, patch: Partial<ReminderInput>) => void
  removeReminder: (id: string) => void
  addTask: (input: TaskInput) => void
  updateTask: (id: string, patch: Partial<TaskInput>) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  addExpense: (input: ExpenseInput) => void
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => void
  /** 打勾／取消打勾；對得到庫存用品時會自動補進（或扣回）庫存，回傳庫存變動 */
  toggleExpense: (id: string) => StockChange | undefined
  removeExpense: (id: string) => void
  addSubscription: (input: SubscriptionInput) => void
  updateSubscription: (id: string, patch: Partial<SubscriptionInput>) => void
  removeSubscription: (id: string) => void
  /**
   * 第一次進入訂閱頁時帶入範例。不更新 updatedAt：範例不算使用者的修改，
   * 新裝置登入時雲端資料仍然會優先。
   */
  seedSubscriptions: (inputs: SubscriptionInput[]) => void
  addInventory: (input: InventoryInput) => void
  updateInventory: (id: string, patch: Partial<InventoryInput>) => void
  removeInventory: (id: string) => void
  /** 使用 −1／補充 +1；庫存不會小於 0 */
  adjustStock: (id: string, delta: number) => void
  /** 今天更換了：上次更換日改成今天，重新開始倒數 */
  markReplaced: (id: string, todayISO: string) => void
  /**
   * 把待補貨的用品寫進購物清單（記帳清單的一筆：品名＋建議數量，金額先記 0），
   * 並記下連結。已經在清單中（還沒買）就不重複加入。回傳加入的數量，沒加入回傳 0
   */
  addInventoryToShopping: (id: string, todayISO: string, time: string) => number
  /** 購物清單那一筆已打勾：把買到的數量補進庫存，並解除連結。回傳補進的數量 */
  restockFromShopping: (id: string) => number
  /** 第一次進入庫存頁時帶入範例；跟訂閱一樣不更新 updatedAt */
  seedInventory: (inputs: InventoryInput[]) => void
  /** 新增自訂庫存分類（名稱請先用 validateCatName 驗證），回傳新分類 id */
  addInvCategory: (name: string) => string
  /** 刪除自訂庫存分類，原本屬於它的用品改歸「其他」；回傳改歸的用品數。內建分類不可刪 */
  removeInvCategory: (id: string) => number
  /** 庫存分類的順序；傳 null 恢復預設順序 */
  setInvCatOrder: (keys: string[] | null) => void
  addRecurring: (input: RecurringInput) => void
  updateRecurring: (id: string, patch: Partial<RecurringInput>) => void
  removeRecurring: (id: string) => void
  /**
   * 批次把固定支出寫進今天所在週期的記帳清單。已完成、本期已帶入過的範本會略過；
   * 分期款期數加 1。回傳實際加入的筆數
   */
  /** 回傳加入了幾筆記帳，以及這次付完最後一期、自動標記完成的範本名稱 */
  importRecurring: (picks: ImportPick[], todayISO: string) => { count: number; completed: string[] }
  /** 把某國某幾年的國定假日寫進行事曆（同國家同年份整份替換，不會重複）。回傳新增、更新、略過的年份 */
  importHolidays: (file: HolidayFile, years: number[]) => Omit<ImportResult, 'sets'>
  /** 清除某國匯入的所有假日 */
  clearHolidays: (country: string) => void
  /** 匯入國定假日用的國家 */
  setHolidayCountry: (country: string) => void
  setFontSize: (size: FontSize) => void
  /** 預設貨幣（三碼 ISO，例如 TWD、USD）。只影響顯示與新增時的預設值，不改動已存的資料 */
  setCurrency: (currency: string) => void
  /** 今天頁節奏的起床與就寢時間；null 回到預設 07:00–23:00 */
  setRhythm: (rhythm: { wake: string; sleep: string } | null) => void
  /** 側邊欄某個區塊的自訂順序；傳 null 恢復預設順序 */
  setNavOrder: (section: string, keys: string[] | null) => void
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
    (rawSet, getState) => {
      /**
       * 所有修改都經過這裡：比對修改前後，自動更新逐筆同步用的修改紀錄（syncMeta，見 core/appMerge.ts）。
       * 從外部呼叫 useAppStore.setState（例如同步套用雲端合併結果）不經過這裡，修改紀錄以合併結果為準。
       */
      const setState = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
        rawSet((s) => {
          const patch = typeof partial === 'function' ? partial(s) : partial
          const next = { ...s, ...patch }
          return { ...patch, syncMeta: trackChanges(s, next, Date.now()) }
        })
      return {
      ...emptyAppData(),

      addEvent: (input) => setState((s) => ({ events: [...s.events, { id: newId(), ...input }], ...touch() })),
      addEvents: (inputs) => {
        const created = inputs.map((i) => ({ id: newId(), ...i }))
        setState((s) => ({ events: [...s.events, ...created], ...touch() }))
        return created.map((e) => e.id)
      },
      updateEvent: (id, patch) =>
        setState((s) => ({ events: s.events.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeEvent: (id) => setState((s) => ({ events: s.events.filter((x) => x.id !== id), ...touch() })),
      removeEvents: (ids) => {
        const drop = new Set(ids)
        setState((s) => ({ events: s.events.filter((x) => !drop.has(x.id)), ...touch() }))
      },

      addPlace: (input) => setState((s) => ({ places: [{ id: newId(), ...input }, ...s.places], ...touch() })),
      updatePlace: (id, patch) =>
        setState((s) => ({ places: s.places.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removePlace: (id) =>
        setState((s) => ({ places: s.places.filter((x) => x.id !== id), favorites: s.favorites.filter((f) => f !== id), ...touch() })),
      reorderPlaces: (ids) =>
        setState((s) => {
          const byId = new Map(s.places.map((p) => [p.id, p]))
          const seen = new Set<string>()
          const next: Place[] = []
          for (const id of ids) {
            const p = byId.get(id)
            if (p && !seen.has(id)) {
              next.push(p)
              seen.add(id)
            }
          }
          for (const p of s.places) if (!seen.has(p.id)) next.push(p)
          if (next.every((p, i) => p === s.places[i])) return {}
          return { places: next, ...touch() }
        }),
      setPlaceSort: (sort) =>
        setState((s) => (s.settings.placeSort === sort || (!s.settings.placeSort && sort === 'custom') ? {} : { settings: { ...s.settings, placeSort: sort }, ...touch() })),

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
      toggleExpense: (id) => {
        const { shopping, inventory } = getState()
        const r = toggleShoppingStock(shopping, inventory, id)
        setState({ shopping: r.shopping, inventory: r.inventory, ...touch() })
        return r.change
      },
      removeExpense: (id) =>
        setState((s) => {
          const removed = s.shopping.find((x) => x.id === id)
          return {
            shopping: s.shopping.filter((x) => x.id !== id),
            // 刪掉剛帶入的分期款時把期數退回，重新帶入才不會跳號
            ...(removed?.recurringId ? { recurring: rollbackInstallment(s.recurring, removed) } : {}),
            ...touch(),
          }
        }),

      addRecurring: (input) => setState((s) => ({ recurring: [...s.recurring, { id: newId(), ...input }], ...touch() })),
      updateRecurring: (id, patch) =>
        setState((s) => ({ recurring: s.recurring.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeRecurring: (id) => setState((s) => ({ recurring: s.recurring.filter((x) => x.id !== id), ...touch() })),
      importRecurring: (picks, todayISO) => {
        const { recurring, shopping, archives } = getState()
        const period = periodOf(todayISO)
        const r = buildImports(recurring, picks, period, importedKeys(shopping, archives))
        if (r.expenses.length === 0) return { count: 0, completed: [] }
        setState((s) => ({ shopping: [...r.expenses, ...s.shopping], recurring: r.templates, ...touch() }))
        return { count: r.expenses.length, completed: r.completed.map((x) => x.name) }
      },

      addSubscription: (input) =>
        setState((s) => ({ subscriptions: [{ id: newId(), ...input }, ...s.subscriptions], subscriptionsSeeded: true, ...touch() })),
      updateSubscription: (id, patch) =>
        setState((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeSubscription: (id) => setState((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id), ...touch() })),
      seedSubscriptions: (inputs) =>
        setState((s) =>
          s.subscriptionsSeeded ? {} : { subscriptions: [...s.subscriptions, ...inputs.map((i) => ({ id: newId(), ...i }))], subscriptionsSeeded: true },
        ),

      addInventory: (input) =>
        setState((s) => ({ inventory: [{ id: newId(), ...input }, ...s.inventory], inventorySeeded: true, ...touch() })),
      updateInventory: (id, patch) =>
        setState((s) => ({ inventory: s.inventory.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...touch() })),
      removeInventory: (id) => setState((s) => ({ inventory: s.inventory.filter((x) => x.id !== id), ...touch() })),
      adjustStock: (id, delta) =>
        setState((s) => ({ inventory: s.inventory.map((x) => (x.id === id ? { ...x, stock: Math.max(0, x.stock + delta) } : x)), ...touch() })),
      markReplaced: (id, todayISO) =>
        setState((s) => ({ inventory: s.inventory.map((x) => (x.id === id ? { ...x, lastReplaced: todayISO } : x)), ...touch() })),
      addInventoryToShopping: (id, todayISO, time) => {
        const { inventory, shopping, settings } = getState()
        const item = inventory.find((x) => x.id === id)
        if (!item) return 0
        const linked = item.shoppingId ? shopping.find((e) => e.id === item.shoppingId) : undefined
        if (linked && !linked.done) return 0
        const quantity = restockQty(item)
        const expense: Expense = {
          id: newId(),
          title: item.name,
          amt: 0,
          store: '',
          cat: invToExpense(item.cat),
          quantity,
          // 先記下當下的預設貨幣，之後改預設貨幣也不會讓這一筆跟著變
          currency: settings.currency || DEFAULT_CURRENCY,
          date: todayISO,
          time,
          done: false,
        }
        setState((s) => ({
          shopping: [expense, ...s.shopping],
          inventory: s.inventory.map((x) => (x.id === id ? { ...x, shoppingId: expense.id } : x)),
          ...touch(),
        }))
        return quantity
      },
      restockFromShopping: (id) => {
        const { inventory, shopping } = getState()
        const item = inventory.find((x) => x.id === id)
        const linked = item?.shoppingId ? shopping.find((e) => e.id === item.shoppingId) : undefined
        if (!item || !linked) return 0
        const qty = linked.quantity && linked.quantity > 0 ? linked.quantity : 1
        // 舊資料（自動入庫之前就打勾的）才會走到這裡；記下入庫記號，之後取消打勾才扣得回來、也不會再入庫一次
        if (linked.stockedItemId) return 0
        setState((s) => ({
          inventory: s.inventory.map((x) => (x.id === id ? { ...x, stock: x.stock + qty, shoppingId: undefined } : x)),
          shopping: s.shopping.map((e) => (e.id === linked.id ? { ...e, stockedItemId: id, stockedQty: qty } : e)),
          ...touch(),
        }))
        return qty
      },
      seedInventory: (inputs) =>
        setState((s) => (s.inventorySeeded ? {} : { inventory: [...s.inventory, ...inputs.map((i) => ({ id: newId(), ...i }))], inventorySeeded: true })),
      addInvCategory: (name) => {
        const id = `c_${newId()}`
        setState((s) => ({ invCats: addCustomCat(s.invCats, name, id), ...touch() }))
        return id
      },
      removeInvCategory: (id) => {
        const { invCats, inventory } = getState()
        if (!invCats.custom.some((c) => c.id === id)) return 0
        const r = removeCustomCat(invCats, inventory, id)
        setState({ invCats: r.invCats, inventory: r.inventory, ...touch() })
        return r.moved
      },
      setInvCatOrder: (keys) => setState((s) => ({ invCats: { ...s.invCats, order: keys ?? [] }, ...touch() })),

      importHolidays: (file, years) => {
        const { sets, ...result } = importSets(getState().holidays, file, years, Date.now())
        if (result.added.length || result.updated.length) setState({ holidays: sets, ...touch() })
        return result
      },
      clearHolidays: (country) => setState((s) => ({ holidays: clearCountry(s.holidays, country), ...touch() })),
      setHolidayCountry: (holidayCountry) => setState((s) => ({ settings: { ...s.settings, holidayCountry }, ...touch() })),

      setFontSize: (fontSize) => setState((s) => ({ settings: { ...s.settings, fontSize }, ...touch() })),
      setCurrency: (currency) => setState((s) => ({ settings: { ...s.settings, currency }, ...touch() })),
      setRhythm: (rhythm) =>
        setState((s) => {
          const { rhythm: _prev, ...base } = s.settings
          void _prev
          return { settings: rhythm ? { ...base, rhythm } : base, ...touch() }
        }),
      setNavOrder: (section, keys) =>
        setState((s) => {
          const { [section]: _old, ...rest } = s.settings.navOrder ?? {}
          void _old
          const navOrder = keys ? { ...rest, [section]: keys } : rest
          const { navOrder: _prev, ...base } = s.settings
          void _prev
          return { settings: Object.keys(navOrder).length ? { ...base, navOrder } : base, ...touch() }
        }),

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
        const { schemaVersion, settings, events, tasks, shopping, places, favorites, reminders, archives, subscriptions, subscriptionsSeeded, inventory, inventorySeeded, invCats, recurring, holidays, updatedAt, syncMeta } = getState()
        return { schemaVersion, settings, events, tasks, shopping, places, favorites, reminders, archives, subscriptions, subscriptionsSeeded, inventory, inventorySeeded, invCats, recurring, holidays, updatedAt, ...(syncMeta && { syncMeta }) }
      },
    }
    },
    {
      name: 'acacia-next',
      storage: createJSONStorage(() => webStorage),
      partialize: (s) => s.exportData(),
      // 舊版存的 settings 沒有新欄位（例如 currency），合併時補上預設值，不讓整個 settings 被蓋掉
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } }
      },
      version: 2,
    },
  ),
)

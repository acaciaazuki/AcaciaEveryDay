import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { webStorage } from '../adapters/storage'
import type { CalendarFilter } from '../core/calendarView'
import { applyItemEdit, PermissionError, softDeleteItem, type ItemPatch } from '../core/permissions'
import { prepareSpacesRestore } from '../core/spacesBackup'
import { applyPulled as mergePulled, type PulledData, type SyncConflict } from '../core/syncEnvelope'
import {
  busyProjectionRuleSchema,
  canManageSpace,
  createSpace as makeSpace,
  emptySharedCalendarData,
  migrateSharedCalendarData,
  PERSONAL_CALENDAR_ID,
  rekeyOwner,
  removeMember as dropMember,
  roleOf,
  ruleTargets,
  sharedCalendarItemSchema,
  spaceSchema,
  upsertMember,
  type BusyProjectionRule,
  type PersonalBusySlot,
  type MemberRole,
  type SharedCalendarData,
  type SharedCalendarItemInput,
  type Space,
  type SpaceKind,
} from '../core/sharing'

/**
 * 共享行事曆空間（家人／學校／工作／個人）。
 *
 * - 存在 IndexedDB 的 acacia-spaces，和主資料 acacia-next 分開；
 *   不進 exportData()、acacia_data_v2.json 與自動備份，個人行程（useAppStore.events）完全不受影響
 * - 目前還沒有帳號：第一次使用時產生 selfId（local-…），其他成員都是在這台裝置上建立的「模擬成員」，
 *   用來預覽他們會看到什麼
 * - 切換到其他成員的視角是唯讀預覽：所有修改動作都會被拒絕；重新開啟 App 一律回到自己的視角
 * - 畫面不能直接讀 data.items，要透過 useVisibleCalendar（會經過權限過濾），有掃描測試把關
 */

export const SPACES_STORAGE_KEY = 'acacia-spaces'

export class PreviewModeError extends PermissionError {}

const newSelfId = () => `local-${crypto.randomUUID()}`
const newId = () => crypto.randomUUID()

export type NewItemInput = Omit<SharedCalendarItemInput, 'id' | 'spaceId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'version' | 'deletedAt' | 'redaction' | 'projection'>
export type RuleInput = Pick<BusyProjectionRule, 'sourceId'> &
  Partial<Pick<BusyProjectionRule, 'targetMode' | 'targetIds' | 'display' | 'kinds' | 'label' | 'includePrivate' | 'includeAllDay' | 'enabled'>>

/** 規則實際指定的目標（全部時用目前算出來的結果），用來比對修改前後少了哪些 */
const chosenTargets = (r: BusyProjectionRule, spaces: readonly Space[]) => (r.targetMode === 'all' ? ruleTargets(r, spaces) : r.targetIds)

interface SpacesState {
  selfId: string
  data: SharedCalendarData
  /** 目前用誰的視角檢視（不存檔） */
  viewerId: string
  /** 行事曆篩選（不存檔） */
  filter: CalendarFilter
  /** 這台裝置是否開啟共享空間雲端同步（acacia_spaces_v1.json）；只存在本機，不會同步出去 */
  cloudSync: boolean

  setViewer: (userId: string) => void
  setFilter: (filter: CalendarFilter) => void

  createSpace: (input: { name: string; kind: SpaceKind; color?: string }) => string
  renameSpace: (spaceId: string, name: string) => void
  deleteSpace: (spaceId: string) => void
  /** 新增模擬成員，回傳成員 id */
  addMember: (spaceId: string, input: { displayName: string; role: MemberRole }) => string
  updateMember: (spaceId: string, userId: string, patch: { role?: MemberRole; displayName?: string }) => void
  removeMember: (spaceId: string, userId: string) => void

  addItem: (spaceId: string, input: NewItemInput) => string
  updateItem: (id: string, patch: ItemPatch) => void
  removeItem: (id: string) => void

  addRule: (input: RuleInput) => string
  updateRule: (id: string, patch: Partial<RuleInput>) => void
  removeRule: (id: string) => void
  /** 由鏡像程序（personalBusyMirror）呼叫：更新「我的行事曆」的忙碌影子；不受預覽模式限制（不是使用者的操作） */
  setPersonalBusySlots: (slots: PersonalBusySlot[]) => void

  /** 匯出／匯入接口（Drive 同步與快照使用） */
  exportSpaces: () => SharedCalendarData
  importSpaces: (raw: unknown) => void

  setCloudSync: (on: boolean) => void
  /**
   * 套用從雲端拉下來、已依自己過濾過的資料（同步用，不是使用者的修改，預覽中也可以套用）。
   * 回傳自動解決的衝突。
   */
  applyPulled: (pulled: PulledData) => SyncConflict[]
  /** 對齊身分：改用雲端檔案的 id，本機資料裡自己的 id 一併換掉 */
  adoptIdentity: (id: string) => void
  /** 還原快照（先由呼叫端替目前資料留一份快照） */
  restoreSnapshot: (raw: unknown) => void
  /** 刪除所有資料：清空並換一個新的 selfId，跟第一次使用一樣 */
  reset: () => void
}

const initial = () => {
  const selfId = newSelfId()
  return { selfId, data: emptySharedCalendarData(selfId), viewerId: selfId, filter: 'all' as CalendarFilter, cloudSync: false }
}

export const useSpacesStore = create<SpacesState>()(
  persist(
    (set, get) => {
      /** 所有修改都要在自己的視角下進行 */
      const guard = () => {
        const { viewerId, selfId } = get()
        if (viewerId !== selfId) throw new PreviewModeError('預覽其他成員的視角時不能修改')
        return selfId
      }
      const commit = (patch: Partial<SharedCalendarData>) => set((s) => ({ data: { ...s.data, ...patch, updatedAt: Date.now() } }))
      const spaceOf = (spaceId: string) => {
        const space = get().data.spaces.find((s) => s.id === spaceId && s.deletedAt === null)
        if (!space) throw new PermissionError('找不到這個空間')
        return space
      }
      const replaceSpace = (next: Space) => commit({ spaces: get().data.spaces.map((s) => (s.id === next.id ? next : s)) })
      const ownerOnly = (spaceId: string) => {
        const self = guard()
        const space = spaceOf(spaceId)
        if (!canManageSpace(space, self)) throw new PermissionError('只有 owner 可以管理空間')
        return { self, space }
      }
      const itemOf = (id: string) => {
        const item = get().data.items.find((i) => i.id === id)
        if (!item) throw new PermissionError('找不到這筆行程')
        return { item, space: spaceOf(item.spaceId) }
      }
      const replaceItem = (next: SharedCalendarData['items'][number]) => commit({ items: get().data.items.map((i) => (i.id === next.id ? next : i)) })

      return {
        ...initial(),

        setViewer: (userId) => set({ viewerId: userId }),
        setFilter: (filter) => set({ filter }),

        createSpace: ({ name, kind, color }) => {
          const self = guard()
          const space = makeSpace({ id: newId(), name, kind, color, ownerId: self, now: Date.now() })
          commit({ spaces: [...get().data.spaces, space] })
          return space.id
        },
        renameSpace: (spaceId, name) => {
          const { space } = ownerOnly(spaceId)
          replaceSpace(spaceSchema.parse({ ...space, name, updatedAt: Date.now(), version: space.version + 1 }))
        },
        deleteSpace: (spaceId) => {
          const { space } = ownerOnly(spaceId)
          const now = Date.now()
          replaceSpace({ ...space, deletedAt: now, updatedAt: now, version: space.version + 1 })
          // 跟這個空間有關的投射規則一起標記刪除（軟刪除才會同步到其他裝置）；篩選停在這個空間時回到全部
          commit({
            busyProjectionRules: get().data.busyProjectionRules.map((r) => {
              if (r.deletedAt !== null) return r
              // 來源被刪除，或唯一的目標被刪除：整條規則刪除；其他情況只把這個空間從目標拿掉
              if (r.sourceId === spaceId || (r.targetMode === 'selected' && r.targetIds.length === 1 && r.targetIds[0] === spaceId)) return { ...r, deletedAt: now, updatedAt: now }
              return r.targetIds.includes(spaceId) ? { ...r, targetIds: r.targetIds.filter((t) => t !== spaceId), updatedAt: now } : r
            }),
          })
          if (get().filter === spaceId) set({ filter: 'all' })
        },
        addMember: (spaceId, { displayName, role }) => {
          const { self, space } = ownerOnly(spaceId)
          const userId = `sim-${newId()}`
          replaceSpace(upsertMember(space, self, { userId, role, displayName: displayName.trim() }, Date.now()))
          return userId
        },
        updateMember: (spaceId, userId, patch) => {
          const { self, space } = ownerOnly(spaceId)
          const cur = space.members.find((m) => m.userId === userId)
          if (!cur) throw new PermissionError('找不到這位成員')
          replaceSpace(upsertMember(space, self, { userId, role: patch.role ?? cur.role, displayName: patch.displayName?.trim() ?? cur.displayName }, Date.now()))
        },
        removeMember: (spaceId, userId) => {
          const self = guard()
          replaceSpace(dropMember(spaceOf(spaceId), self, userId, Date.now()))
        },

        addItem: (spaceId, input) => {
          const self = guard()
          const role = roleOf(spaceOf(spaceId), self)
          if (role !== 'owner' && role !== 'editor') throw new PermissionError('這個空間只能檢視，不能新增行程')
          const now = Date.now()
          const item = sharedCalendarItemSchema.parse({ ...input, id: newId(), spaceId, createdBy: self, createdAt: now, updatedAt: now, updatedBy: self })
          commit({ items: [...get().data.items, item] })
          return item.id
        },
        updateItem: (id, patch) => {
          const self = guard()
          const { item, space } = itemOf(id)
          replaceItem(applyItemEdit(item, patch, self, space, Date.now()))
        },
        removeItem: (id) => {
          const self = guard()
          const { item, space } = itemOf(id)
          replaceItem(softDeleteItem(item, self, space, Date.now()))
        },

        addRule: (input) => {
          const self = guard()
          const targets = input.targetMode === 'all' ? [] : (input.targetIds ?? [])
          for (const id of [input.sourceId, ...targets]) if (id !== PERSONAL_CALENDAR_ID && !roleOf(spaceOf(id), self)) throw new PermissionError('不是這個空間的成員')
          // 空間 → 單一空間的規則記下原本的目標：區塊 id 沿用 v1 格式，舊版 App 也讀得懂這條規則
          const single = input.sourceId !== PERSONAL_CALENDAR_ID && input.targetMode !== 'all' && targets.length === 1 && targets[0] !== PERSONAL_CALENDAR_ID
          const rule = busyProjectionRuleSchema.parse({ ...input, ...(single && { legacyTargetId: targets[0] }), id: newId(), userId: self, updatedAt: Date.now() })
          commit({ busyProjectionRules: [...get().data.busyProjectionRules, rule] })
          return rule.id
        },
        updateRule: (id, patch) => {
          const self = guard()
          for (const t of patch.targetMode === 'all' ? [] : (patch.targetIds ?? [])) if (t !== PERSONAL_CALENDAR_ID && !roleOf(spaceOf(t), self)) throw new PermissionError('不是這個空間的成員')
          const spaces = get().data.spaces
          const rules = get().data.busyProjectionRules.map((r) => {
            if (r.id !== id) return r
            const next = busyProjectionRuleSchema.parse({ ...r, ...patch, updatedAt: Date.now() })
            const before = chosenTargets(r, spaces)
            const after = chosenTargets(next, spaces)
            if (before.length === after.length && before.every((t) => after.includes(t)) && r.targetMode === next.targetMode) return next
            // 目標有變：移除的目標記下來（同步時送墓碑），加回來的從清單拿掉；revision +2 讓新區塊蓋過先前的墓碑
            const retired = new Set([...next.retiredTargetIds, ...before.filter((t) => !after.includes(t))])
            for (const t of after) retired.delete(t)
            return { ...next, retiredTargetIds: [...retired], revision: next.revision + 2 }
          })
          commit({ busyProjectionRules: rules })
        },
        removeRule: (id) => {
          guard()
          const now = Date.now()
          commit({ busyProjectionRules: get().data.busyProjectionRules.map((r) => (r.id === id ? { ...r, deletedAt: now, updatedAt: now } : r)) })
        },

        setPersonalBusySlots: (slots) => commit({ personalBusySlots: slots }),

        exportSpaces: () => get().data,
        importSpaces: (raw) => {
          const self = guard()
          const data = migrateSharedCalendarData(raw)
          if (data.ownerId !== self) throw new PermissionError('這份資料屬於另一位使用者')
          set({ data })
        },
        reset: () => set(initial()),

        setCloudSync: (on) => set({ cloudSync: on }),
        applyPulled: (pulled) => {
          const r = mergePulled(get().data, pulled, get().selfId)
          if (r.changed) set({ data: r.data })
          return r.conflicts
        },
        adoptIdentity: (id) => {
          const { selfId, viewerId, data } = get()
          if (id === selfId) return
          set({ selfId: id, viewerId: viewerId === selfId ? id : viewerId, data: rekeyOwner(data, selfId, id) })
        },
        restoreSnapshot: (raw) => {
          guard()
          set({ data: prepareSpacesRestore(raw, get().data, Date.now()) })
        },
      }
    },
    {
      name: SPACES_STORAGE_KEY,
      storage: createJSONStorage(() => webStorage),
      // 只存身份與資料；檢視身份與篩選不存，重新開啟一律回到自己的視角
      partialize: (s) => ({ selfId: s.selfId, data: s.data, cloudSync: s.cloudSync }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<SpacesState, 'selfId' | 'data' | 'cloudSync'>>
        if (!p.selfId || !p.data) return current
        try {
          const data = migrateSharedCalendarData(p.data)
          if (data.ownerId !== p.selfId) throw new Error('ownerId 與 selfId 不符')
          return { ...current, selfId: p.selfId, data, viewerId: p.selfId, filter: 'all', cloudSync: p.cloudSync === true }
        } catch (e) {
          // 資料壞掉時不要拿來用；保留在 IndexedDB 的原始內容要等下一次寫入才會被覆蓋
          console.error('共享行事曆資料讀取失敗', e)
          return current
        }
      },
      version: 1,
    },
  ),
)

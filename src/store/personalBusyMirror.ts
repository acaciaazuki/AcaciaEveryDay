import { needsPersonalBusySlots, syncPersonalBusySlots } from '../core/personalBusy'
import { useAppStore } from './useAppStore'
import { useSpacesStore } from './useSpacesStore'

let started = false

/** 依目前的個人行程更新「我的行事曆」的忙碌影子；沒有以「我的行事曆」為來源的規則時什麼都不做 */
export function mirrorPersonalBusyNow(now = Date.now()) {
  const sp = useSpacesStore.getState()
  // 寫入保護中（本機資料來自較新版本）不更新影子
  if (sp.blockedReason) return
  if (!needsPersonalBusySlots(sp.data.busyProjectionRules, sp.selfId)) return
  const next = syncPersonalBusySlots(sp.data.personalBusySlots, useAppStore.getState().events, now)
  if (next) sp.setPersonalBusySlots(next)
}

const hydrated = (store: { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }) =>
  store.persist.hasHydrated() ? Promise.resolve() : new Promise<void>((r) => store.persist.onFinishHydration(() => r()))

/**
 * 個人行程 → 忙碌影子的鏡像程序（App 啟動時呼叫一次）。
 * - 兩個 store 都讀取完成後先比對一次，之後個人行程或投射規則有變動就再比對
 * - 影子有變化才寫入共享資料，寫入後由共享空間同步（startSpacesSync）在 1.5 秒後上傳，
 *   其他成員手上的忙碌區塊就會跟著新增、修改或移除
 * - 沒有變化時不寫入，所以寫入影子觸發的訂閱不會造成循環
 */
export function startPersonalBusyMirror() {
  if (started) return
  started = true
  void Promise.all([hydrated(useAppStore), hydrated(useSpacesStore)]).then(() => {
    mirrorPersonalBusyNow()
    useAppStore.subscribe((s, prev) => {
      if (s.events !== prev.events) mirrorPersonalBusyNow()
    })
    useSpacesStore.subscribe((s, prev) => {
      if (s.data.busyProjectionRules !== prev.data.busyProjectionRules || s.selfId !== prev.selfId) mirrorPersonalBusyNow()
    })
  })
}

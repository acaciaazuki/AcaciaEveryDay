import { del, get, set as idbSet } from 'idb-keyval'
import { create } from 'zustand'
import { makeRecord, parseRecord, pendingDocs, type ConsentDoc, type ConsentRecord } from '../core/consent'

/** IndexedDB 裡存同意紀錄的 key */
export const CONSENT_KEY = 'acacia-consent'

export type ConsentStatus = 'loading' | 'required' | 'accepted'

interface ConsentState {
  status: ConsentStatus
  /** 上次同意的紀錄；第一次使用時是 null */
  record: ConsentRecord | null
  /** 這次需要（重新）同意的文件 */
  pending: ConsentDoc[]
  load: () => Promise<void>
  accept: () => Promise<void>
  /** 刪除所有資料時一起清掉，下次開啟重新詢問 */
  reset: () => Promise<void>
}

const fromRecord = (record: ConsentRecord | null) => {
  const pending = pendingDocs(record)
  return { record, pending, status: (pending.length === 0 ? 'accepted' : 'required') as ConsentStatus }
}

export const useConsentStore = create<ConsentState>()((set) => ({
  status: 'loading',
  record: null,
  pending: [],
  load: async () => {
    let raw: unknown = null
    try {
      raw = await get(CONSENT_KEY)
    } catch {
      /* 讀不到（例如瀏覽器禁止 IndexedDB）就當作沒同意過 */
    }
    set(fromRecord(parseRecord(raw)))
  },
  accept: async () => {
    const record = makeRecord(Date.now())
    // 先放行再寫入：寫入失敗（無痕模式等）這次仍可使用，下次開啟會再詢問
    set(fromRecord(record))
    try {
      await idbSet(CONSENT_KEY, record)
    } catch (e) {
      console.error('同意紀錄寫入失敗', e)
    }
  },
  reset: async () => {
    try {
      await del(CONSENT_KEY)
    } catch {
      /* 忽略 */
    }
    set(fromRecord(null))
  },
}))

/**
 * 同意後才執行（例如 Google 登入續用、自動備份）。已經同意就馬上執行；
 * 只會執行一次。回傳取消函式。
 */
export function whenConsented(fn: () => void): () => void {
  if (useConsentStore.getState().status === 'accepted') {
    fn()
    return () => {}
  }
  const unsub = useConsentStore.subscribe((s) => {
    if (s.status !== 'accepted') return
    unsub()
    fn()
  })
  return unsub
}

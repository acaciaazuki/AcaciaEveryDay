import type { ItemKind } from './sharing'

/**
 * 依行程類型填寫的細節（存在 SharedCalendarItem.details）。
 * 細節一律當作敏感欄位：busy_only 整包移除，遮罩「細節」時也整包移除（見 permissions.ts）。
 */
export const DETAIL_KEYS = ['classroom', 'teacher', 'subject', 'submitMethod', 'examRoom', 'hospital', 'department', 'driver', 'meetingLink', 'project'] as const
export type DetailKey = (typeof DETAIL_KEYS)[number]

/** 每欄最多幾個字 */
export const DETAIL_MAX = 200

/** 各類型要填的欄位（依顯示順序）；沒列出的類型沒有細節欄位 */
export const DETAIL_FIELDS: Partial<Record<ItemKind, readonly DetailKey[]>> = {
  class_session: ['classroom', 'teacher'],
  assignment: ['subject', 'submitMethod'],
  exam: ['subject', 'examRoom'],
  medical_ride: ['hospital', 'department', 'driver'],
  meeting: ['meetingLink', 'project'],
  project_task: ['project'],
}

export const detailFieldsOf = (kind: ItemKind): readonly DetailKey[] => DETAIL_FIELDS[kind] ?? []

/**
 * 存檔前整理：只留這個類型的欄位、去掉前後空白與空值、超過長度截斷。
 * 換了類型時，舊類型的欄位不會殘留在資料裡。
 */
export function cleanDetails(kind: ItemKind, details: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of detailFieldsOf(kind)) {
    const v = (details[key] ?? '').trim().slice(0, DETAIL_MAX)
    if (v) out[key] = v
  }
  return out
}

/** 顯示用：依這個類型的欄位順序列出有填的細節（未知或其他類型的欄位不顯示） */
export const detailEntries = (kind: ItemKind, details: Readonly<Record<string, string>>): [DetailKey, string][] =>
  detailFieldsOf(kind).flatMap((k) => (details[k] ? [[k, details[k]] as [DetailKey, string]] : []))

/**
 * 會議連結只有 http:// 或 https:// 開頭時才當成可以點的連結，
 * 避免 javascript:、data: 這類網址被放進 <a href>。不合格回傳 null（畫面改成純文字）。
 */
export function safeLink(value: string): string | null {
  const v = value.trim()
  if (!/^https?:\/\//i.test(v)) return null
  try {
    const url = new URL(v)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

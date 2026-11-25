import { PERSONAL_CALENDAR_ID, type BusyProjectionRule, type Space } from './sharing'

/** 規則表單送出的內容（跟 useSpacesStore 的 RuleInput 相同的欄位） */
export interface RuleDraft {
  sourceId: string
  targetMode: 'all' | 'selected'
  targetIds: string[]
  includeAllDay: boolean
  includePrivate: boolean
}

/**
 * 儲存忙碌時段同步規則前，要不要請使用者再確認一次（Consent Prompt）：
 * 只有「讓更多人看到更多時段」時才需要，例如新規則、新增目標空間、改成全部行事曆、開啟私人或整天行程。
 * 只同步到「我的行事曆」（只有自己看得到）不需要確認；縮小範圍（移除目標、關閉選項）也不需要。
 */
export function needsShareConfirm(before: BusyProjectionRule | undefined, draft: RuleDraft, sharedTargets: readonly string[]): boolean {
  if (sharedTargets.length === 0) return false
  if (!before) return true
  if (draft.targetMode === 'all' && before.targetMode !== 'all') return true
  // 原本是「全部行事曆」時，改成指定只會縮小範圍
  if (before.targetMode === 'selected' && draft.targetMode === 'selected' && draft.targetIds.some((id) => id !== PERSONAL_CALENDAR_ID && !before.targetIds.includes(id))) return true
  if (draft.includePrivate && !before.includePrivate) return true
  if (draft.includeAllDay && !before.includeAllDay) return true
  return false
}

/** 確認畫面要列出的對象：每個會收到忙碌時段的空間，以及除了自己以外的成員人數 */
export function shareAudience(spaces: readonly Space[], targetIds: readonly string[], selfId: string): { id: string; name: string; others: number }[] {
  return targetIds
    .filter((id) => id !== PERSONAL_CALENDAR_ID)
    .flatMap((id) => {
      const space = spaces.find((s) => s.id === id && s.deletedAt === null)
      return space ? [{ id, name: space.name, others: space.members.filter((m) => m.userId !== selfId).length }] : []
    })
}

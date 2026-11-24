import { toLocalISO } from '../core/date'
import { busyProjectionRuleSchema, createSpace, emptySharedCalendarData, upsertMember, type SharedCalendarData } from '../core/sharing'
import { useSpacesStore } from '../store/useSpacesStore'
import { makeItem, T0, U } from './sharingFixtures'

/**
 * 畫面測試用的共享空間情境（本人是爸爸）：
 * - 家人空間：爸爸 owner、媽媽 editor、小孩 viewer、奶奶 viewer
 * - 工作空間：爸爸 owner、同事 editor
 * - 一條規則：工作空間的行程以「上班中」投射到家人空間
 */
export const LEAK = {
  clinicTitle: '腫瘤科回診',
  clinicPlace: '台大醫院',
  clinicNote: '記得帶健保卡',
  homeTitle: '回鄉祕密行程',
  homeNote: '帶紅包給阿姨',
  bonus: '年終獎金討論',
  merger: '併購案保密會議',
  boardroom: '32F 董事會議室',
} as const

export const SEEN = { dinner: '週日家庭聚餐', surprise: '爸爸生日驚喜', homePlace: '台南老家' } as const

export function seedSpaces(dateISO = toLocalISO()): SharedCalendarData {
  let family = createSpace({ id: 'sp-family', name: '陳家', kind: 'family', ownerId: U.dad, now: T0 })
  for (const [userId, role, displayName] of [
    [U.mom, 'editor', '媽媽'],
    [U.kid, 'viewer', '小孩'],
    [U.grandma, 'viewer', '奶奶'],
  ] as const)
    family = upsertMember(family, U.dad, { userId, role, displayName }, T0)
  const work = upsertMember(createSpace({ id: 'sp-work', name: '設計部', kind: 'work', ownerId: U.dad, now: T0 }), U.dad, { userId: U.coworker, role: 'editor', displayName: '同事' }, T0)

  const at = { dateISO, createdAt: T0, updatedAt: T0 }
  const items = [
    makeItem({ ...at, id: 'dinner', spaceId: family.id, createdBy: U.mom, title: SEEN.dinner, start: '18:00', end: '20:00' }),
    makeItem({ ...at, id: 'surprise', spaceId: family.id, createdBy: U.mom, title: SEEN.surprise, start: '20:00', end: '21:00', visibility: { mode: 'selected_members', allowedUserIds: [U.kid] } }),
    makeItem({
      ...at,
      id: 'clinic',
      spaceId: family.id,
      createdBy: U.dad,
      kind: 'medical_ride',
      title: LEAK.clinicTitle,
      location: LEAK.clinicPlace,
      note: LEAK.clinicNote,
      start: '09:00',
      end: '11:00',
      visibility: { mode: 'busy_only', busyLabel: '外出' },
    }),
    makeItem({
      ...at,
      id: 'home',
      spaceId: family.id,
      createdBy: U.dad,
      kind: 'homecoming',
      title: LEAK.homeTitle,
      location: SEEN.homePlace,
      note: LEAK.homeNote,
      start: '12:00',
      end: '13:00',
      visibility: { mode: 'group_full', maskedFields: ['title', 'note'] },
    }),
    makeItem({ ...at, id: 'bonus', spaceId: family.id, createdBy: U.dad, title: LEAK.bonus, start: '21:00', end: '22:00', visibility: { mode: 'group_full', hiddenUserIds: [U.kid] } }),
    makeItem({ ...at, id: 'merger', spaceId: work.id, createdBy: U.dad, kind: 'meeting', title: LEAK.merger, location: LEAK.boardroom, start: '14:00', end: '16:00' }),
  ]
  const rule = busyProjectionRuleSchema.parse({ id: 'r-work', userId: U.dad, sourceSpaceId: work.id, targetSpaceId: family.id, label: '上班中' })
  return { ...emptySharedCalendarData(U.dad), spaces: [family, work], items, busyProjectionRules: [rule], updatedAt: T0 }
}

/** 把情境放進 store：本人是爸爸 */
export function loadSeed(viewerId: string = U.dad, dateISO?: string) {
  useSpacesStore.setState({ selfId: U.dad, viewerId, filter: 'all', data: seedSpaces(dateISO) })
}

/** 本人沒有任何共享空間（舊使用者的狀態） */
export function clearSpaces() {
  useSpacesStore.setState({ selfId: U.dad, viewerId: U.dad, filter: 'all', data: emptySharedCalendarData(U.dad) })
}

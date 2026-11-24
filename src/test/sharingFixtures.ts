import { createSpace, sharedCalendarItemSchema, upsertMember, type SharedCalendarItem, type SharedCalendarItemInput, type Space } from '../core/sharing'

/**
 * 共享行事曆測試用情境：
 * - 家人空間：媽媽 owner、爸爸 editor、小孩 viewer、奶奶 viewer
 * - 工作空間：爸爸 owner、同事 editor
 * - 學校空間：老師 owner、小孩 viewer、同學 editor
 */
export const T0 = 1_700_000_000_000

export const U = {
  mom: 'u-mom',
  dad: 'u-dad',
  kid: 'u-kid',
  grandma: 'u-grandma',
  coworker: 'u-coworker',
  teacher: 'u-teacher',
  classmate: 'u-classmate',
  stranger: 'u-stranger',
} as const

function withMembers(space: Space, actor: string, members: { userId: string; role: 'owner' | 'editor' | 'viewer' }[]): Space {
  return members.reduce((s, m) => upsertMember(s, actor, m, T0), space)
}

export const familySpace = () =>
  withMembers(createSpace({ id: 'sp-family', name: '陳家', kind: 'family', ownerId: U.mom, now: T0 }), U.mom, [
    { userId: U.dad, role: 'editor' },
    { userId: U.kid, role: 'viewer' },
    { userId: U.grandma, role: 'viewer' },
  ])

export const workSpace = () =>
  withMembers(createSpace({ id: 'sp-work', name: '公司專案', kind: 'work', ownerId: U.dad, now: T0 }), U.dad, [{ userId: U.coworker, role: 'editor' }])

export const schoolSpace = () =>
  withMembers(createSpace({ id: 'sp-school', name: '三年二班', kind: 'school', ownerId: U.teacher, now: T0 }), U.teacher, [
    { userId: U.kid, role: 'viewer' },
    { userId: U.classmate, role: 'editor' },
  ])

let seq = 0
export function makeItem(input: Partial<SharedCalendarItemInput> & Pick<SharedCalendarItemInput, 'spaceId' | 'createdBy'>): SharedCalendarItem {
  return sharedCalendarItemSchema.parse({
    id: `item-${++seq}`,
    title: '行程',
    dateISO: '2026-12-01',
    start: '09:00',
    end: '10:00',
    createdAt: T0,
    updatedAt: T0,
    ...input,
  })
}

/** 敏感字串：任何遮罩後的輸出都不該出現這些字 */
export const SECRET = {
  title: '腫瘤科回診',
  location: '台大醫院',
  note: '記得帶健保卡與病歷',
  detail: '王醫師',
} as const

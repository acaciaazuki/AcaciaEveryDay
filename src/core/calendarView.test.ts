import { describe, expect, it } from 'vitest'
import { LEAK, SEEN, seedSpaces } from '../test/spacesSeed'
import { U } from '../test/sharingFixtures'
import { searchableShared, sharedOn, visibleCalendar } from './calendarView'
import { projectedBlockId } from './permissions'

const D = '2026-12-01'
const leakRe = new RegExp(Object.values(LEAK).join('|'))

describe('visibleCalendar', () => {
  it('本人：看到自己與別人公開的行程；看不到別人只給特定成員的行程；自己的投射不重複顯示', () => {
    const v = visibleCalendar(seedSpaces(D), U.dad, U.dad, 'all')
    expect(v).toMatchObject({ isSelf: true, showPersonal: true })
    expect(v.shared.map((e) => e.id).sort()).toEqual(['bonus', 'clinic', 'dinner', 'home', 'merger'])
    const clinic = v.shared.find((e) => e.id === 'clinic')!
    expect(clinic).toMatchObject({ access: 'full', isOwnItem: true, canEdit: true, canManageVisibility: true, creatorName: '' })
    expect(v.shared.find((e) => e.id === 'dinner')).toMatchObject({ canEdit: true, canManageVisibility: false, creatorName: '媽媽' })
  })

  it('預覽小孩的視角：唯讀、不顯示個人行程，忙閒與遮罩都套用，看不到被隱藏的行程', () => {
    const v = visibleCalendar(seedSpaces(D), U.dad, U.kid, 'all')
    expect(v).toMatchObject({ isSelf: false, showPersonal: false })
    const byId = Object.fromEntries(v.shared.map((e) => [e.id, e]))
    expect(Object.keys(byId).sort()).toEqual(['clinic', 'dinner', 'home', projectedBlockId('r-work', 'merger'), 'surprise'].sort())
    expect(byId.clinic).toMatchObject({ access: 'busy', busyLabel: '外出', kind: 'event' })
    expect(byId.home).toMatchObject({ access: 'masked', maskedFields: ['title', 'note'] })
    expect(byId.home.item.location).toBe(SEEN.homePlace)
    expect(byId[projectedBlockId('r-work', 'merger')]).toMatchObject({ access: 'busy', busyLabel: '上班中', projected: true, space: { id: 'sp-family' } })
    expect(v.shared.every((e) => !e.canEdit && !e.canManageVisibility)).toBe(true)
    expect(JSON.stringify(v)).not.toMatch(leakRe)
  })

  it('預覽同事：只看得到工作空間', () => {
    const v = visibleCalendar(seedSpaces(D), U.dad, U.coworker, 'all')
    expect(v.shared.map((e) => e.id)).toEqual(['merger'])
  })

  it('篩選：個人只顯示個人行程；指定空間只顯示該空間', () => {
    const data = seedSpaces(D)
    expect(visibleCalendar(data, U.dad, U.dad, 'personal')).toMatchObject({ showPersonal: true, shared: [] })
    const work = visibleCalendar(data, U.dad, U.dad, 'sp-work')
    expect(work.showPersonal).toBe(false)
    expect(work.shared.map((e) => e.id)).toEqual(['merger'])
  })

  it('已刪除的空間與行程不顯示', () => {
    const data = seedSpaces(D)
    const deleted = { ...data, spaces: data.spaces.map((s) => (s.id === 'sp-work' ? { ...s, deletedAt: 1 } : s)), items: data.items.map((i) => (i.id === 'dinner' ? { ...i, deletedAt: 1 } : i)) }
    const ids = visibleCalendar(deleted, U.dad, U.dad, 'all').shared.map((e) => e.id)
    expect(ids).not.toContain('merger')
    expect(ids).not.toContain('dinner')
  })

  it('sharedOn 包含跨日行程的每一天', () => {
    const data = seedSpaces(D)
    data.items[0] = { ...data.items[0]!, endDateISO: '2026-12-03' }
    const v = visibleCalendar(data, U.dad, U.dad, 'all')
    expect(sharedOn(v.shared, '2026-12-02').map((e) => e.id)).toEqual(['dinner'])
    expect(sharedOn(v.shared, '2026-12-04')).toEqual([])
  })

  it('searchableShared 排除忙碌區塊，遮罩的欄位是空字串', () => {
    const v = visibleCalendar(seedSpaces(D), U.dad, U.kid, 'all')
    const s = searchableShared(v.shared)
    expect(s.map((x) => x.id).sort()).toEqual(['dinner', 'home', 'surprise'])
    expect(s.find((x) => x.id === 'home')).toMatchObject({ title: '', note: '', location: SEEN.homePlace })
    expect(JSON.stringify(s)).not.toMatch(leakRe)
  })
})

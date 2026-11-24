import { describe, expect, it } from 'vitest'
import { U } from '../test/sharingFixtures'
import { LEAK, SEEN, seedSpaces } from '../test/spacesSeed'
import { searchableShared, visibleCalendar } from './calendarView'
import { searchAll, type SearchFormat } from './search'

const fmt: SearchFormat = { money: String, expenseCat: (e) => e.cat, placeCat: String, hiddenTitle: '（已隱藏）' }
const empty = { events: [], tasks: [], shopping: [], archives: [], places: [] }
const shared = (viewer: string) => searchableShared(visibleCalendar(seedSpaces('2026-12-01'), U.dad, viewer, 'all').shared)

describe('searchAll：共享行程', () => {
  it('共享行程歸在「行程」，連結到行事曆並帶空間名稱', () => {
    const hits = searchAll({ ...empty, shared: shared(U.dad) }, '聚餐', 'events', fmt)
    expect(hits).toEqual([expect.objectContaining({ key: 'shared-dinner', kind: 'events', title: SEEN.dinner, path: '/calendar?open=dinner', meta: '2026-12-01 18:00 · 陳家' })])
    expect(searchAll({ ...empty, shared: shared(U.dad) }, '聚餐', 'tasks', fmt)).toEqual([])
  })

  it('依檢視者過濾後的資料搜尋：敏感字串一律搜不到', () => {
    // 各檢視者本來就看得到的：年終獎金只對小孩隱藏；同事是工作空間成員
    const allowed: Record<string, string[]> = { [U.kid]: [], [U.grandma]: [LEAK.bonus], [U.mom]: [LEAK.bonus], [U.coworker]: [LEAK.merger, LEAK.boardroom] }
    for (const [viewer, ok] of Object.entries(allowed)) {
      const data = { ...empty, shared: shared(viewer) }
      for (const secret of Object.values(LEAK).filter((x) => !ok.includes(x))) {
        expect(searchAll(data, secret, 'all', fmt), `${viewer} ${secret}`).toEqual([])
      }
    }
  })

  it('標題被遮罩時顯示「已隱藏」，以地點命中時附上摘錄', () => {
    const [hit] = searchAll({ ...empty, shared: shared(U.kid) }, '台南', 'all', fmt)
    expect(hit).toMatchObject({ title: '（已隱藏）', snippet: { field: 'loc', text: SEEN.homePlace } })
  })

  it('細節可以搜尋（摘錄標示「細節」）；遮罩細節時搜不到', () => {
    const data = seedSpaces('2026-12-01')
    const at = { dateISO: '2026-12-01', spaceId: 'sp-family', createdBy: U.dad, kind: 'meeting' as const }
    data.items.push(
      { ...data.items[0]!, ...at, id: 'm1', title: '家庭會議', details: { project: '換房子計畫' } },
      { ...data.items[0]!, ...at, id: 'm2', title: '另一個會議', details: { project: '換房子貸款' }, visibility: { ...data.items[0]!.visibility, maskedFields: ['details'] } },
    )
    const forKid = searchableShared(visibleCalendar(data, U.dad, U.kid, 'all').shared)
    const hits = searchAll({ ...empty, shared: forKid }, '換房子', 'all', fmt)
    expect(hits.map((h) => h.id)).toEqual(['m1'])
    expect(hits[0]!.snippet).toEqual({ field: 'detail', text: '換房子計畫' })
  })
})

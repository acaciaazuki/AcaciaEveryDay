import type { Archive, CalendarEvent, Expense, Place, Task } from './schema'

export const SEARCH_SCOPES = ['all', 'events', 'tasks', 'shopping', 'places'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]
export type SearchKind = Exclude<SearchScope, 'all'>

/** 比對的欄位。title 以外命中時，結果會多顯示一行摘錄 */
export type SearchField = 'title' | 'note' | 'loc' | 'store' | 'cat' | 'address'

export interface SearchHit {
  key: string
  kind: SearchKind
  id: string
  title: string
  /** 日期、金額、地點等一行摘要 */
  meta: string
  /** 非標題欄位命中時的摘錄 */
  snippet?: { field: SearchField; text: string }
  done?: boolean
  archived?: { start: string; end: string }
  path: string
}

export interface SearchData {
  events: CalendarEvent[]
  tasks: Task[]
  shopping: Expense[]
  archives: Archive[]
  places: Place[]
}

export interface SearchFormat {
  money: (n: number) => string
  expenseCat: (e: Pick<Expense, 'cat' | 'customCat'>) => string
  placeCat: (cat: string) => string
}

/** 以空白切成多個關鍵字，每個關鍵字都要命中（任一欄位）才算符合 */
export const tokenize = (q: string): string[] => q.toLowerCase().split(/\s+/).filter(Boolean)

const norm = (s: string) => s.toLowerCase()

interface Candidate {
  /** 由前到後依序是標題、其他欄位；第一個命中的非標題欄位會成為摘錄 */
  fields: [SearchField, string][]
}

function matches(c: Candidate, tokens: string[]): SearchHit['snippet'] | 'title' | null {
  const hay = c.fields.map(([f, v]) => [f, norm(v)] as const)
  for (const tk of tokens) if (!hay.some(([, v]) => v.includes(tk))) return null
  // 找一個非標題但命中的欄位當摘錄；只有標題命中就不用摘錄
  for (const [i, [f, raw]] of c.fields.entries()) {
    if (f === 'title' || !raw) continue
    if (tokens.some((tk) => hay[i]![1].includes(tk))) return { field: f, text: raw }
  }
  return 'title'
}

const byDateDesc = (a: SearchHit, b: SearchHit) => b.meta.localeCompare(a.meta)

export function searchAll(data: SearchData, query: string, scope: SearchScope, fmt: SearchFormat): SearchHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const out: SearchHit[] = []
  const want = (k: SearchKind) => scope === 'all' || scope === k

  if (want('events'))
    for (const e of data.events) {
      const m = matches(
        {
          fields: [
            ['title', e.title],
            ['note', e.note],
          ],
        },
        tokens,
      )
      if (!m) continue
      out.push({
        key: `event-${e.id}`,
        kind: 'events',
        id: e.id,
        title: e.title,
        meta: `${e.dateISO} ${e.start}`.trim(),
        snippet: m === 'title' ? undefined : m,
        path: `/calendar?open=${e.id}`,
      })
    }

  if (want('tasks'))
    for (const x of data.tasks) {
      const m = matches(
        {
          fields: [
            ['title', x.title],
            ['loc', x.loc],
          ],
        },
        tokens,
      )
      if (!m) continue
      out.push({
        key: `task-${x.id}`,
        kind: 'tasks',
        id: x.id,
        title: x.title,
        meta: [x.date, x.time, x.loc].filter(Boolean).join(' · '),
        snippet: m === 'title' ? undefined : m,
        done: x.done,
        path: `/tasks?open=${x.id}`,
      })
    }

  if (want('shopping')) {
    const push = (s: Expense, archived?: { start: string; end: string }) => {
      const m = matches(
        {
          fields: [
            ['title', s.title],
            ['store', s.store],
            ['cat', fmt.expenseCat(s)],
          ],
        },
        tokens,
      )
      if (!m) return
      out.push({
        key: `shop-${s.id}`,
        kind: 'shopping',
        id: s.id,
        title: s.title,
        meta: [s.date, fmt.money(s.amt), m !== 'title' && m.field === 'store' ? '' : s.store].filter(Boolean).join(' · '),
        snippet: m === 'title' ? undefined : m,
        done: s.done,
        archived,
        path: `/shopping?open=${s.id}`,
      })
    }
    for (const s of data.shopping) push(s)
    for (const a of data.archives) for (const s of a.expenses) push(s, { start: a.start, end: a.end })
  }

  if (want('places'))
    for (const p of data.places) {
      const m = matches(
        {
          fields: [
            ['title', p.name],
            ['address', p.address],
            ['note', p.note],
            ['cat', fmt.placeCat(p.cat)],
          ],
        },
        tokens,
      )
      if (!m) continue
      out.push({
        key: `place-${p.id}`,
        kind: 'places',
        id: p.id,
        title: p.name,
        meta: p.address || fmt.placeCat(p.cat),
        snippet: m === 'title' ? undefined : m,
        path: `/places?open=${p.id}`,
      })
    }

  // 各類內依日期新到舊（沒有日期的排在後面）；類別順序維持 行程、待辦、記帳、地點
  const order: SearchKind[] = ['events', 'tasks', 'shopping', 'places']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || byDateDesc(a, b))
}

/** 把文字依關鍵字切成 [片段, 是否命中] 的陣列，供高亮用 */
export function splitHighlight(text: string, tokens: string[]): [string, boolean][] {
  if (tokens.length === 0 || !text) return [[text, false]]
  const lower = text.toLowerCase()
  const marks = new Array<boolean>(text.length).fill(false)
  for (const tk of tokens) {
    let i = lower.indexOf(tk)
    while (i !== -1) {
      for (let j = i; j < i + tk.length; j++) marks[j] = true
      i = lower.indexOf(tk, i + tk.length)
    }
  }
  const parts: [string, boolean][] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      parts.push([text.slice(start, i), marks[start]!])
      start = i
    }
  }
  return parts
}

/** 備註很長時，只留關鍵字前後一小段 */
export function excerpt(text: string, tokens: string[], radius = 24): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase()
  const at = Math.min(...tokens.map((tk) => lower.indexOf(tk)).filter((i) => i >= 0))
  if (!Number.isFinite(at) || flat.length <= radius * 2 + 10) return flat
  const from = Math.max(0, at - radius)
  const to = Math.min(flat.length, at + radius * 2)
  return `${from > 0 ? '…' : ''}${flat.slice(from, to)}${to < flat.length ? '…' : ''}`
}

import { describe, expect, it } from 'vitest'
import { detectEventIcon, eventIconOf, EVENT_ICON_KEYS } from './eventIcons'
import { migrate } from './migrate'
import { emptyAppData } from './schema'

describe('detectEventIcon', () => {
  it.each([
    ['起床 運動前先喝水', 'wake'],
    ['早起', 'wake'],
    ['睡覺', 'sleep'],
    ['Bedtime', 'sleep'],
    ['上課：資料結構', 'study'],
    ['讀書會', 'book'],
    ['圖書館念書', 'book'],
    ['Reading', 'book'],
    ['考試', 'study'],
    ['夏威夷度假', 'vacation'],
    ['京都旅行', 'vacation'],
    ['Beach trip', 'vacation'],
    ['搭高鐵回台南', 'train'],
    ['新幹線', 'train'],
    ['Take the train', 'train'],
    ['去機場', 'flight'],
    ['フライト', 'flight'],
    ['Flight to Tokyo', 'flight'],
    ['勉強', 'study'],
    ['週會 開會', 'work'],
    ['Team meeting', 'work'],
    ['仕事', 'work'],
    ['午休', 'rest'],
    ['Coffee break', 'rest'],
    ['吃飯', 'meal'],
    ['週末聚餐', 'meal'],
    ['ランチ', 'meal'],
    ['超市採買', 'shopping'],
    ['Grocery shopping', 'shopping'],
    ['健身房', 'exercise'],
    ['散歩', 'exercise'],
    ['慢跑', 'exercise'],
    ['河濱跑步', 'exercise'],
    ['飯後散步', 'exercise'],
    ['公園健走', 'exercise'],
    ['晨跑 5K', 'exercise'],
    ['ジョギング', 'exercise'],
    ['Morning jog', 'exercise'],
    ['看診', 'health'],
    ['Dentist', 'health'],
    ['美容院', 'health'],
    ['繳房租', 'default'],
    ['', 'default'],
  ])('%s → %s', (title, icon) => expect(detectEventIcon(title)).toBe(icon))

  it('同時命中時照優先順序，英文用整個字比對', () => {
    expect(detectEventIcon('午餐會議')).toBe('meal')
    expect(detectEventIcon('Workout')).toBe('exercise')
    expect(detectEventIcon('Team brunch')).toBe('meal')
    expect(detectEventIcon('Breakfast')).toBe('meal')
    expect(detectEventIcon('Ballroom run club')).toBe('exercise')
    // 交通工具優先：出差搭高鐵顯示火車、旅行搭機顯示飛機
    expect(detectEventIcon('搭高鐵出差')).toBe('train')
    expect(detectEventIcon('旅行 搭機')).toBe('flight')
    // booking、bread 不會被當成 book、read
    expect(detectEventIcon('Hotel booking')).toBe('default')
    expect(detectEventIcon('Buy bread')).toBe('default')
  })
})

describe('eventIconOf / 資料相容', () => {
  it('手動選的圖示優先，沒選就依標題', () => {
    expect(eventIconOf({ title: '午餐' })).toBe('meal')
    expect(eventIconOf({ title: '午餐', icon: 'work' })).toBe('work')
  })
  it('圖示存進資料、舊行程沒有圖示照常讀取', () => {
    const ev = { id: 'a', title: '看展', dateISO: '2026-11-21', start: '10:00', end: '11:00', note: '' }
    const data = migrate(JSON.parse(JSON.stringify({ ...emptyAppData(), events: [{ ...ev, icon: 'rest' }, ev] })))
    expect(data.events[0].icon).toBe('rest')
    expect(data.events[1].icon).toBeUndefined()
    expect(EVENT_ICON_KEYS).toContain('default')
  })
})

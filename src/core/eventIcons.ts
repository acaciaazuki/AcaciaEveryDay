/** 行程的生活小圖示。依標題關鍵字自動挑，也可以在行程表單手動指定 */
export const EVENT_ICON_KEYS = ['wake', 'sleep', 'study', 'work', 'rest', 'meal', 'shopping', 'exercise', 'health', 'default'] as const
export type EventIconKey = (typeof EVENT_ICON_KEYS)[number]

/**
 * 關鍵字（繁中、日文、英文）。順序就是比對優先順序：
 * 像「午餐會議」會先命中用餐，「workout」不會被當成上班。
 */
const KEYWORDS: [Exclude<EventIconKey, 'default'>, string[]][] = [
  ['wake', ['起床', '晨間', '早起', '鬧鐘', '起き', '朝活', 'wake up', 'wake', 'morning routine', 'alarm']],
  ['sleep', ['就寢', '睡覺', '睡前', '晚安', '寝る', '就寝', 'おやすみ', 'sleep', 'bedtime', 'bed']],
  ['health', ['看診', '醫院', '美容', '牙醫', '診所', '健檢', '打針', '複診', '病院', '通院', '歯医者', '美容院', 'doctor', 'hospital', 'clinic', 'dentist', 'salon', 'checkup']],
  ['shopping', ['購物', '買東西', '超市', '採買', '買菜', '買い物', 'スーパー', 'shopping', 'grocery', 'groceries', 'supermarket']],
  ['meal', ['吃飯', '早餐', '午餐', '晚餐', '聚餐', '宵夜', '餐廳', '食事', '朝食', '昼食', '夕食', 'ランチ', 'ディナー', '飲み会', 'breakfast', 'brunch', 'lunch', 'dinner', 'meal', 'eat']],
  ['exercise', ['運動', '健身', '散步', '跑步', '瑜珈', '游泳', 'ジム', '散歩', 'ランニング', 'ヨガ', 'workout', 'gym', 'running', 'run', 'yoga', 'walk', 'exercise']],
  ['rest', ['午休', '小睡', '休息', '咖啡', '下午茶', '昼休み', '休憩', '仮眠', 'カフェ', 'nap', 'rest', 'break', 'coffee', 'tea']],
  ['study', ['上學', '上課', '讀書', '念書', '考試', '作業', '學校', '補習', '授業', '勉強', '学校', '宿題', 'study', 'class', 'school', 'homework', 'lecture', 'exam']],
  ['work', ['上班', '工作', '會議', '開會', '面試', '出差', '加班', '仕事', '会議', '出勤', 'work', 'meeting', 'office', 'interview']],
]

/** 英文關鍵字要整個字比對，避免 brunch 裡的 run、breakfast 裡的 break 誤判 */
const matches = (title: string, kw: string) => (/^[a-z ]+$/.test(kw) ? new RegExp(`(?<![a-z])${kw}(?![a-z])`).test(title) : title.includes(kw))

export function detectEventIcon(title: string): EventIconKey {
  const t = title.toLowerCase()
  for (const [key, words] of KEYWORDS) if (words.some((w) => matches(t, w))) return key
  return 'default'
}

/** 行程實際要顯示的圖示：手動選的優先，沒選就依標題判斷 */
export const eventIconOf = (e: { title: string; icon?: EventIconKey }): EventIconKey => e.icon ?? detectEventIcon(e.title)

/** 圓形底框的柔和粉彩色 */
export const ICON_BG: Record<EventIconKey, string> = {
  wake: '#fff3c4',
  sleep: '#e9e3fb',
  study: '#dcecf8',
  work: '#fbe5d3',
  rest: '#fdebd4',
  meal: '#ffe6df',
  shopping: '#def3e7',
  exercise: '#e0f1de',
  health: '#fde4e3',
  default: '#eaf6ef',
}

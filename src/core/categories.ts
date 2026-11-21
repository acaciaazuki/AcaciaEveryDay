/**
 * 分類改存代碼，畫面再依語系翻譯。
 * 舊資料存的是中文字，遷移時用下面的對照表轉換。
 */
export const EXPENSE_CATEGORIES = [
  'food',
  'clothing',
  'housing',
  'transport',
  'education',
  'leisure',
  'stocks',
  'loan',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const LEGACY_EXPENSE_CATEGORY: Record<string, ExpenseCategory> = {
  食: 'food',
  衣: 'clothing',
  住: 'housing',
  行: 'transport',
  育: 'education',
  樂: 'leisure',
  股票: 'stocks',
  貸款: 'loan',
  其他: 'other',
}

export const PLACE_CATEGORIES = {
  restaurant: { icon: '🍝', bg: '#fff8e7' },
  dessert: { icon: '🍰', bg: '#fdf4ff' },
  cafe: { icon: '☕', bg: '#f6e7d8' },
  drinks: { icon: '🧋', bg: '#e0f2fe' },
  clinic: { icon: '🏥', bg: '#ebf4ff' },
  convenience: { icon: '🏪', bg: '#e8f7f0' },
  bookstore: { icon: '📚', bg: '#fef3c7' },
  clothing: { icon: '👗', bg: '#fff0f3' },
  park: { icon: '🌳', bg: '#edf5eb' },
  attraction: { icon: '🎡', bg: '#ffedd5' },
  school: { icon: '🏫', bg: '#f3e8ff' },
  market: { icon: '🧺', bg: '#ffedd5' },
  other: { icon: '📍', bg: '#f3f4f6' },
} as const
export type PlaceCategory = keyof typeof PLACE_CATEGORIES
export const PLACE_CATEGORY_KEYS = Object.keys(PLACE_CATEGORIES) as PlaceCategory[]

export const LEGACY_PLACE_CATEGORY: Record<string, PlaceCategory> = {
  餐廳: 'restaurant',
  甜點: 'dessert',
  咖啡: 'cafe',
  飲料店: 'drinks',
  診所: 'clinic',
  便利商店: 'convenience',
  書局: 'bookstore',
  服飾: 'clothing',
  公園: 'park',
  景點: 'attraction',
  學校: 'school',
  市場: 'market',
  其他: 'other',
}

/**
 * 卡片配色：前 6 組是舊版的色票（順序不變，已儲存的顏色照常顯示），
 * 後 6 組是新增的低彩度粉彩色，文字色都與背景維持 4.5 以上的對比。
 */
export const THEME_COLORS = [
  { bg: '#ffffff', txt: '#263633' },
  { bg: '#eaf6ef', txt: '#3d876c' },
  { bg: '#fff8e8', txt: '#b48116' },
  { bg: '#fff4f1', txt: '#c2583d' },
  { bg: '#f0f4fb', txt: '#3f67b5' },
  { bg: '#f3edfa', txt: '#764eba' },
  { bg: '#f7f1e1', txt: '#7a6232' }, // 奶油米
  { bg: '#ffe9dc', txt: '#9a4f30' }, // 蜜桃
  { bg: '#e4f0f7', txt: '#3a6a8a' }, // 天空藍
  { bg: '#ebe6f6', txt: '#66509a' }, // 薰衣草
  { bg: '#e6eedc', txt: '#46703a' }, // 抹茶綠
  { bg: '#f0e6d8', txt: '#7a5a38' }, // 暖沙
] as const

/** 文字顏色：中等偏深、低飽和的莫蘭迪色，疊在上面任何一個卡片背景都清楚 */
export const TEXT_COLORS = [
  { color: '#263633', key: 'ink' },
  { color: '#2f5d4a', key: 'forest' },
  { color: '#6b4a3a', key: 'brown' },
  { color: '#8f3f3a', key: 'brick' },
  { color: '#2f4468', key: 'navy' },
  { color: '#6b3f66', key: 'plum' },
  { color: '#4a5d73', key: 'slate' },
  { color: '#5b5530', key: 'olive' },
] as const

export const DEFAULT_TEXT_COLOR = TEXT_COLORS[0].color

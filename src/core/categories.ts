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

/** 舊版的六組卡片配色 */
export const THEME_COLORS = [
  { bg: '#ffffff', txt: '#263633' },
  { bg: '#eaf6ef', txt: '#3d876c' },
  { bg: '#fff8e8', txt: '#b48116' },
  { bg: '#fff4f1', txt: '#c2583d' },
  { bg: '#f0f4fb', txt: '#3f67b5' },
  { bg: '#f3edfa', txt: '#764eba' },
] as const

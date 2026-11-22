import type { PlaceCategory } from './categories'

/** 依名稱與 Google Places types 猜分類（沿用舊版規則） */
export function detectPlaceCategory(name = '', types: string[] = []): PlaceCategory {
  const n = name.toLowerCase()
  const t = types.map((x) => x.toLowerCase())
  const has = (...xs: string[]) => t.some((x) => xs.includes(x))

  if (has('doctor', 'dentist', 'hospital', 'clinic', 'physiotherapist', 'health', 'pharmacy', 'medical_lab') || /診所|醫院|牙醫|眼科|身心|中醫|皮膚科|耳鼻喉|婦產|小兒|藥局|復健/.test(n)) return 'clinic'
  if (has('cafe') || /咖啡|cafe|coffee|星巴克|路易莎|cama/.test(n)) return 'cafe'
  if (has('bakery') || /甜點|蛋糕|烘焙|冰品|豆花|甜品|鬆餅|千層/.test(n)) return 'dessert'
  if (/飲料|茶|手搖|50嵐|迷客夏|清心|麻古|得正|五桐號|可不可|鶴茶樓|一沐日/.test(n)) return 'drinks'
  if (has('restaurant', 'food', 'meal_takeaway', 'meal_delivery') || /餐廳|麵|飯|鍋|食堂|小吃|燒肉|壽司|拉麵|早午餐|牛排|居酒屋|料理|水餃|便當/.test(n)) return 'restaurant'
  if (has('convenience_store') || /超商|7-11|全家|萊爾富|ok超商|便利商店/.test(n)) return 'convenience'
  if (has('book_store', 'library') || /書局|書店|誠品|金石堂|墊腳石|圖書館/.test(n)) return 'bookstore'
  if (has('clothing_store', 'shoe_store') || /服飾|衣|穿搭|uniqlo|\bgu\b|zara|net/.test(n)) return 'clothing'
  if (has('park') || /公園|綠地|步道|森林/.test(n)) return 'park'
  if (has('tourist_attraction', 'museum', 'art_gallery', 'amusement_park') || /景點|園區|老街|博物館|美術館|農場/.test(n)) return 'attraction'
  if (has('school', 'university', 'primary_school', 'secondary_school') || /學校|大學|國小|國中|高中|幼稚園/.test(n)) return 'school'
  if (has('supermarket', 'grocery_or_supermarket', 'market') || /市場|夜市|超市|全聯|家樂福|好市多|黃昏市場/.test(n)) return 'market'
  return 'other'
}

/** Google Places API (New) 回傳的地點（只列出用得到的欄位） */
export interface PlaceResult {
  displayName?: string | { text?: string }
  formattedAddress?: string
  types?: string[]
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  googleMapsUri?: string
  rating?: number
  userRatingCount?: number
  nationalPhoneNumber?: string
  editorialSummary?: string | { text?: string }
  reviews?: { rating?: number; text?: string | { text?: string } }[]
  /** 座標：搜尋服務有回傳時才有（取決於服務端要求的欄位） */
  location?: { latitude?: number; longitude?: number }
}

/** 搜尋結果的座標；沒有或不合理時回傳 null */
export function resultCoords(p: PlaceResult): { lat: number; lng: number } | null {
  const lat = p.location?.latitude
  const lng = p.location?.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

const text = (v: string | { text?: string } | undefined) => (typeof v === 'string' ? v : (v?.text ?? ''))
export const placeName = (p: PlaceResult) => text(p.displayName)

/** 產生筆記時用的文字，由畫面依語系傳入 */
export interface PlaceNoteLabels {
  closedDays: (days: string) => string
  noClosedDays: string
  noHours: string
  rating: (rating: number, count?: number) => string
  phone: (phone: string) => string
  clinicTip: string
  intro: (s: string) => string
  highlights: (s: string) => string
  reviews: (quotes: string[]) => string
}

export function formatOpeningHours(lines: string[], l: PlaceNoteLabels): string {
  if (!lines.length) return l.noHours
  const closed = lines.filter((x) => /休息|公休|休診|closed|定休/i.test(x)).map((x) => x.split(/[:：]/)[0].trim()).filter(Boolean)
  return [closed.length ? l.closedDays(closed.join('、')) : l.noClosedDays, ...lines].join('\n')
}

const FOOD: PlaceCategory[] = ['restaurant', 'dessert', 'cafe', 'drinks', 'market']

export function buildPlaceNote(p: PlaceResult, cat: PlaceCategory, l: PlaceNoteLabels): string {
  const out: string[] = []
  const editorial = text(p.editorialSummary)
  if (p.rating) out.push(l.rating(p.rating, p.userRatingCount))
  if (p.nationalPhoneNumber) out.push(l.phone(p.nationalPhoneNumber))
  if (cat === 'clinic') {
    out.push(l.clinicTip)
    if (editorial) out.push(l.intro(editorial))
  } else if (FOOD.includes(cat)) {
    if (editorial) out.push(l.highlights(editorial))
    const quotes = (p.reviews ?? [])
      .filter((r) => (r.rating ?? 5) >= 4)
      .map((r) => text(r.text).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => (s.length > 55 ? `${s.slice(0, 55)}…` : s))
    if (quotes.length) out.push(l.reviews(quotes))
  } else if (editorial) out.push(l.intro(editorial))
  return out.join('\n')
}

export const mapsUrl = (p: { url?: string; name: string; address?: string }) =>
  p.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address ?? ''}`.trim())}`

/** 以本地時區輸出 YYYY-MM-DD（舊版 toLocalISO 的對應） */
export function toLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

import type { TFunction } from 'i18next'
import type { Reminder } from '../core/schema'
import { formatTime } from '../core/time'

type Rule = Pick<Reminder, 'place' | 'trigger' | 'days' | 'customDays' | 'start' | 'end' | 'items'>

/** 依語系取得星期日到星期六的短名稱（索引 0 是星期日） */
export function weekdayLabels(lng: string | undefined) {
  const f = new Intl.DateTimeFormat(lng, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2026, 1, i + 1))) // 2026-02-01 是星期日
}

/** 「平日」「週一、週三」＋時段，例如「平日 08:00–18:00」 */
export function whenText(t: TFunction, lng: string | undefined, r: Pick<Rule, 'days' | 'customDays' | 'start' | 'end'>): string {
  const names = weekdayLabels(lng)
  const days = r.days === 'custom' ? [...r.customDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(t('reminders.itemSep')) || t('reminders.days.custom') : t(`reminders.days.${r.days}`)
  if (r.start && r.end) return t('reminders.preview.range', { days, start: formatTime(r.start, lng), end: formatTime(r.end, lng) })
  if (r.start) return t('reminders.preview.fromOnly', { days, start: formatTime(r.start, lng) })
  if (r.end) return t('reminders.preview.untilOnly', { days, end: formatTime(r.end, lng) })
  return days
}

/** 即時規則預覽：「平日，離開（公司）時，請確認（錢包、鑰匙、識別證）。」 */
export function reminderPreview(t: TFunction, lng: string | undefined, r: Rule): string {
  return t(`reminders.preview.${r.trigger}`, {
    when: whenText(t, lng, r),
    place: r.place.trim() || t('reminders.preview.placeholderPlace'),
    items: r.items.length ? r.items.join(t('reminders.itemSep')) : t('reminders.preview.placeholderItems'),
  })
}

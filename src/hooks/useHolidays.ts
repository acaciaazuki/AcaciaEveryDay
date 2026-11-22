import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { detectCountry, holidayName, indexHolidays, isHolidayCountry, type HolidayCountry, type HolidayEntry } from '../core/holidays'
import { useAppStore } from '../store/useAppStore'

/**
 * 國定假日的暖杏色系：跟一般行程（左側色條）、購物連動（淺綠虛線框）都不同。
 * 補班日用淡灰藍，提醒「這天要上班」。
 */
export const HOLIDAY_STYLE = { bg: '#fff4ec', border: '#f6cfb5', fg: '#b2552f', tagBg: '#fde2d0', dot: '#ef9a6c', day: '#c4562c' }
export const WORKDAY_STYLE = { bg: '#f1f4f8', border: '#cfd8e3', fg: '#4f6178', tagBg: '#e1e8f0', dot: '#8fa3bd' }

export const holidayStyle = (h: Pick<HolidayEntry, 'work'>) => (h.work ? WORKDAY_STYLE : HOLIDAY_STYLE)

/** 行事曆用：已匯入的假日依日期建好的索引 */
export function useHolidaysByDate() {
  const holidays = useAppStore((s) => s.holidays)
  return useMemo(() => indexHolidays(holidays), [holidays])
}

/** 目前選的國家；還沒選過就依瀏覽器時區與語言推測（只在裝置上計算，不會存起來） */
export function useHolidayCountry(): HolidayCountry {
  const saved = useAppStore((s) => s.settings.holidayCountry)
  return useMemo(() => (isHolidayCountry(saved) ? saved : detectCountry()), [saved])
}

/** 國家名稱跟著介面語言（用瀏覽器內建的 Intl.DisplayNames，不用另外翻譯） */
export function useCountryName() {
  const { i18n } = useTranslation()
  const lng = i18n.resolvedLanguage ?? 'zh-TW'
  return useMemo(() => {
    let names: Intl.DisplayNames | undefined
    try {
      names = new Intl.DisplayNames([lng], { type: 'region' })
    } catch {
      names = undefined
    }
    return (code: string) => names?.of(code) ?? code
  }, [lng])
}

/** 假日名稱依介面語言；同時匯入多個國家時在名稱前加國家，避免混淆 */
export function useHolidayLabel() {
  const { i18n } = useTranslation()
  const countries = useAppStore((s) => s.holidays)
  const countryName = useCountryName()
  const multi = useMemo(() => new Set(countries.map((s) => s.country)).size > 1, [countries])
  return (h: HolidayEntry) => {
    const name = holidayName(h, i18n.resolvedLanguage)
    return multi ? `${countryName(h.country)} · ${name}` : name
  }
}

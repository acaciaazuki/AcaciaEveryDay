import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HOLIDAY_COUNTRIES, importedYears, isHolidayCountry, loadHolidayFile, yearSpan, type HolidayCountry, type HolidayEntry, type HolidayFile } from '../core/holidays'
import { holidayStyle, useCountryName, useHolidayCountry, useHolidayLabel } from '../hooks/useHolidays'
import { useNow } from '../hooks/useNow'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './AcaciaIcons'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** 「國定假日」或「補班」標籤 */
export function HolidayTag({ holiday }: { holiday: Pick<HolidayEntry, 'work'> }) {
  const { t } = useTranslation()
  const s = holidayStyle(holiday)
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[length:calc(10px*var(--fs))] font-bold" style={{ background: s.tagBg, color: s.fg }}>
      <Icon name={holiday.work ? 'work' : 'vacation'} className="size-[1.3em]" />
      {t(holiday.work ? 'holidays.workTag' : 'holidays.tag')}
    </span>
  )
}

/** 月曆格子裡的小標籤（唯讀，不能點開編輯） */
export function HolidayChip({ holiday }: { holiday: HolidayEntry }) {
  const label = useHolidayLabel()
  const s = holidayStyle(holiday)
  return (
    <span
      data-holiday={holiday.id}
      title={label(holiday)}
      className="flex items-center gap-0.5 truncate rounded px-1 py-px text-[length:calc(10px*var(--fs))] leading-4 font-bold"
      style={{ background: s.tagBg, color: s.fg }}
    >
      <Icon name={holiday.work ? 'work' : 'vacation'} className="size-[1.3em] shrink-0" />
      <span className="truncate">{label(holiday)}</span>
    </span>
  )
}

/** 日期清單與今天頁用的卡片（唯讀） */
export function HolidayCard({ holiday, compact = false }: { holiday: HolidayEntry; compact?: boolean }) {
  const { t } = useTranslation()
  const label = useHolidayLabel()
  const s = holidayStyle(holiday)
  return (
    <div data-holiday={holiday.id} className={`rounded-xl border ${compact ? 'px-3 py-2' : 'px-4 py-3'}`} style={{ background: s.bg, borderColor: s.border }}>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <HolidayTag holiday={holiday} />
        <strong className="min-w-0 break-words text-[length:calc(13px*var(--fs))]" style={{ color: s.fg }}>
          {label(holiday)}
        </strong>
      </span>
      <small className="mt-0.5 block text-[length:calc(11px*var(--fs))] text-muted">
        {holiday.work ? t('holidays.workHint') : t('holidays.allDay')}
        {holiday.source === 'rules' && ` · ${t('holidays.estimated')}`}
      </small>
    </div>
  )
}

const selectClass = 'w-full min-w-0 rounded-(--radius-control) border border-line bg-oat px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-sage'

/** 行事曆「國定假日」面板：選國家與年份匯入、重新同步或清除 */
export function HolidayImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const countryName = useCountryName()
  const sets = useAppStore((s) => s.holidays)
  const importHolidays = useAppStore((s) => s.importHolidays)
  const clearHolidays = useAppStore((s) => s.clearHolidays)
  const setHolidayCountry = useAppStore((s) => s.setHolidayCountry)
  const initial = useHolidayCountry()
  const [country, setCountry] = useState<HolidayCountry>(initial)
  // 載入結果記下是哪一國的；切換國家後舊結果自然失效，不必在 effect 裡清空
  const [loaded, setLoaded] = useState<{ country: HolidayCountry; file: HolidayFile | null } | null>(null)
  const file = loaded?.country === country ? loaded.file : null
  const loadError = loaded?.country === country && !loaded.file
  const thisYear = useNow().getFullYear()
  // 年份：使用者沒選過時預設今年到明年，超出資料範圍時收進範圍內
  const [pickedFrom, setFrom] = useState<number | null>(null)
  const [pickedTo, setTo] = useState<number | null>(null)
  const clamp = (y: number) => (file ? Math.min(Math.max(y, file.years[0]), file.years[1]) : y)
  const from = clamp(pickedFrom ?? thisYear)
  const to = clamp(pickedTo ?? thisYear + 1)
  const [message, setMessage] = useState('')
  const [confirmClear, setConfirmClear] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadHolidayFile(country)
      .then((f) => alive && setLoaded({ country, file: f }))
      .catch(() => alive && setLoaded({ country, file: null }))
    return () => {
      alive = false
    }
  }, [country])

  const years = file ? yearSpan(file.years[0], file.years[1]) : []
  const imported = useMemo(() => [...new Set(sets.map((s) => s.country))].sort((a, b) => HOLIDAY_COUNTRIES.indexOf(a as HolidayCountry) - HOLIDAY_COUNTRIES.indexOf(b as HolidayCountry)), [sets])
  const yearsText = (list: number[]) => (list.length > 1 && list.at(-1)! - list[0] === list.length - 1 ? `${list[0]}–${list.at(-1)}` : list.join('、'))

  const report = (name: string, r: { added: number[]; updated: number[]; skipped: number[] }) => {
    const parts: string[] = []
    if (r.added.length) parts.push(t('holidays.result.added', { years: yearsText(r.added) }))
    if (r.updated.length) parts.push(t('holidays.result.updated', { years: yearsText(r.updated) }))
    if (r.skipped.length) parts.push(t('holidays.result.skipped', { years: yearsText(r.skipped) }))
    setMessage(t('holidays.result.line', { name, detail: parts.join(t('holidays.result.sep')) }))
  }

  const runImport = () => {
    if (!file) return
    setHolidayCountry(country)
    report(countryName(country), importHolidays(file, yearSpan(from, to)))
  }

  /** 重新同步：用目前內建的最新資料，重新匯入這個國家已匯入的年份 */
  const resync = async (code: string) => {
    if (!isHolidayCountry(code)) return
    setBusy(code)
    try {
      const f = await loadHolidayFile(code)
      report(countryName(code), importHolidays(f, importedYears(sets, code)))
    } catch {
      setMessage(t('holidays.loadError'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('holidays.title')}>
      <div className="grid gap-4">
        <p className="rounded-xl bg-sage-light/60 p-3 text-[length:calc(12px*var(--fs))] leading-relaxed text-sage-dark">{t('holidays.intro')}</p>

        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
          {t('holidays.country')}
          <select className={selectClass} value={country} onChange={(e) => isHolidayCountry(e.target.value) && setCountry(e.target.value)}>
            {HOLIDAY_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
                {c === 'GB' ? ` ${t('holidays.gbRegion')}` : ''}
              </option>
            ))}
          </select>
        </label>

        {file && (
          <p className="text-[length:calc(11px*var(--fs))] leading-relaxed text-muted">
            {t(`holidays.source.${file.source}`, { source: t(`holidays.sourceName.${country}`) })}
            {(country === 'CA' || country === 'AU') && ` ${t('holidays.nationalOnly')}`}
          </p>
        )}
        {loadError && <p className="text-xs text-[#c2583d]">{t('holidays.loadError')}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
            {t('holidays.from')}
            <select className={selectClass} value={from} disabled={!file} onChange={(e) => setFrom(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted">
            {t('holidays.to')}
            <select className={selectClass} value={to} disabled={!file} onChange={(e) => setTo(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Button onClick={runImport} disabled={!file} className="inline-flex items-center justify-center gap-1">
          <Icon name="vacation" className="size-[1.4em]" />
          {t('holidays.import')}
        </Button>
        {message && (
          <p role="status" className="rounded-xl bg-oat px-3 py-2 text-[length:calc(12px*var(--fs))] text-ink">
            {message}
          </p>
        )}

        <section className="grid gap-2 border-t border-line pt-4">
          <h3 className="text-sm font-bold">{t('holidays.imported')}</h3>
          {imported.length === 0 ? (
            <p className="text-[length:calc(12px*var(--fs))] text-muted">{t('holidays.none')}</p>
          ) : (
            <ul className="grid gap-2">
              {imported.map((code) => {
                const ys = importedYears(sets, code)
                const count = sets.filter((s) => s.country === code).reduce((n, s) => n + s.days.filter((d) => !d.work).length, 0)
                return (
                  <li key={code} data-imported={code} className="grid gap-2 rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <strong className="text-sm">{countryName(code)}</strong>
                      <small className="text-[length:calc(11px*var(--fs))] text-muted">{t('holidays.summary', { years: yearsText(ys), count })}</small>
                    </div>
                    {confirmClear === code ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">{t('holidays.clearConfirm', { name: countryName(code) })}</span>
                        <Button variant="ghost" className="ml-auto" onClick={() => setConfirmClear(null)}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            clearHolidays(code)
                            setConfirmClear(null)
                            setMessage(t('holidays.cleared', { name: countryName(code) }))
                          }}
                        >
                          {t('holidays.clearYes')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" disabled={busy === code} onClick={() => void resync(code)}>
                          {t('holidays.resync')}
                        </Button>
                        <Button variant="danger" onClick={() => setConfirmClear(code)}>
                          {t('holidays.clear')}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t('holidays.close')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

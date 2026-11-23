import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { TimeField } from './TimeField'

function Demo({ initial = '09:00', optional = false }: { initial?: string; optional?: boolean }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <TimeField label="開始" value={v} onChange={setV} optional={optional} />
      <output data-testid="value">{v}</output>
    </>
  )
}

const value = () => screen.getByTestId('value').textContent
const hour = () => screen.getByLabelText('開始 小時') as HTMLInputElement
const minute = () => screen.getByLabelText('開始 分鐘') as HTMLInputElement
const periodBtn = (name: string) => within(screen.getByRole('group', { name: 'AM／PM' })).getByRole('button', { name })

describe('TimeField', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW')
  })

  it('顯示 HH、mm 與 AM／PM，不出現上午／下午', () => {
    render(<Demo initial="21:30" />)
    expect(hour().value).toBe('09')
    expect(minute().value).toBe('30')
    expect(periodBtn('PM')).toHaveAttribute('aria-pressed', 'true')
    expect(document.body.textContent).not.toMatch(/上午|下午/)
  })

  it('逐字打 1、9 自動跳到分鐘，再打 30 → 19:30（不會變成 13:30）', () => {
    render(<Demo initial="09:00" />)
    hour().focus()
    fireEvent.change(hour(), { target: { value: '1' } })
    fireEvent.change(hour(), { target: { value: '19' } })
    expect(document.activeElement).toBe(minute())
    fireEvent.change(minute(), { target: { value: '30' } })
    expect(value()).toBe('19:30')
    expect(hour().value).toBe('07')
  })

  it('直接打 9 與 30、切換 PM → 21:30', () => {
    render(<Demo initial="08:00" />)
    fireEvent.change(hour(), { target: { value: '9' } })
    fireEvent.change(minute(), { target: { value: '30' } })
    expect(value()).toBe('09:30')
    fireEvent.click(periodBtn('PM'))
    expect(value()).toBe('21:30')
    fireEvent.click(periodBtn('AM'))
    expect(value()).toBe('09:30')
  })

  it('12 AM 是 00 點、12 PM 是 12 點；打 21 自動換成 09 PM', () => {
    render(<Demo initial="08:00" />)
    fireEvent.change(hour(), { target: { value: '12' } })
    expect(value()).toBe('00:00')
    fireEvent.click(periodBtn('PM'))
    expect(value()).toBe('12:00')
    fireEvent.change(hour(), { target: { value: '21' } })
    expect(value()).toBe('21:00')
    fireEvent.blur(hour())
    expect(hour().value).toBe('09')
    expect(periodBtn('PM')).toHaveAttribute('aria-pressed', 'true')
  })

  it('超出範圍顯示提示，離開格子後還原', () => {
    render(<Demo initial="10:15" />)
    fireEvent.change(hour(), { target: { value: '25' } })
    expect(screen.getByRole('alert')).toHaveTextContent('小時請輸入 1–12')
    expect(value()).toBe('10:15')
    fireEvent.blur(hour())
    expect(hour().value).toBe('10')
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.change(minute(), { target: { value: '75' } })
    expect(screen.getByRole('alert')).toHaveTextContent('分鐘請輸入 00–59')
    fireEvent.blur(minute())
    expect(minute().value).toBe('15')
    expect(value()).toBe('10:15')
  })

  it('只接受數字，單一位數補零', () => {
    render(<Demo initial="10:00" />)
    fireEvent.change(minute(), { target: { value: '5a' } })
    expect(minute().value).toBe('5')
    fireEvent.blur(minute())
    expect(minute().value).toBe('05')
    expect(value()).toBe('10:05')
  })

  it('保留點選方式：時鐘按鈕打開面板點小時、分鐘', () => {
    render(<Demo initial="08:00" />)
    fireEvent.click(screen.getByRole('button', { name: '點選開始' }))
    const panel = screen.getByRole('dialog', { name: '點選開始' })
    fireEvent.click(within(panel).getByRole('button', { name: '03' }))
    fireEvent.click(within(panel).getByRole('button', { name: '45' }))
    expect(value()).toBe('03:45')
    fireEvent.click(within(panel).getByRole('button', { name: '完成' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('日文顯示午前／午後', async () => {
    await i18n.changeLanguage('ja')
    render(<Demo initial="21:00" />)
    expect(screen.getByRole('button', { name: '午後' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('↑↓ 可以微調', () => {
    render(<Demo initial="11:59" />)
    fireEvent.keyDown(hour(), { key: 'ArrowUp' })
    expect(value()).toBe('12:59')
    fireEvent.keyDown(minute(), { key: 'ArrowUp' })
    expect(value()).toBe('12:00')
  })

  it('選填的欄位可以清空', () => {
    render(<Demo initial="" optional />)
    expect(hour().value).toBe('')
    fireEvent.change(hour(), { target: { value: '7' } })
    expect(value()).toBe('07:00')
    fireEvent.click(screen.getByRole('button', { name: '清除開始' }))
    expect(value()).toBe('')
    expect(hour().value).toBe('')
  })
})

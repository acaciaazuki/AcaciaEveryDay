import type { DaySpan } from '../core/span'

/**
 * 月曆格子裡跨日行程的標籤：接續的那一邊不圓角，並延伸到格子邊緣，相鄰幾天看起來像一條連續的橫條。
 * 負邊距對應格子的內距（sm:p-1.5、min-[1001px]:p-2；標籤在手機寬度不顯示）。
 */
export function spanChipClass(span: DaySpan | undefined): string {
  if (!span || span.pos === 'single') return 'rounded'
  if (span.pos === 'start') return 'rounded-l rounded-r-none sm:-mr-1.5 min-[1001px]:-mr-2!'
  if (span.pos === 'end') return 'rounded-r rounded-l-none sm:-ml-1.5 min-[1001px]:-ml-2!'
  return 'rounded-none sm:-mx-1.5 min-[1001px]:-mx-2!'
}

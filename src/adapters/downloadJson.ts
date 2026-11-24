/** 把資料存成 JSON 檔下載（設定頁「匯出」與錯誤畫面「下載資料備份」共用，格式相同，可以在設定頁匯入） */
export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}

/** 匯出檔名：acacia-YYYY-MM-DD.json */
export const backupFileName = (now = new Date()) => `acacia-${now.toISOString().slice(0, 10)}.json`

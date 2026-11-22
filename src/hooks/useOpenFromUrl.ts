import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/**
 * 網址帶 ?open=<id> 時開啟該筆資料的編輯對話框，然後把參數清掉。
 * ⌘K 搜尋選到結果時會導到 /tasks?open=xxx 這類網址。
 * 同一頁有兩種資料時可以換參數名稱（例如記帳頁的固定支出範本用 ?recurring=xxx）。
 */
export function useOpenFromUrl<T extends { id: string }>(items: T[], onOpen: (item: T) => void, param = 'open') {
  const [params, setParams] = useSearchParams()
  const id = params.get(param)
  useEffect(() => {
    if (!id) return
    const item = items.find((x) => x.id === id)
    if (item) onOpen(item)
    setParams(
      (p) => {
        p.delete(param)
        return p
      },
      { replace: true },
    )
  }, [id, items, onOpen, setParams, param])
}

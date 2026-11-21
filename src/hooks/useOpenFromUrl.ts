import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/**
 * 網址帶 ?open=<id> 時開啟該筆資料的編輯對話框，然後把參數清掉。
 * ⌘K 搜尋選到結果時會導到 /tasks?open=xxx 這類網址。
 */
export function useOpenFromUrl<T extends { id: string }>(items: T[], onOpen: (item: T) => void) {
  const [params, setParams] = useSearchParams()
  const id = params.get('open')
  useEffect(() => {
    if (!id) return
    const item = items.find((x) => x.id === id)
    if (item) onOpen(item)
    setParams(
      (p) => {
        p.delete('open')
        return p
      },
      { replace: true },
    )
  }, [id, items, onOpen, setParams])
}

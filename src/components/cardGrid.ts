/**
 * 卡片清單的網格（記帳清單、用品清單共用，兩邊版面一致）。
 *
 * 左側有 240px 的側邊欄，主內容最寬 1400px，斷點依「主內容實際寬度」設定：
 * - 手機、平板：1 欄
 * - 1001px 以上：2 欄（每張卡約 320px 起）
 * - 1360px 以上：3 欄（1366 筆電每張卡約 330px，寬螢幕約 355–420px），避免 1280 左右的視窗擠成三欄
 */
export const CARD_GRID = 'grid gap-3 min-[1001px]:grid-cols-2 min-[1360px]:grid-cols-3'

/** 清單卡片共用的外框：圓角、邊框、左側色條、內距 */
export const CARD_FRAME = 'min-w-0 rounded-xl border border-l-4 border-line p-4 transition hover:-translate-y-px'

# ACACIA Everyday（新版）

「你有幾件重要的事，還有足夠的空檔好好呼吸。」

ACACIA Everyday 的 React 19 + Vite 改版。舊版（單一 HTML 檔）仍在 GitHub Pages 上運作，新版使用新網址。

## 技術棧

- React 19 + TypeScript + Vite，啟用 React Compiler
- React Router（SPA）
- Tailwind CSS v4，色票沿用舊版鼠尾草綠
- Radix UI（對話框）
- Zustand + persist，資料存在 IndexedDB（透過 `src/adapters/storage.ts`，之後 iOS 換成 Capacitor 儲存）
- Zod 驗證資料結構，`src/core/migrate.ts` 負責把舊版 `acacia_data` 轉成新版
- react-i18next：繁體中文、日本語、English
- Vitest + Testing Library

## 開發

```sh
npm install
npm run dev      # 本機開發
npm test         # 單元測試
npm run lint     # oxlint
npm run build    # 正式建置，輸出到 dist/
```

## 資料夾

```
src/
  app/        路由與 Layout（桌面側欄 / 手機底部導覽）
  pages/      各頁面
  components/ 共用元件
  store/      Zustand store
  core/       資料結構、分類、遷移（純 TypeScript，不依賴 React）
  adapters/   儲存等平台相關程式
  i18n/       多語系設定與翻譯檔
```

## 從舊版搬資料

在新版「設定」頁匯入舊版匯出的 JSON。舊版分類（例如「食」「咖啡」）會自動轉成代碼，自訂的記帳類別會保留原文字。

## 遷移進度

- [x] 專案骨架、色票、Layout、多語系
- [x] 資料結構與舊資料遷移
- [x] 稍後辦
- [x] 設定（語言、匯入 / 匯出）
- [x] 購物清單與記帳
- [x] 今天
- [x] 行事曆（含批次建立）
- [x] 最愛地點（含地點搜尋）
- [x] ⌘K 搜尋
- [ ] Google Drive 同步

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

## 第三方授權清單

側邊欄「設定」下方（手機在設定頁最底部）有「第三方授權清單」小連結，列出所有套件的授權、版權聲明與授權全文。資料放在 `src/licenses/`，由腳本依 `package-lock.json` 與 `node_modules` 產生：

```sh
npm install
npm run licenses   # 重新產生 src/licenses/packages.json 與 texts.json
```

新增、移除或升級套件後要重跑並 commit 產生的檔案；`npm test` 會檢查資料是否過期，也會擋下隨網站發布的 GPL / AGPL 套件。腳本執行時會列出 GPL / AGPL、MPL 等需要注意的授權。

## 網站圖示（台灣相思樹）

Favicon、PWA 圖示、iOS 主畫面圖示、側邊欄 Logo、載入畫面與備份區塊的枝條，都由 `src/brand/acaciaArt.ts` 的向量形狀畫出來（React 元件直接 inline SVG，見 `src/components/BrandMark.tsx`）。改了形狀之後重新產生 `public/` 的圖檔與 `index.html` 的載入畫面：

```sh
npm run icons   # 需要 Playwright 的 Chromium（npx playwright install chromium）
```

換圖示時把 `index.html` 與 `public/manifest.webmanifest` 裡的 `?v=` 一起加一，瀏覽器才會抓新圖。`npm test` 會檢查 `public/` 的圖檔有沒有跟程式裡的形狀同步。

## 側邊欄排序

設定頁「側邊欄排序」可以調整「收集與整理」區塊的順序（拖曳把手、方向鍵、上下移動按鈕），側邊欄區塊標題旁也有低調的「排序」入口。順序存在 `settings.navOrder`（跟著備份與 Drive 同步）。可排序的項目定義在 `src/app/navSections.ts`：新增功能加進陣列即可，使用者已存的順序會自動把新項目補在最後，移除的項目會被忽略（`src/core/navOrder.ts`）。項目的 `key` 存在使用者資料裡，請勿改名。

## 隱私權政策、自動備份與刪除資料

- 隱私權政策（繁中／日文／英文）：側邊欄與設定頁底部的小連結點了跳出面板（`src/components/PrivacyDialog.tsx`）；公開網址 `/privacy` 打開時以今天頁為背景自動跳出同一個面板，全文在 `src/pages/privacy/policy.ts`。改到儲存、同步、定位或第三方服務時要一起更新，並改 `UPDATED_DATE`。支援信箱用環境變數 `VITE_SUPPORT_EMAIL` 覆寫（預設 acacia.qiqi@gmail.com）。
- 使用前同意：第一次使用、或隱私權政策／第三方授權清單改版時，以全螢幕面板（`src/components/ConsentGate.tsx`）擋住整個 App，只能按「同意並開始使用」進入；沒有關閉鈕，Esc、點背景都關不掉，按「不同意」只會顯示說明、仍然擋住。同意前不啟動 Google 登入、定位、自動備份與同步。`/privacy` 網址在同意前一樣顯示政策全文。同意紀錄（版本、時間）存在本機 IndexedDB 的 `acacia-consent`，不跟 Drive 同步、不放進備份，清除瀏覽器資料或「刪除所有資料」後會再次詢問。
  - 隱私權政策改版：改 `src/pages/privacy/policy.ts` 的 `UPDATED_DATE` 時，同時把 `src/core/consent.ts` 的 `PRIVACY_VERSION` 改成相同日期（不一致時 `npm test` 會失敗）。
  - 第三方授權清單：套件升級不會自動要求重新同意；需要時把 `src/core/consent.ts` 的 `LICENSES_VERSION` 改成當天日期。
- 自動備份：開啟網站與資料變動後，距上次超過 12 小時就在背景建立快照，存在 IndexedDB 的 `acacia-backups`（最多 7 份）；已登入時另外上傳到 Drive 的 `acacia_backup_v2.json`，不動同步檔。邏輯在 `src/core/backup.ts` 與 `src/store/useBackupStore.ts`。
- 設定頁「刪除所有資料」：刪除 Drive 上的 ACACIA 檔案（已登入時）、登出，並清空本機資料與快照（`src/store/deleteAllData.ts`）。

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

## 部署（Cloudflare Pages）

在 Cloudflare 後台 Workers & Pages → Create → Pages → Connect to Git，選這個 repo，設定：

| 項目 | 值 |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 環境變數 | `NODE_VERSION` = `22` |

`public/_redirects` 已設定 SPA 路由，直接開 `/tasks` 等網址也能正常載入。每個 PR 會自動產生預覽網址。

部署後記得：

1. 在 Google Cloud Console 的 OAuth 用戶端「已授權的 JavaScript 來源」加入新網址（例如 `https://acaciaeveryday.pages.dev`），Google 登入同步才能用。預覽網址每次不同，Google 不支援萬用字元，所以預覽站無法登入，屬正常現象。
2. 如果地點搜尋的 Cloudflare Worker 有限制來源網域，也把新網址加進去。

可選的環境變數：`VITE_GOOGLE_CLIENT_ID`、`VITE_PLACES_PROXY_URL`。

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
- [x] Google Drive 同步

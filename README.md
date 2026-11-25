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

## 授權

Copyright © 2026 acaciaazuki

ACACIA Everyday 以 [GNU Affero General Public License v3.0 或更新版本](LICENSE)（`AGPL-3.0-or-later`）釋出，完整聲明見 [`NOTICE`](NOTICE)。

- 任何人都可以使用、研究、修改這份程式碼。
- 修改後再散布，或把修改後的版本架成網站／服務讓別人使用，必須：保留原作者的版權聲明、註明修改的地方、以同樣的 AGPL 授權公開完整原始碼。
- 本程式不提供任何擔保。

App 內「第三方授權清單」面板最上方也會顯示本 App 的授權、原始碼連結與 AGPL 全文（`src/components/AppLicense.tsx`）。`npm test` 會檢查 `package.json` 的 `license`、`LICENSE` 與畫面上的授權是否一致。使用的第三方套件各自保有原本的授權，見下一節。

## 第三方授權清單

側邊欄「設定」下方（手機在設定頁最底部）有「第三方授權清單」小連結，列出所有套件的授權、版權聲明與授權全文。資料放在 `src/licenses/`，由腳本依 `package-lock.json` 與 `node_modules` 產生：

```sh
npm install
npm run licenses   # 重新產生 src/licenses/packages.json 與 texts.json
```

新增、移除或升級套件後要重跑並 commit 產生的檔案；`npm test`（CI 每個 PR 都會跑）會檢查資料是否過期，也會擋下隨網站發布的 GPL / AGPL 套件。腳本執行時會列出 GPL / AGPL、MPL 等需要注意的授權；隨網站發布的套件出現**新的授權類型**時，也會提醒評估是否要改 `LICENSES_VERSION`（請使用者重新同意）。

## 網站圖示（台灣相思樹）

Favicon、PWA 圖示、iOS 主畫面圖示、側邊欄 Logo、載入畫面與備份區塊的枝條，都由 `src/brand/acaciaArt.ts` 的向量形狀畫出來（React 元件直接 inline SVG，見 `src/components/BrandMark.tsx`）。改了形狀之後重新產生 `public/` 的圖檔與 `index.html` 的載入畫面：

```sh
npm run icons   # 需要 Playwright 的 Chromium（npx playwright install chromium）
```

`index.html` 與 `public/manifest.webmanifest` 裡的 `?v=`（瀏覽器快取版本）由圖示的向量內容算出（`iconVersion()`），`npm run icons` 會自動寫入，**不用手動加一**。`npm test` 會檢查 `public/` 的圖檔與 `?v=` 有沒有跟程式裡的形狀同步，改了形狀卻忘了重跑會失敗。

## 側邊欄排序

設定頁「側邊欄排序」可以調整「收集與整理」區塊的順序（拖曳把手、方向鍵、上下移動按鈕），側邊欄區塊標題旁也有低調的「排序」入口。順序存在 `settings.navOrder`（跟著備份與 Drive 同步）。可排序的項目定義在 `src/app/navSections.ts`：新增功能加進陣列即可，使用者已存的順序會自動把新項目補在最後，移除的項目會被忽略（`src/core/navOrder.ts`）。項目的 `key` 存在使用者資料裡，請勿改名。

## 隱私權政策、自動備份與刪除資料

- 隱私權政策（繁中／日文／英文）：側邊欄與設定頁底部的小連結點了跳出面板（`src/components/PrivacyDialog.tsx`）；公開網址 `/privacy` 打開時以今天頁為背景自動跳出同一個面板，全文在 `src/pages/privacy/policy.ts`。改到儲存、同步、定位或第三方服務時要一起更新，並改 `PRIVACY_VERSION`（見下方）；政策頁的「最後更新」（`UPDATED_DATE`）直接沿用它，使用者也會被要求重新同意。三種語言的章節與段落結構由測試檢查是否一致。支援信箱的正式地址是 **acacia.qiqi@gmail.com**（程式預設值，不設定環境變數也會使用它）；只有要換信箱時才需要設定 `VITE_SUPPORT_EMAIL`。
- 使用前同意：第一次使用、或隱私權政策／第三方授權清單改版時，以全螢幕面板（`src/components/ConsentGate.tsx`）擋住整個 App，只能按「同意並開始使用」進入；沒有關閉鈕，Esc、點背景都關不掉，按「不同意」只會顯示說明、仍然擋住。同意前不啟動 Google 登入、定位、自動備份與同步。`/privacy` 網址在同意前一樣顯示政策全文。同意紀錄（版本、時間）存在本機 IndexedDB 的 `acacia-consent`，不跟 Drive 同步、不放進備份，清除瀏覽器資料或「刪除所有資料」後會再次詢問。
  - 隱私權政策改版：只要把 `src/core/consent.ts` 的 `PRIVACY_VERSION` 改成當天日期；政策頁的「最後更新」（`UPDATED_DATE`）直接沿用它，使用者也會被要求重新同意。
  - 第三方授權清單：套件升級不會自動要求重新同意；需要時把 `src/core/consent.ts` 的 `LICENSES_VERSION` 改成當天日期。
- 自動備份：開啟網站與資料變動後，距上次超過 12 小時就在背景建立快照，存在 IndexedDB 的 `acacia-backups`（最多 7 份）；已登入時另外上傳到 Drive 的 `acacia_backup_v2.json`，不動同步檔。邏輯在 `src/core/backup.ts` 與 `src/store/useBackupStore.ts`。
- 設定頁「刪除所有資料」：刪除 Drive 上的 ACACIA 檔案（已登入時）、登出，並清空本機資料與快照（`src/store/deleteAllData.ts`）。

## 同步與衝突處理

雲端同步只有一個檔案：主資料 `acacia_data_v2.json`。

### 主資料（`acacia_data_v2.json`）

行事曆個人行程、稍後辦、購物記帳、地點、設定等，以**每一筆紀錄**為單位合併（`src/core/appMerge.ts`）：

- **修改紀錄（`syncMeta`）：**每次修改時，store 自動比對前後差異，記下每筆紀錄、每個設定欄位最後修改的時間，刪除時留下刪除標記
- **合併規則（`mergeAppData`）：**
  - 同一筆紀錄取修改時間較新的版本；刪除時間比另一邊的修改晚才刪除
  - 只在一邊存在、另一邊也沒有刪除標記的紀錄一律保留（離線新增的資料不會遺失）
  - 清單順序（例如最愛地點的自訂順序）以較新的排序為準，另一邊新增的接在後面
  - 設定逐欄位比較；其他欄位（庫存分類、範例是否已帶入）整個欄位比較
  - 時間相同時刪除優先，再依內容排序，確保每台裝置合併出一樣的結果
- **同步流程：**登入時與每次上傳前，先下載雲端、合併後套用到本機，再上傳合併結果；上傳期間又有修改時，結束後再同步一次
- **兩台裝置都離線修改：**各自的修改都會保留；改到同一筆時以較晚的修改為準
- **還原快照：**當成「現在做的修改」，同步時以還原結果為準
- **舊資料相容：**`syncMeta` 是可省略的欄位，舊版 App 讀到會忽略。沒有修改紀錄的資料（舊版 App 寫的、或升級前的本機資料），每一筆都當作整份 `updatedAt` 的時間
- **刪除標記保留 180 天**（`TOMBSTONE_TTL`），之後清掉，修改紀錄不會無限長大；離線超過 180 天的裝置，刪掉的資料可能會再出現

### 已移除的共享行事曆

早期版本有「共享空間／忙碌時段同步」，已整個移除，回歸個人日常工具。舊資料的處理（`src/store/legacySpacesMigration.ts`）：

- **本機的 `acacia-spaces`：**第一次開啟新版時，把「自己建立、還沒刪除、所在空間還在」的共享行程轉成個人行程（地點、細節與跨日的結束日併進備註），轉換前先留一份本機快照（原因「轉換共享行程前」），並把舊資料原樣另存在快照資料庫；完成後清掉 `acacia-spaces` 與 `acacia-spaces-backups`。讀取或轉換失敗時整個跳過、不清除，也不擋畫面，下次開啟再試
- **Drive 的 `acacia_spaces_v1.json`：**不再讀寫；「刪除所有資料」時一併刪除
- **主資料同步檔：**本來就不含共享欄位；讀取時看不懂的欄位一律丟掉，不會出錯

快照：主資料的本機快照存在 `acacia-backups`，可以在設定頁還原。

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

`public/_headers` 設定回應標頭（`src/app/headers.test.ts` 會檢查必要的設定還在）：

- **安全：**`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options: DENY`（不能被其他網站嵌入）、`Permissions-Policy`（定位只給本站，用不到的權限關閉）
- **Google 登入：**`Cross-Origin-Opener-Policy` 必須是 `same-origin-allow-popups`，改成 `same-origin` 會讓登入彈出視窗無法回傳結果
- **快取：**只有檔名含雜湊的 `/assets/*` 長期快取；HTML 沿用 Cloudflare 預設，每次確認最新版，部署後使用者重新整理就會拿到新版
- **CSP（內容安全政策）：**目前沒有設定。Google 登入、Google 字型、Drive API 與地點搜尋 Proxy 都會連外，要列出所有來源並在預覽站測過登入後再加

### 上線檢查清單

新增或更換網域（例如正式網址 `https://acaciaeveryday.pages.dev`、自訂網域）時，逐項確認：

- [ ] **Google OAuth 來源：**到 Google Cloud Console → API 和服務 → 憑證 → OAuth 用戶端，在「已授權的 JavaScript 來源」加入新網址（不含結尾斜線）。沒加會出現登入錯誤 `origin_mismatch`，Drive 同步與雲端備份都無法使用
  - PR 預覽網址每次不同，Google 不支援萬用字元，所以**預覽站無法登入，屬正常現象**；要測登入請用正式網址
- [ ] **地點搜尋 Proxy：**`VITE_PLACES_PROXY_URL` 指向的 Cloudflare Worker 若有限制來源網域（CORS 白名單），把新網址加進去，否則地點搜尋會失敗
- [ ] **環境變數**（Cloudflare Pages → Settings → Environment variables，Production 與 Preview 都要設）：

  | 變數 | 用途 | 沒設定時 |
  | --- | --- | --- |
  | `NODE_VERSION` | 建置用的 Node 版本，設 `22` | 可能用到不相容的版本 |
  | `VITE_GOOGLE_CLIENT_ID` | Google 登入的 OAuth 用戶端 ID | 使用程式內建的 ID |
  | `VITE_PLACES_PROXY_URL` | 地點搜尋 Proxy 網址 | 使用程式內建的網址 |
  | `VITE_SUPPORT_EMAIL` | 隱私權政策的支援信箱 | 使用 acacia.qiqi@gmail.com |

- [ ] **上線後實測：**正式網址開啟 → Google 登入 → 設定頁看到「已同步」→ 最愛地點搜尋一個地點 → 開 `/privacy` 確認政策與信箱正確
- [ ] **GitHub 儲存庫 About：**描述、網站（正式網址）與 Topics 已填寫

## iOS App（Capacitor）

網頁版之外，同一份程式可以用 [Capacitor](https://capacitorjs.com/) 包成 iOS App（設定在 `capacitor.config.ts`）。

### 資料存在哪裡

| 資料 | 網頁版 | iOS App |
|---|---|---|
| 主資料 | IndexedDB | `Library/acacia/state/` 的 JSON 檔 |
| 主資料快照 | IndexedDB（acacia-backups） | `Library/acacia/backups/` |
| 使用條款同意紀錄 | IndexedDB（acacia-consent） | Preferences（UserDefaults） |

- iOS 不用 WebView 的 IndexedDB：系統空間不足時可能清掉 WebView 的網站資料
- 寫入時先寫暫存檔再改名，寫到一半當機也不會留下半個檔案；檔案損毀時另存成 `.corrupt-<時間>` 備查
- `Library/` 不會出現在「檔案」App，但會跟著 iPhone 的 iCloud 備份，換機時資料能跟著回來
- 第一次開啟 App 時，若 WebView 的 IndexedDB 有舊資料（早期測試版），會自動搬到檔案並刪掉舊資料，只做一次
- 程式只透過 `src/adapters/kv/` 與 `src/adapters/consentStorage.ts` 讀寫，store 與畫面不需要知道是哪一種

### 在 Mac 上建置

需要 Xcode。第一次：

```bash
npm install
npm run build
npx cap add ios
```

產生的 `ios/` 原生專案要 commit 進 repo。之後每次修改網頁程式：

```bash
npm run ios:sync
```

```bash
npm run ios:open
```

目前 iOS App 還不能用 Google 登入（Google 不允許在 App 內嵌的網頁做 OAuth，之後要改用原生登入外掛），所以 Drive 同步與雲端備份在 App 裡暫時無法使用；本機資料、快照與其他功能都正常。

App 內的處理（`isNativeApp()` 判斷）：

- 側邊欄與設定頁不顯示「Google 登入同步」按鈕，改成說明「只有本機資料與 iCloud 備份有效；需要 Google Drive 同步請改用網頁版」
- 自動備份的「Google Drive 備份槽」也改成說明資料只存在這台 iPhone、隨 iCloud 備份
- 啟動時不會嘗試 Google 登入

之後若要支援：評估 Capacitor 的原生 Google Sign-In 外掛（需要 Google Cloud 的 iOS 用戶端 ID 與 Xcode 設定），登入後沿用現有的 Drive 同步程式。

### App Store 隱私標示

隱私權政策第 4 節已寫明 ACACIA 申報「不收集資料（Data Not Collected）」。在 App Store Connect 填寫「App 隱私」前，逐項確認仍然成立：

- [ ] **沒有追蹤、廣告、分析或當機回報 SDK：**`package.json` 的 dependencies 只有畫面、狀態、翻譯與 Capacitor 套件；新增任何會連外的套件前要先檢查
- [ ] **地點搜尋 Proxy 不保存搜尋字詞：**`VITE_PLACES_PROXY_URL` 指向的 Cloudflare Worker 要關閉 Workers Logs／Logpush，程式只即時轉送查詢、不寫入任何儲存。若這個 Worker 不是自己經營的，搜尋字詞就屬於傳給第三方，要重新評估標示，或改成自己的 Worker
- [ ] **沒有自己的伺服器接收使用者資料：**同步只寫使用者自己的 Google Drive 應用程式專用資料夾
- [ ] **資料保留期間與政策一致：**最近刪除 30 天（`src/core/trash.ts` 的 `TRASH_RETENTION_MS`）、刪除標記 180 天（`src/core/appMerge.ts` 的 `TOMBSTONE_TTL`）；改這兩個數字時要一起改政策並更新 `PRIVACY_VERSION`

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

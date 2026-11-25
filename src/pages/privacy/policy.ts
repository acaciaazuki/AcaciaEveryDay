/**
 * 隱私權政策全文（繁中／日文／英文）。
 * 內容依程式碼實際行為撰寫：改到儲存、同步、定位或第三方服務時，記得一起更新這裡，並把 src/core/consent.ts 的 PRIVACY_VERSION 改成當天日期
 * （UPDATED_DATE 直接沿用它，使用者也會因此被要求重新同意）。
 * 段落中的網址與 {email} 會自動變成連結。
 */

import { PRIVACY_VERSION } from '../../core/consent'

/** 支援信箱（也可以用環境變數 VITE_SUPPORT_EMAIL 覆寫） */
export const CONTACT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? 'acacia.qiqi@gmail.com'
export const EFFECTIVE_DATE = '2026-11-22'
/** 最後更新日期＝同意紀錄用的政策版本（src/core/consent.ts 的 PRIVACY_VERSION），只要改那裡一處 */
export const UPDATED_DATE = PRIVACY_VERSION

export type PolicyBlock = string | { list: string[] } | { sub: string }
export interface PolicySection {
  id: string
  heading: string
  blocks: PolicyBlock[]
}
export interface PolicyDoc {
  title: string
  eyebrow: string
  dates: { effective: string; updated: string }
  toc: string
  summaryTitle: string
  summary: string[]
  sections: PolicySection[]
}

export type PolicyLang = 'zh-TW' | 'ja' | 'en'

const zhTW: PolicyDoc = {
  title: '隱私權政策',
  eyebrow: '你的資料，留在你身邊',
  dates: { effective: '生效日期：', updated: '最後更新：' },
  toc: '目錄',
  summaryTitle: '重點摘要',
  summary: [
    '不需要註冊帳號也能完整使用。你的資料預設只存在這台裝置的瀏覽器裡（IndexedDB）。',
    '開啟 Google 雲端同步後，資料只會存進「你自己」Google Drive 的應用程式專用資料夾。我們沒有伺服器或資料庫保存你的資料，也看不到你的資料。',
    '位置只用於「防遺漏提醒」的到達／離開判斷，以及你在「最愛地點」選擇依距離排序時計算距離，都在你的裝置上計算，不會傳送給我們或任何第三方。',
    '不放廣告、不使用任何分析或追蹤工具、不販售或分享你的資料。',
    '你隨時可以匯出 JSON、從自動備份還原，或在設定頁一鍵刪除所有本機與雲端資料。',
  ],
  sections: [
    {
      id: 'scope',
      heading: '1. 適用範圍',
      blocks: [
        '本隱私權政策說明 ACACIA Everyday（以下稱「本服務」或「ACACIA」）的開發與營運者（以下稱「我們」）如何處理你在使用本服務時的資料。本政策適用於網頁版（https://acaciaeveryday.pages.dev）以及日後推出的 iOS App。',
        '我們依中華民國《個人資料保護法》處理個人資料，並參考歐盟一般資料保護規則（GDPR）、Apple App Store 審核準則與 Google API 服務使用者資料政策的要求撰寫本政策。',
      ],
    },
    {
      id: 'collect',
      heading: '2. 我們處理哪些資料',
      blocks: [
        { sub: '2.1 帳號資訊（僅在你選擇使用 Google 登入時）' },
        '登入是選用功能，只用於雲端同步。登入時本服務透過 Google OAuth 向 Google 取得下列權限：',
        {
          list: [
            '基本個人資料（userinfo.profile）：你的 Google 帳號姓名與大頭貼網址，只用來在畫面上顯示目前登入的帳號。這些資料只保留在瀏覽器記憶體中，關閉分頁即消失，不會寫入你的資料檔，也不會傳送給我們。',
            'Google Drive 應用程式專用資料夾（drive.appdata）：只能讀寫 ACACIA 自己建立的檔案，無法看到你 Drive 裡的其他任何檔案。',
          ],
        },
        '本服務不會要求你的 Email 地址、通訊錄、行事曆或 Drive 中的其他檔案。登入取得的存取權杖（access token）存在瀏覽器的 sessionStorage，最長約一小時有效，關閉分頁或登出即刪除；登出時會一併向 Google 撤銷該權杖。',
        { sub: '2.2 位置資訊（僅在你建立防遺漏提醒，或選擇依距離排序最愛地點時）' },
        {
          list: [
            '只有在你建立「已啟用且有座標」的防遺漏提醒，或在「最愛地點」選擇「距離遠近」排序時，本服務才會向瀏覽器（或 iOS）要求位置權限；兩者都沒有就不會使用定位。',
            '網頁版在 ACACIA 開啟期間，透過瀏覽器定位取得精確位置，用來判斷你是否到達或離開提醒地點。判斷完全在你的裝置上計算；即時位置不會傳送給我們或任何第三方，也不會儲存位置歷史或移動軌跡。',
            '在提醒設定中按下「使用目前位置」時，當下的座標會存成那一則提醒的地點座標，屬於你建立的內容（見 2.3），會跟其他資料一起存在本機，並在你開啟同步時存進你的 Google Drive。',
            '「最愛地點」選擇依距離排序時，會取得一次目前位置，只在你的裝置上計算與各地點的距離；這個位置不會傳送給我們或任何第三方，也不會儲存（重新整理或離開頁面即消失）。之後再開啟時，只有在你已經允許過定位權限的情況下才會自動重新取得，否則會等你按下「使用目前位置」。地點本身的座標由你手動輸入，或在地點搜尋結果有附座標時一起帶入（見第 4 節），屬於你建立的內容（見 2.3）。',
            '位置資訊不會用於廣告、行銷、側寫或任何追蹤用途。你可以隨時在瀏覽器或系統設定中撤回位置權限。',
          ],
        },
        { sub: '2.3 你建立的內容' },
        '你在 ACACIA 中輸入的行程、待辦、記帳與購物清單（含歸檔與固定支出範本）、庫存與用品、訂閱與續費、最愛地點、防遺漏提醒、匯入行事曆的國定假日，以及語言、字體大小、預設貨幣、國定假日的國家等設定。這些內容只用於提供本服務的功能。',
        { sub: '2.4 裝置上的小型偏好設定' },
        '為了讓畫面一打開就套用你的偏好，語言、字體大小與最近的搜尋紀錄會存在瀏覽器的 localStorage。這些資料不會傳出你的裝置。',
        { sub: '2.5 系統通知' },
        '防遺漏提醒可以使用瀏覽器（或 iOS）的本機通知。通知由你的裝置直接顯示，不經過任何推播伺服器。',
        { sub: '2.6 國家／地區與國定假日' },
        {
          list: [
            '在行事曆匯入國定假日時，App 會依瀏覽器提供的時區與語言設定，在你的裝置上推測預設的國家／地區（例如時區為 Asia/Taipei 時預設台灣）。這只是下拉選單的預設值，不使用定位、不需要位置權限，推測結果也不會傳送出去。',
            '你選定的國家與匯入的假日會存進你的資料（見 2.3），跟其他內容一樣存在本機、包含在自動備份中，並在你開啟同步時存進你的 Google Drive。你可以隨時在行事曆的「國定假日」面板清除某個國家的假日。',
            '假日資料已內建在 App 中（來源見第 4 節），匯入或重新同步時不會連線到任何假日服務，也不會傳送國家、年份或其他資料。',
          ],
        },
        { sub: '2.7 我們不處理的資料' },
        '本服務沒有自己的帳號系統，也不收集使用分析、當機報告、廣告識別碼（IDFA 等）、裝置指紋、通訊錄、照片或健康資料。',
      ],
    },
    {
      id: 'storage',
      heading: '3. 資料儲存位置與傳輸安全',
      blocks: [
        { sub: '3.1 優先儲存在你的裝置' },
        {
          list: [
            '主要資料存在你瀏覽器的 IndexedDB（資料庫名稱 acacia-next）。',
            '自動備份快照存在另一個 IndexedDB 資料庫（acacia-backups），最多保留最近 7 份，較舊的自動刪除。',
            '小型偏好設定存在 localStorage；Google 存取權杖存在 sessionStorage（見 2.1）。',
          ],
        },
        { sub: '3.2 雲端同步：只存進你自己的 Google Drive' },
        '開啟 Google 登入同步後，資料只會寫入你自己 Google Drive 的「應用程式專用資料夾」（appDataFolder）。這是 Google 提供給每個 App 的隱藏空間，你在 Drive 畫面上看不到，其他 App 也無法讀取，佔用的是你自己的 Drive 容量。使用的檔案如下：',
        {
          list: [
            'acacia_data_v2.json：同步用的完整資料。',
            'acacia_backup_v2.json：最新一份自動備份（每次自動備份時覆寫，不影響同步檔）。',
            'acacia_spaces_v1.json：舊版共享行事曆的同步檔。共享行事曆功能已移除，App 不再讀寫這個檔案；如果你的 Drive 裡還有，會在「刪除所有資料」時一併刪除。',
            'acacia_data.json：舊版 ACACIA 網站的同步檔。第一次登入時本服務會讀取它來搬移資料，但不會修改它。',
          ],
        },
        { sub: '3.3 傳輸與加密' },
        {
          list: [
            '你的瀏覽器與 Google 之間的所有連線都使用 HTTPS（TLS）加密傳輸，資料直接在你的裝置與 Google 之間往返，不經過我們的伺服器。',
            'ACACIA 本身不會對資料另外做端對端加密：本機資料以 JSON 格式存在瀏覽器中，受你的作業系統與瀏覽器保護；雲端檔案則依 Google 的安全措施儲存在你的 Drive。建議為裝置設定螢幕鎖，並避免在共用電腦上登入同步。',
          ],
        },
        { sub: '3.4 我們不持有你的資料' },
        '除了第 4 節所述的地點搜尋服務會收到搜尋字詞外，我們沒有任何伺服器或資料庫保存你的個人資料，無法存取、檢視、分析，也無法替你復原資料。請善用匯出 JSON 與自動備份功能保護你的資料。',
      ],
    },
    {
      id: 'third-party',
      heading: '4. 第三方服務',
      blocks: [
        '本服務只會在必要時與下列服務連線，各服務依其自己的隱私權政策處理資料：',
        {
          list: [
            'Google Identity Services（accounts.google.com）：只在你按下「Google 登入同步」時載入，用於登入與授權。',
            'Google OAuth 使用者資訊 API：登入後取得姓名與大頭貼（見 2.1）。',
            'Google Drive API：讀寫你 Drive 應用程式專用資料夾中的 ACACIA 檔案（見 3.2）。',
            '地點搜尋：在新增最愛地點時使用搜尋功能，你輸入的搜尋字詞會從瀏覽器傳送到 App 設定的地點搜尋服務（架設在 Cloudflare Workers 上的網址 bold-cloud-4bb3.s3311453038.workers.dev，沿用自舊版 ACACIA），由它向 Google Places API 查詢地點名稱、地址與營業時間（服務有回傳時也包含座標）。會收到搜尋字詞的對象為：Cloudflare（Workers 平台）、該搜尋服務的營運者，以及 Google。傳送的只有搜尋字詞與一般連線資訊（例如 IP 位址），不包含你的位置或其他 ACACIA 資料。這些對象依各自的政策處理資料。若不使用搜尋、改為手動輸入地點，就不會傳送任何內容；搜尋服務無法使用時，搜尋會失敗，但仍可手動輸入',
            'Google Fonts（fonts.googleapis.com、fonts.gstatic.com）：網頁載入字型時，你的瀏覽器會直接向 Google 下載字型檔，Google 因此會收到你的 IP 位址與瀏覽器資訊。',
            'Cloudflare Pages：網頁版的託管服務。如同一般網站，Cloudflare 可能為了安全與維運記錄連線資訊（例如 IP 位址、請求時間）。',
            'Google 地圖：只有在你點擊地點的地圖連結時，才會在新分頁開啟 Google 地圖。',
            '國定假日資料：台灣採用行政院人事行政總處「政府行政機關辦公日曆表」（政府資料開放平台），中國採用國務院辦公廳公告（經開源專案 holiday-cn 整理），韓國採用宇宙航空廳月曆要項（經開源專案 holidays-kr 整理），其他國家採用開源專案 date-holidays 依法定規則推算。這些資料在建置網站時就打包進 App，使用時不會連線到上述來源，因此不會有任何資料傳給它們。各來源的授權列在「第三方授權清單」。',
          ],
        },
        'Google 隱私權政策：https://policies.google.com/privacy',
        'Cloudflare 隱私權政策：https://www.cloudflare.com/privacypolicy/',
        { sub: '不使用廣告與追蹤' },
        '本服務不顯示廣告，不使用任何第三方廣告追蹤器、分析工具（例如 Google Analytics）或跨 App／跨網站追蹤，也不會出售、出租或分享你的資料給任何人。',
        { sub: 'App 隱私標示：不收集資料' },
        '依 Apple App Store「App 隱私」的定義，ACACIA 申報為「不收集資料（Data Not Collected）」：我們沒有自己的伺服器或資料庫，不會接收、保存或存取你的行程、待辦、記帳、地點、位置、聯絡資訊、使用紀錄或診斷資料；App 裡沒有任何追蹤、廣告或分析 SDK。你的資料只存在你的裝置，以及你自己選擇開啟同步時的 Google Drive 應用程式專用資料夾。上面列出的第三方服務只用於即時完成你當下的操作（例如登入、讀寫你的 Drive、查詢地點），不會用來追蹤你或建立你的個人檔案。',
        { sub: 'Google API 有限使用聲明' },
        'ACACIA 使用與傳輸從 Google API 取得的資訊時，會遵守 Google API 服務使用者資料政策（https://developers.google.com/terms/api-services-user-data-policy），包括其中的有限使用（Limited Use）要求。從 Google 取得的資料只用於在 App 內提供同步與顯示登入帳號的功能，不會用於廣告，也不會轉移給第三方或供人員閱讀。',
      ],
    },
    {
      id: 'retention',
      heading: '5. 資料保留期間',
      blocks: [
        {
          list: [
            '本機資料：保留到你在 App 內刪除、使用「刪除所有資料」或清除瀏覽器網站資料為止。',
            '自動備份快照：本機最多 7 份，超過時自動刪除最舊的一份；Drive 備份槽只保留最新一份。',
            '雲端同步檔：保留在你的 Google Drive，直到你刪除（見第 6 節）。',
            'Google 存取權杖：最長約一小時，關閉分頁或登出時刪除。',
            '最近刪除：刪除的行程會先放在「最近刪除」30 天，期間可以還原；滿 30 天後自動永久刪除（在 App 啟動、同步或打開「最近刪除」時執行，不需要任何伺服器）。',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '6. 你的權利與資料控制',
      blocks: [
        '依個人資料保護法及 GDPR，你可以查詢、閱覽、取得副本、更正、刪除你的資料，或停止處理。由於資料由你自己保管，這些權利大多可以直接在 App 內行使：',
        { sub: '6.1 查閱與匯出（資料可攜）' },
        '到「設定 → 資料備份與搬家」按「匯出 JSON」，即可下載完整資料的 JSON 檔，可再匯入 ACACIA 或其他工具。',
        '同一處也可以「匯出行事曆（.ics）」，把我的行事曆的行程產生成標準 iCalendar 檔，匯入 Apple 行事曆、Google 日曆、Outlook 等 App。檔案在你的裝置上產生，不會經過任何伺服器。',
        { sub: '6.2 更正與還原' },
        '所有內容都可以直接在 App 內修改。誤刪資料時，可以在「設定 → 資料備份與搬家 → 歷史備份」選擇快照一鍵還原（還原前會先為目前的資料留一份快照）。',
        { sub: '6.3 刪除所有本機與雲端資料' },
        {
          list: [
            '（建議）先按「匯出 JSON」留一份備份。',
            '若要一併刪除雲端資料，先用 Google 登入同步。',
            '到「設定 → 刪除所有資料」，按「刪除所有資料」並確認。',
            '本服務會刪除你 Drive 應用程式專用資料夾中的 ACACIA 檔案（acacia_data_v2.json、acacia_backup_v2.json、acacia_spaces_v1.json 與舊版 acacia_data.json），然後登出並撤銷授權，最後清除這台裝置上的所有資料、自動備份快照與偏好設定。刪除後無法復原。',
          ],
        },
        '你也可以從 Google 端刪除或撤銷：在 Google Drive 網頁版「設定 → 管理應用程式」找到 ACACIA，選「刪除隱藏的應用程式資料」；或到 Google 帳戶的「第三方應用程式與服務」（https://myaccount.google.com/connections）移除 ACACIA 的存取權。在其他裝置上的本機資料，需在該裝置上分別刪除，或清除瀏覽器的網站資料。',
        { sub: '6.4 撤回同意' },
        '你可以隨時登出 Google 停止同步，或在瀏覽器／系統設定中關閉 ACACIA 的位置與通知權限；關閉後相關功能會停止，其他功能不受影響。',
      ],
    },
    {
      id: 'children',
      heading: '7. 兒童隱私',
      blocks: ['本服務並非專為未滿 13 歲的兒童設計，我們也不會在知情的情況下收集兒童的個人資料。未成年人使用本服務前，應取得法定代理人的同意。'],
    },
    {
      id: 'changes',
      heading: '8. 政策修訂',
      blocks: ['我們可能因功能調整或法規變更修訂本政策。修訂後會更新本頁的「最後更新」日期；如有重大變更（例如資料用途或第三方服務改變），會在 App 內明顯處公告。繼續使用本服務即表示你同意修訂後的政策。'],
    },
    {
      id: 'contact',
      heading: '9. 聯絡我們',
      blocks: ['對本政策或你的資料有任何疑問、意見或請求，請來信：{email}。我們會盡快回覆。'],
    },
  ],
}

const ja: PolicyDoc = {
  title: 'プライバシーポリシー',
  eyebrow: 'あなたのデータは、あなたの手元に',
  dates: { effective: '施行日：', updated: '最終更新日：' },
  toc: '目次',
  summaryTitle: '要点',
  summary: [
    'アカウント登録なしですべての機能を使えます。データは初期状態ではこの端末のブラウザ（IndexedDB）にのみ保存されます。',
    'Google クラウド同期を有効にすると、データは「あなた自身の」Google ドライブのアプリ専用フォルダにのみ保存されます。私たちはデータを保存するサーバーやデータベースを持たず、あなたのデータを見ることもできません。',
    '位置情報は「忘れ物防止のリマインダー」の到着・出発の判定と、「お気に入りの場所」を距離順に並べるときの距離計算にのみ使い、端末上で計算します。私たちや第三者に送信されることはありません。',
    '広告、アクセス解析、トラッキングツールは一切使用せず、データの販売や共有も行いません。',
    'いつでも JSON で書き出し、自動バックアップから復元、または設定画面から端末とクラウドのデータをまとめて削除できます。',
  ],
  sections: [
    {
      id: 'scope',
      heading: '1. 適用範囲',
      blocks: [
        '本プライバシーポリシーは、ACACIA Everyday（以下「本サービス」または「ACACIA」）の開発・運営者（以下「私たち」）が、本サービスのご利用にあたりデータをどのように取り扱うかを説明するものです。Web 版（https://acaciaeveryday.pages.dev）および今後提供予定の iOS アプリに適用されます。',
        '私たちは台湾の「個人資料保護法」に従って個人データを取り扱い、EU 一般データ保護規則（GDPR）、Apple App Store 審査ガイドライン、Google API サービスのユーザーデータに関するポリシーの要件を参考に本ポリシーを作成しています。',
      ],
    },
    {
      id: 'collect',
      heading: '2. 取り扱うデータ',
      blocks: [
        { sub: '2.1 アカウント情報（Google ログインを選んだ場合のみ）' },
        'ログインは任意で、クラウド同期のためだけに使います。ログイン時、本サービスは Google OAuth を通じて次の権限を Google に求めます。',
        {
          list: [
            '基本プロフィール（userinfo.profile）：Google アカウントの名前とプロフィール画像の URL。ログイン中のアカウントを画面に表示するためだけに使います。ブラウザのメモリ上にのみ保持し、タブを閉じると消えます。データファイルに書き込まれることも、私たちに送信されることもありません。',
            'Google ドライブのアプリ専用フォルダ（drive.appdata）：ACACIA 自身が作成したファイルだけを読み書きでき、ドライブ内のほかのファイルは一切見られません。',
          ],
        },
        '本サービスがメールアドレス、連絡先、カレンダー、ドライブ内のほかのファイルを求めることはありません。ログインで得たアクセストークンはブラウザの sessionStorage に保存され、有効期間は最長約 1 時間です。タブを閉じるかログアウトすると削除され、ログアウト時には Google 側でもトークンを無効にします。',
        { sub: '2.2 位置情報（忘れ物防止のリマインダーを作成した場合、またはお気に入りの場所を距離順に並べる場合のみ）' },
        {
          list: [
            '「有効で座標がある」忘れ物防止のリマインダーを作成したとき、または「お気に入りの場所」で「距離」順を選んだときだけ、ブラウザ（または iOS）に位置情報の許可を求めます。どちらもなければ位置情報は使いません。',
            'Web 版では ACACIA を開いている間、ブラウザの位置情報で現在地を取得し、リマインダーの場所に到着・出発したかを判定します。判定はすべて端末上で行い、現在地が私たちや第三者に送信されることはなく、位置の履歴や移動経路も保存しません。',
            'リマインダーの設定で「現在地を使う」を押すと、その時点の座標がそのリマインダーの場所として保存されます。これはあなたが作成した内容（2.3）の一部として端末に保存され、同期を有効にしている場合はあなたの Google ドライブにも保存されます。',
            '「お気に入りの場所」で距離順を選ぶと、現在地を 1 回取得し、各場所までの距離を端末上でのみ計算します。この現在地は私たちや第三者に送信されず、保存もしません（再読み込みやページ移動で消えます）。次に開いたときは、すでに位置情報を許可している場合にのみ自動で再取得し、そうでなければ「現在地を使う」を押すまで待ちます。場所自体の座標はあなたが手入力するか、場所検索（第 4 節）の結果に座標が含まれている場合に一緒に入力され、あなたが作成した内容（2.3）になります。',
            '位置情報を広告、マーケティング、プロファイリング、追跡に使うことはありません。位置情報の許可はブラウザやシステムの設定でいつでも取り消せます。',
          ],
        },
        { sub: '2.3 あなたが作成した内容' },
        'ACACIA に入力した予定、タスク、家計簿と買い物リスト（アーカイブと固定費テンプレートを含む）、在庫と日用品、サブスクリプション、お気に入りの場所、忘れ物防止のリマインダー、カレンダーにインポートした祝日、および言語・文字サイズ・既定の通貨・祝日の国などの設定。これらは本サービスの機能を提供するためだけに使います。',
        { sub: '2.4 端末上の小さな設定' },
        '画面を開いてすぐに好みの設定を反映するため、言語、文字サイズ、最近の検索履歴をブラウザの localStorage に保存します。これらが端末の外に送られることはありません。',
        { sub: '2.5 通知' },
        '忘れ物防止のリマインダーはブラウザ（または iOS）のローカル通知を使えます。通知は端末が直接表示し、プッシュサーバーは経由しません。',
        { sub: '2.6 国・地域と祝日' },
        {
          list: [
            'カレンダーに祝日をインポートするとき、ブラウザが提供するタイムゾーンと言語の設定から、初期の国・地域を端末上で推定します（例：タイムゾーンが Asia/Tokyo なら日本）。これはプルダウンの初期値にすぎず、位置情報や位置情報の許可は使わず、推定結果を送信することもありません。',
            '選んだ国とインポートした祝日はあなたのデータ（2.3 参照）として、他の内容と同じく端末に保存され、自動バックアップに含まれ、同期をオンにしている場合はあなたの Google ドライブにも保存されます。カレンダーの「祝日」パネルから、国ごとにいつでも削除できます。',
            '祝日データはアプリに内蔵されており（出典は第 4 節）、インポートや再同期のときに祝日サービスへ接続したり、国・年などのデータを送信したりすることはありません。',
          ],
        },
        { sub: '2.7 取り扱わないデータ' },
        '本サービスは独自のアカウントシステムを持たず、利用状況の解析、クラッシュレポート、広告識別子（IDFA など）、端末のフィンガープリント、連絡先、写真、健康データを収集しません。',
      ],
    },
    {
      id: 'storage',
      heading: '3. 保存場所と通信の安全',
      blocks: [
        { sub: '3.1 まずあなたの端末に保存' },
        {
          list: [
            '主なデータはブラウザの IndexedDB（データベース名 acacia-next）に保存します。',
            '自動バックアップのスナップショットは別の IndexedDB データベース（acacia-backups）に、最新 7 件まで保存し、古いものは自動的に削除します。',
            '小さな設定は localStorage に、Google のアクセストークンは sessionStorage に保存します（2.1 参照）。',
          ],
        },
        { sub: '3.2 クラウド同期：あなた自身の Google ドライブにのみ保存' },
        'Google ログインで同期を有効にすると、データはあなた自身の Google ドライブの「アプリ専用フォルダ」（appDataFolder）にのみ書き込まれます。これは Google が各アプリに用意する非表示の領域で、ドライブの画面には表示されず、ほかのアプリからは読めません。容量はあなたのドライブの容量を使います。使用するファイルは次のとおりです。',
        {
          list: [
            'acacia_data_v2.json：同期用の全データ。',
            'acacia_backup_v2.json：最新の自動バックアップ 1 件（自動バックアップのたびに上書きされ、同期ファイルには影響しません）。',
            'acacia_spaces_v1.json：旧バージョンの共有カレンダーの同期ファイル。共有カレンダー機能は削除されたため、アプリはこのファイルを読み書きしません。ドライブに残っている場合は「すべてのデータを削除」で一緒に削除されます。',
            'acacia_data.json：旧版 ACACIA サイトの同期ファイル。初回ログイン時にデータ移行のため読み込みますが、変更はしません。',
          ],
        },
        { sub: '3.3 通信と暗号化' },
        {
          list: [
            'ブラウザと Google の間の通信はすべて HTTPS（TLS）で暗号化されます。データはあなたの端末と Google の間で直接やり取りされ、私たちのサーバーは経由しません。',
            'ACACIA 自体はデータを独自にエンドツーエンド暗号化していません。端末上のデータは JSON 形式でブラウザに保存され、OS とブラウザによって保護されます。クラウド上のファイルは Google のセキュリティ対策のもとであなたのドライブに保存されます。端末には画面ロックを設定し、共用のパソコンでは同期にログインしないことをおすすめします。',
          ],
        },
        { sub: '3.4 私たちはデータを保有しません' },
        '第 4 節の場所検索サービスが検索語を受け取ることを除き、私たちは個人データを保存するサーバーやデータベースを持たず、あなたのデータにアクセス、閲覧、分析することも、代わりに復元することもできません。JSON の書き出しと自動バックアップでデータを守ってください。',
      ],
    },
    {
      id: 'third-party',
      heading: '4. 第三者サービス',
      blocks: [
        '本サービスは必要なときにだけ次のサービスと通信します。各サービスはそれぞれのプライバシーポリシーに従ってデータを取り扱います。',
        {
          list: [
            'Google Identity Services（accounts.google.com）：「Google でログインして同期」を押したときだけ読み込み、ログインと認可に使います。',
            'Google OAuth ユーザー情報 API：ログイン後に名前とプロフィール画像を取得します（2.1 参照）。',
            'Google Drive API：ドライブのアプリ専用フォルダにある ACACIA のファイルを読み書きします（3.2 参照）。',
            '場所検索：お気に入りの場所を追加するときに検索を使うと、入力した検索語がブラウザからアプリに設定された場所検索サービス（Cloudflare Workers 上の bold-cloud-4bb3.s3311453038.workers.dev、旧版 ACACIA から引き継いだもの）に送られ、そこから Google Places API に場所の名前・住所・営業時間（サービスが返す場合は座標も）を問い合わせます。検索語を受け取るのは Cloudflare（Workers プラットフォーム）、この検索サービスの運営者、Google です。送られるのは検索語と一般的な接続情報（IP アドレスなど）だけで、位置情報やほかの ACACIA のデータは含みません。これらの事業者はそれぞれのポリシーに従ってデータを取り扱います。検索を使わず場所を手入力すれば何も送信されません。検索サービスが利用できない場合は検索が失敗しますが、手入力はできます',
            'Google Fonts（fonts.googleapis.com、fonts.gstatic.com）：Web ページがフォントを読み込む際、ブラウザが Google から直接フォントをダウンロードするため、Google は IP アドレスとブラウザ情報を受け取ります。',
            'Cloudflare Pages：Web 版のホスティングサービスです。一般的な Web サイトと同様に、Cloudflare がセキュリティと運用のために接続情報（IP アドレス、リクエスト時刻など）を記録する場合があります。',
            'Google マップ：場所の地図リンクをタップしたときだけ、新しいタブで Google マップを開きます。',
            '祝日データ：台湾は行政院人事行政総処「政府行政機関執務カレンダー」（政府オープンデータ）、中国は国務院弁公庁の通知（オープンソースプロジェクト holiday-cn による整理）、韓国は宇宙航空庁の暦要項（オープンソースプロジェクト holidays-kr による整理）、その他の国はオープンソースプロジェクト date-holidays が法定ルールから算出したものを使います。これらはサイトのビルド時にアプリへ組み込まれ、利用時に各出典へ接続しないため、データが送られることはありません。各出典のライセンスは「サードパーティライセンス一覧」に記載しています。',
          ],
        },
        'Google プライバシーポリシー：https://policies.google.com/privacy',
        'Cloudflare プライバシーポリシー：https://www.cloudflare.com/privacypolicy/',
        { sub: '広告とトラッキングは使いません' },
        '本サービスは広告を表示せず、第三者の広告トラッカー、アクセス解析ツール（Google アナリティクスなど）、アプリやサイトをまたぐトラッキングを一切使用しません。データを販売、貸与、共有することもありません。',
        { sub: 'App のプライバシー表示：データの収集なし' },
        'Apple App Store の「App のプライバシー」の定義に基づき、ACACIA は「データの収集なし（Data Not Collected）」として申告しています。私たちは独自のサーバーやデータベースを持たず、予定、ToDo、家計簿、場所、位置情報、連絡先、利用履歴、診断データを受け取ったり、保存したり、アクセスしたりしません。アプリにはトラッキング、広告、アクセス解析の SDK は一切含まれていません。データはあなたの端末と、同期をオンにした場合のあなた自身の Google ドライブのアプリ専用フォルダにだけ保存されます。上記の第三者サービスは、その場の操作（ログイン、ドライブの読み書き、場所の検索など）を完了するためだけに使われ、あなたを追跡したりプロフィールを作成したりすることはありません。',
        { sub: 'Google API の限定的使用に関する表明' },
        'ACACIA による Google API から受け取った情報の使用および転送は、限定的使用（Limited Use）の要件を含む Google API サービスのユーザーデータに関するポリシー（https://developers.google.com/terms/api-services-user-data-policy）に準拠します。Google から取得したデータは、アプリ内で同期とログイン中のアカウント表示の機能を提供するためだけに使い、広告には使わず、第三者への移転や人による閲覧も行いません。',
      ],
    },
    {
      id: 'retention',
      heading: '5. 保存期間',
      blocks: [
        {
          list: [
            '端末上のデータ：アプリ内で削除するか、「すべてのデータを削除」を使うか、ブラウザのサイトデータを消去するまで保存されます。',
            '自動バックアップ：端末上は最大 7 件で、超えると最も古いものを自動削除します。ドライブのバックアップ枠は最新の 1 件のみです。',
            'クラウド同期ファイル：削除するまであなたの Google ドライブに保存されます（第 6 節参照）。',
            'Google アクセストークン：最長約 1 時間。タブを閉じるかログアウトすると削除されます。',
            '最近削除した項目：削除した予定はまず 30 日間「最近削除した項目」に保存され、その間は復元できます。30 日を過ぎると自動的に完全に削除されます（アプリの起動時、同期時、「最近削除した項目」を開いたときに実行され、サーバーは使いません）。',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '6. あなたの権利とデータの管理',
      blocks: [
        '個人資料保護法および GDPR に基づき、あなたはデータの照会、閲覧、写しの取得、訂正、削除、処理の停止を求めることができます。データはあなた自身が管理しているため、ほとんどの権利はアプリ内で直接行使できます。',
        { sub: '6.1 閲覧と書き出し（データポータビリティ）' },
        '「設定 → データのバックアップと移行」で「JSON を書き出す」を押すと、全データの JSON ファイルをダウンロードでき、ACACIA やほかのツールに読み込めます。',
        '同じ場所から「カレンダーを書き出す（.ics）」で、マイカレンダーの予定を標準の iCalendar ファイルにして、Apple カレンダー、Google カレンダー、Outlook などに読み込めます。ファイルは端末上で作成され、サーバーを経由しません。',
        { sub: '6.2 訂正と復元' },
        'すべての内容はアプリ内で直接編集できます。誤って削除した場合は、「設定 → データのバックアップと移行 → バックアップ履歴」からスナップショットを選んでワンタップで復元できます（復元前に現在のデータのスナップショットを自動で作成します）。',
        { sub: '6.3 端末とクラウドのデータをすべて削除' },
        {
          list: [
            '（推奨）先に「JSON を書き出す」でバックアップを取ります。',
            'クラウドのデータも削除する場合は、先に Google でログインして同期します。',
            '「設定 → すべてのデータを削除」で「すべてのデータを削除」を押し、確認します。',
            '本サービスはドライブのアプリ専用フォルダにある ACACIA のファイル（acacia_data_v2.json、acacia_backup_v2.json、acacia_spaces_v1.json、旧版の acacia_data.json）を削除し、ログアウトして認可を取り消したうえで、この端末上のすべてのデータ、自動バックアップ、設定を消去します。削除後は元に戻せません。',
          ],
        },
        'Google 側から削除・取り消しすることもできます。Google ドライブ（Web）の「設定 → アプリの管理」で ACACIA を探し「非表示のアプリデータを削除」を選ぶか、Google アカウントの「サードパーティ製のアプリとサービス」（https://myaccount.google.com/connections）で ACACIA のアクセスを削除してください。ほかの端末にあるデータは、その端末でそれぞれ削除するか、ブラウザのサイトデータを消去してください。',
        { sub: '6.4 同意の撤回' },
        'いつでも Google からログアウトして同期を止めたり、ブラウザやシステムの設定で ACACIA の位置情報と通知の許可をオフにしたりできます。オフにすると該当する機能だけが停止し、ほかの機能には影響しません。',
      ],
    },
    {
      id: 'children',
      heading: '7. 子どものプライバシー',
      blocks: ['本サービスは 13 歳未満の子ども向けに設計されたものではなく、子どもの個人データを故意に収集することはありません。未成年の方は、法定代理人の同意を得たうえでご利用ください。'],
    },
    {
      id: 'changes',
      heading: '8. ポリシーの改定',
      blocks: ['機能の変更や法令の改正に伴い、本ポリシーを改定することがあります。改定時は本ページの「最終更新日」を更新し、重要な変更（データの利用目的や第三者サービスの変更など）はアプリ内のわかりやすい場所でお知らせします。改定後も本サービスを利用された場合、改定後のポリシーに同意したものとみなします。'],
    },
    {
      id: 'contact',
      heading: '9. お問い合わせ',
      blocks: ['本ポリシーやデータに関するご質問、ご意見、ご要望は {email} までご連絡ください。できるだけ早くお返事します。'],
    },
  ],
}

const en: PolicyDoc = {
  title: 'Privacy Policy',
  eyebrow: 'Your data stays with you',
  dates: { effective: 'Effective date: ', updated: 'Last updated: ' },
  toc: 'Contents',
  summaryTitle: 'At a glance',
  summary: [
    'You can use every feature without creating an account. By default, your data is stored only in this device’s browser (IndexedDB).',
    'If you turn on Google sync, your data is stored only in the app-specific folder of your own Google Drive. We run no server or database that holds your data, and we cannot see it.',
    'Location is used only to detect arriving at or leaving a place for “Don’t-forget reminders” and to calculate distances when you sort “Favorite places” by distance. It is processed on your device and never sent to us or any third party.',
    'No ads, no analytics, no trackers. We never sell or share your data.',
    'You can export JSON, restore from an automatic backup, or delete all local and cloud data from Settings at any time.',
  ],
  sections: [
    {
      id: 'scope',
      heading: '1. Scope',
      blocks: [
        'This Privacy Policy explains how the developer and operator of ACACIA Everyday (“ACACIA”, the “Service”, “we”) handles data when you use the Service. It applies to the web app (https://acaciaeveryday.pages.dev) and to the iOS app we plan to release.',
        'We process personal data in accordance with Taiwan’s Personal Data Protection Act, and this policy is written with reference to the EU General Data Protection Regulation (GDPR), the Apple App Store Review Guidelines and the Google API Services User Data Policy.',
      ],
    },
    {
      id: 'collect',
      heading: '2. Data we process',
      blocks: [
        { sub: '2.1 Account information (only if you choose to sign in with Google)' },
        'Signing in is optional and is used only for cloud sync. When you sign in, the Service asks Google, through Google OAuth, for the following permissions:',
        {
          list: [
            'Basic profile (userinfo.profile): your Google account name and profile picture URL, used only to show which account is signed in. They are kept in browser memory only and disappear when you close the tab. They are never written to your data file or sent to us.',
            'Google Drive app-specific folder (drive.appdata): ACACIA can read and write only the files it created itself and cannot see any other file in your Drive.',
          ],
        },
        'The Service does not ask for your email address, contacts, calendar or any other Drive files. The access token from sign-in is stored in the browser’s sessionStorage, is valid for about one hour at most, and is deleted when you close the tab or sign out. Signing out also revokes the token with Google.',
        { sub: '2.2 Location (only if you create Don’t-forget reminders or sort favorite places by distance)' },
        {
          list: [
            'The Service asks the browser (or iOS) for location permission only when you have at least one enabled reminder with coordinates, or when you choose to sort “Favorite places” by distance. Otherwise, location is never used.',
            'While ACACIA is open, the web app uses browser geolocation to get your precise location and check whether you have arrived at or left a reminder’s place. This check runs entirely on your device. Your live location is never sent to us or any third party, and no location history or movement trail is stored.',
            'When you tap “Use current location” while setting up a reminder, the coordinates at that moment are saved as that reminder’s place. They become part of your content (see 2.3), stored on your device and, if sync is on, in your Google Drive.',
            'When you sort “Favorite places” by distance, your current location is read once and used only on your device to calculate the distance to each place. It is never sent to us or any third party and is not saved (it is gone when you reload or leave the page). Next time, it is fetched again automatically only if you have already granted location permission; otherwise the app waits until you tap “Use current location”. A place’s own coordinates are typed in by you, or filled in when a place-search result includes them (see Section 4), and become part of your content (see 2.3).',
            'Location is never used for advertising, marketing, profiling or tracking. You can withdraw location permission at any time in your browser or system settings.',
          ],
        },
        { sub: '2.3 Content you create' },
        'Events, tasks, expenses and shopping lists (including archives and recurring templates), inventory items, subscriptions, favorite places, Don’t-forget reminders, public holidays you import into the calendar, and settings such as language, text size, default currency and the holiday country. This content is used only to provide the Service’s features.',
        { sub: '2.4 Small preferences on your device' },
        'So that your preferences apply as soon as the app opens, your language, text size and recent searches are stored in the browser’s localStorage. They never leave your device.',
        { sub: '2.5 Notifications' },
        'Don’t-forget reminders can use local browser (or iOS) notifications. They are shown directly by your device and do not go through any push server.',
        { sub: '2.6 Country / region and public holidays' },
        {
          list: [
            'When you import public holidays into the calendar, the app guesses a default country or region on your device from the time zone and language your browser reports (for example, Asia/Tokyo suggests Japan). This is only the default choice in the drop-down: it does not use geolocation or ask for location permission, and the guess is never sent anywhere.',
            'The country you choose and the holidays you import are saved as part of your data (see 2.3): stored on your device like your other content, included in automatic backups, and saved to your Google Drive when sync is on. You can clear a country’s holidays at any time from the calendar’s “Public holidays” panel.',
            'Holiday data is built into the app (sources in Section 4). Importing or re-syncing never connects to a holiday service and never sends your country, years or any other data.',
          ],
        },
        { sub: '2.7 Data we do not process' },
        'The Service has no account system of its own and does not collect usage analytics, crash reports, advertising identifiers (such as IDFA), device fingerprints, contacts, photos or health data.',
      ],
    },
    {
      id: 'storage',
      heading: '3. Where data is stored and how it is protected',
      blocks: [
        { sub: '3.1 Stored on your device first' },
        {
          list: [
            'Your main data is stored in the browser’s IndexedDB (database name acacia-next).',
            'Automatic backup snapshots are stored in a separate IndexedDB database (acacia-backups). Up to the 7 most recent are kept; older ones are deleted automatically.',
            'Small preferences are stored in localStorage, and the Google access token in sessionStorage (see 2.1).',
          ],
        },
        { sub: '3.2 Cloud sync: only in your own Google Drive' },
        'When you turn on sync with Google sign-in, data is written only to the app-specific folder (appDataFolder) of your own Google Drive. This is a hidden space Google gives each app; it does not appear in the Drive interface, other apps cannot read it, and it counts toward your own Drive storage. The files used are:',
        {
          list: [
            'acacia_data_v2.json: your full data for sync.',
            'acacia_backup_v2.json: the latest automatic backup (overwritten on each automatic backup; it does not affect the sync file).',
            'acacia_spaces_v1.json: the sync file of the former shared calendar feature. Shared calendars have been removed and the app no longer reads or writes this file; if it is still in your Drive, it is deleted along with everything else when you use “Delete all data”.',
            'acacia_data.json: the sync file of the previous ACACIA website. The Service reads it once on first sign-in to migrate your data but never modifies it.',
          ],
        },
        { sub: '3.3 Transmission and encryption' },
        {
          list: [
            'All connections between your browser and Google use HTTPS (TLS) encryption. Data travels directly between your device and Google, never through our servers.',
            'ACACIA itself does not add end-to-end encryption. Local data is stored as JSON in your browser, protected by your operating system and browser; cloud files are stored in your Drive under Google’s security measures. We recommend using a screen lock and not signing in to sync on shared computers.',
          ],
        },
        { sub: '3.4 We do not hold your data' },
        'Apart from the place-search service in Section 4, which receives your search text, we operate no server or database that stores your personal data. We cannot access, view, analyze or recover your data for you, so please use JSON export and automatic backups to protect it.',
      ],
    },
    {
      id: 'third-party',
      heading: '4. Third-party services',
      blocks: [
        'The Service connects to the following services only when needed. Each handles data under its own privacy policy:',
        {
          list: [
            'Google Identity Services (accounts.google.com): loaded only when you tap “Sign in with Google to sync”, for sign-in and authorization.',
            'Google OAuth userinfo API: fetches your name and profile picture after sign-in (see 2.1).',
            'Google Drive API: reads and writes ACACIA’s files in your Drive’s app-specific folder (see 3.2).',
            'Place search: when you search while adding a favorite place, your search text is sent from your browser to the place-search service configured in the app (bold-cloud-4bb3.s3311453038.workers.dev on Cloudflare Workers, carried over from the previous ACACIA), which queries the Google Places API for place names, addresses and opening hours (and coordinates, when the service returns them). The parties that receive your search text are Cloudflare (the Workers platform), the operator of that search service, and Google. Only the search text and ordinary connection data (such as your IP address) are sent — not your location or any other ACACIA data — and these parties handle it under their own policies. If you type a place in manually instead of searching, nothing is sent; if the search service is unavailable, search fails but manual entry still works',
            'Google Fonts (fonts.googleapis.com, fonts.gstatic.com): when the web app loads its fonts, your browser downloads them directly from Google, so Google receives your IP address and browser information.',
            'Cloudflare Pages: hosts the web app. Like any website host, Cloudflare may log connection information (such as IP address and request time) for security and operations.',
            'Google Maps: opened in a new tab only when you tap a place’s map link.',
            'Public holiday data: Taiwan uses the Government Office Calendar published by the Directorate-General of Personnel Administration, Executive Yuan (Government Open Data Platform); China uses State Council notices (compiled by the open-source project holiday-cn); Korea uses the Korea AeroSpace Administration almanac (compiled by the open-source project holidays-kr); other countries use the open-source project date-holidays, calculated from statutory rules. This data is bundled into the app when the site is built, and the app never connects to these sources while you use it, so no data is sent to them. Their licenses are listed under Third-party licenses.',
          ],
        },
        'Google Privacy Policy: https://policies.google.com/privacy',
        'Cloudflare Privacy Policy: https://www.cloudflare.com/privacypolicy/',
        { sub: 'No ads or tracking' },
        'The Service shows no ads and uses no third-party ad trackers, analytics tools (such as Google Analytics) or cross-app / cross-site tracking. We never sell, rent or share your data with anyone.',
        { sub: 'App privacy label: Data Not Collected' },
        'Under the Apple App Store “App Privacy” definitions, ACACIA declares “Data Not Collected”: we have no servers or databases of our own and do not receive, store or access your events, tasks, expenses, places, location, contact info, usage data or diagnostics. The app contains no tracking, advertising or analytics SDKs. Your data lives only on your device and, if you turn on sync, in the app-specific folder of your own Google Drive. The third-party services listed above are used only to complete what you are doing at that moment (such as signing in, reading and writing your Drive, or searching for a place), never to track you or build a profile of you.',
        { sub: 'Google API Limited Use disclosure' },
        'ACACIA’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Data obtained from Google is used only to provide sync and to show the signed-in account within the app; it is not used for advertising, transferred to third parties or read by humans.',
      ],
    },
    {
      id: 'retention',
      heading: '5. Retention',
      blocks: [
        {
          list: [
            'Local data: kept until you delete it in the app, use “Delete all data”, or clear the browser’s site data.',
            'Automatic backups: up to 7 on your device, with the oldest removed automatically; the Drive backup slot keeps only the latest one.',
            'Cloud sync files: kept in your Google Drive until you delete them (see Section 6).',
            'Google access token: about one hour at most; deleted when you close the tab or sign out.',
            'Recently deleted: deleted events stay in “Recently deleted” for 30 days and can be restored during that time; after 30 days they are permanently deleted automatically (when the app starts, syncs or opens “Recently deleted”, with no server involved).',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '6. Your rights and controls',
      blocks: [
        'Under the Personal Data Protection Act and the GDPR, you may request access to, a copy of, correction or deletion of your data, or ask us to stop processing it. Because you keep your own data, you can exercise most of these rights directly in the app:',
        { sub: '6.1 Access and export (data portability)' },
        'Go to “Settings → Backup and moving data” and tap “Export JSON” to download all your data as a JSON file, which can be imported into ACACIA or other tools.',
        'In the same place, “Export calendar (.ics)” saves your calendar events as a standard iCalendar file you can import into Apple Calendar, Google Calendar, Outlook and other apps. Files are created on your device and never pass through a server.',
        { sub: '6.2 Correction and restore' },
        'You can edit everything directly in the app. If you delete something by mistake, choose a snapshot under “Settings → Backup and moving data → Backup history” and restore it in one tap (a snapshot of your current data is saved first).',
        { sub: '6.3 Delete all local and cloud data' },
        {
          list: [
            '(Recommended) Tap “Export JSON” first to keep a copy.',
            'To delete cloud data too, sign in with Google first.',
            'Go to “Settings → Delete all data”, tap “Delete all data” and confirm.',
            'The Service deletes ACACIA’s files from your Drive’s app-specific folder (acacia_data_v2.json, acacia_backup_v2.json, acacia_spaces_v1.json and the old acacia_data.json), signs you out and revokes access, then erases all data, automatic backups and preferences on this device. This cannot be undone.',
          ],
        },
        'You can also delete or revoke from Google’s side: in Google Drive on the web, open “Settings → Manage apps”, find ACACIA and choose “Delete hidden app data”; or remove ACACIA’s access under “Third-party apps & services” in your Google Account (https://myaccount.google.com/connections). Local data on other devices must be deleted on each device, or by clearing that browser’s site data.',
        { sub: '6.4 Withdrawing consent' },
        'You can sign out of Google at any time to stop syncing, or turn off ACACIA’s location and notification permissions in your browser or system settings. Only the related features stop; everything else keeps working.',
      ],
    },
    {
      id: 'children',
      heading: '7. Children’s privacy',
      blocks: ['The Service is not designed for children under 13, and we do not knowingly collect personal data from children. Minors should use the Service with the consent of a parent or legal guardian.'],
    },
    {
      id: 'changes',
      heading: '8. Changes to this policy',
      blocks: ['We may update this policy when features or laws change. We will update the “Last updated” date on this page, and announce material changes (such as new data uses or third-party services) prominently in the app. Continuing to use the Service means you accept the updated policy.'],
    },
    {
      id: 'contact',
      heading: '9. Contact us',
      blocks: ['If you have any questions, comments or requests about this policy or your data, please email {email}. We will reply as soon as we can.'],
    },
  ],
}

export const POLICIES: Record<PolicyLang, PolicyDoc> = { 'zh-TW': zhTW, ja, en }

/**
 * 依介面語言取隱私權政策。政策正文只有繁中／日文／英文三個版本（PRIVACY_VERSION 綁定這三份內容）；
 * 韓文、法文、德文等其他介面語言顯示英文版，繁體中文仍是預設。只改顯示哪一份，不改內容，所以不會觸發重簽。
 */
export const policyFor = (lng: string | undefined): PolicyDoc => {
  if (lng === 'ja' || lng === 'en') return POLICIES[lng]
  if (lng === 'ko' || lng === 'fr' || lng === 'de') return POLICIES.en
  return POLICIES['zh-TW']
}

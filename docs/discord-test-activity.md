# 獨立 Discord 測試活動

本入口專供兩款遊戲的 Discord 測試，不更新正式 App、正式 Worker、正式 Firestore 或既有 SQLite 測試帳本。產品版本 1.0.3，老虎機停輪與兩秒開轉冷卻沿用已驗收基準。

## 手機安全區對齊（2026-11-06）

- 野球拳畫布改用與老虎機相同的 Discord／裝置安全區，依可用尺寸重新排版；測試外框同步安全區變動，涵蓋沒有 resize 事件的更新與跨遊戲返回。選角、牌桌及視窗均位於畫布的可用範圍。
- 隔離瀏覽器檢查手機直橫向、四邊非零安全區、移除安全區與晚到更新，並直接比對兩款遊戲的簽到及工具列座標。本機 browser CI **12/12 步通過**（一般回歸 596 通過、1 項既有條件略過），報告為 `test-results/mobile-safe-area-browser-verification.json`、`mobile-safe-area-ui-report.json`。完整 CI 前次執行的後端整合 80 通過、2 項條件略過，監控 2 通過；當時瀏覽器缺失的失敗記錄保留於 `mobile-safe-area-ci-before-browser.json`，補齊鎖定的 Chromium 後才重跑 browser 組。遠端 CI 未執行。
- 依使用者要求發布至既有測試 App `1567875182792544256`，專用 Worker 版本 `1c020da6-3335-45dc-8560-054bda9118d0`；保留原變數、Secrets 與資料。公開健康檢查、未登入 API 拒絕及 32 份線上 HTML／JS／CSS 位元組比對通過，證據為 `test-results/mobile-safe-area-test-deploy.log`、`mobile-safe-area-public-check.json`。真正手機 Discord 的效果仍待使用者驗收。
- 此次只修改排版，入場預決定勝負與縮短出牌等待仍為討論方案；既有抽拳、派彩、老虎機計時與產品版本不變。未 commit、merge 或 push。

## 1.0.3 與 main 合併（2026-11-06）

使用者要求保留 `add-function` 的全部改動並合併到 `main`；野球拳、CG、獨立開場與雙遊戲測試功能完整保留。正式建置另以模組圖與產物檢查排除這些測試內容，正式服不提供野球拳入口、程式或 CG。專用測試 Worker 更新為 `c1540525-e449-4bb8-909f-695bfb22d703`，沿用下表測試 App、DO、Firestore 與原 Secrets，沒有更換資料來源或重新 seed。根頁、老虎機、大廳、CG 下載頁及原圖與本機測試產物逐檔雜湊一致，正式／測試 DO 不共用；完整本機 CI 16/16 通過。證據位於 `test-results/release-1.0.3/`，遠端 CI 另依最終提交核對。

## 大廳前的獨立開場讀取（2026-11-06）

- 使用者確認的三張圖為 `review-v2/background-01-golden-salon.png`、`review-v6/background-02-last-spin.png`、`review-v8/background-03-curtain-rises.png`（均位於 `art/launch-screen/`）。`python scripts/assets/prepare-launch-art.py` 將它們轉成 `images/launch/` 的無損 WebP，逐張比對解碼後 RGBA 完全一致，來源／輸出雜湊見 `art/launch-screen/approved-assets.json`；原畫不覆寫、不裁切或重新繪製。
- 每個新的 Discord 外框文件只隨機選一次，且只下載選中的一張。縮放、遊戲切換與內頁重新載入都不重新選圖；關閉活動後再開則重新選擇。桌機保留整張寬版構圖，較窄手機以各圖的人物位置居中裁切，底部字樣固定在深色留白內，支援 Discord／裝置安全區。
- 字樣依審稿實作為即時金色襯線 `LOADING...`；文字外框固定，字母與三個點依序輕彈成波紋，後方金色與淡紫色細光波持續循環，不使用讀條、百分比或隨機進度。背景準備完成後給予短暫閱讀時間；減少動態效果時文字、光波與淡出均改靜態。切到背景時暫停文字與光波。
- 獨立讀取層先於 SDK 載入，涵蓋 Discord 登入、錢包讀取與 Pixi 大廳準備。內頁實際繪製大廳後才發送不含憑證的同來源就緒事件；外框核對來源及真正內頁 window 後淡出，再解除內頁的輸入／無障礙鎖定。正常切換遊戲不再出現此層，各遊戲原有載入與停輪體驗維持。
- 背景圖失敗或逾時使用原深色底繼續，避免裝飾圖片阻擋已就緒的大廳；登入／大廳失敗則保留遮罩並提示關閉活動後重新開啟，不在原活動內建立第二次 SDK 握手。外框關閉時取消等待與事件，沒有新增結算、扣款、簽到或 Firestore 輪詢。
- `discord-test-activity.js` 納入三圖×五尺寸、文字固定／光波移動、只載入一張、登入成功但大廳未就緒、錯誤 window 的就緒事件、減少動態、登入失敗、新活動恢復及圖片故障降級。專項結果在 `test-results/launch-screen-sdk-final.log`、`test-results/discord-test-activity/report.json` 與 `launch-*.png`；正式建置不含隔離測試入口。
- 審稿原圖另以明確清單及 SHA-256 記錄在 `art/launch-screen/review-sources.json`，只允許已登記的離線設計稿保留 PNG；未登記稿件、新增遊戲 PNG 與缺失原圖仍會被反向測試拒絕。已建置前端另檢查 `assets/` 不得出現 PNG，三張 WebP 的實際位元組須與已驗證來源清單相同。這項檢查區分原畫保存與實際發布，沒有把審稿檔帶進遊戲。
- 初次完整本機 CI 15/16 項通過，唯一失敗為舊素材盤點尚未區分上述離線審稿原圖；其餘含停輪、安全、Discord、Firestore SDK／REST／workerd／恢復及監控均通過。修正盤點契約並增加未登記稿件／缺失原圖／發布資產反向檢查後，最終 `npm run verify:ci -- --suite=browser` 12/12 項全數通過（一般回歸 567 項通過、1 項既有條件略過）。保存初次結果 `test-results/launch-screen-verify-ci.log`、`launch-screen-initial-verification.json` 與最終結果 `launch-screen-browser-ci.log`、`launch-screen-browser-verification.json`。啟動與雙遊戲報告快照為 `launch-screen-ui-report.json`；未執行遠端 CI。
- 已更新專用測試 Worker，版本 ID `b3f8996d-ccc3-490e-9d16-95f49d43331f`。部署初期 Cloudflare 管理 API 回傳 504／503；保留失敗日誌，服務恢復後以同一專用設定直接發布程式／素材，沿用既有密鑰（Wrangler 保留 secret bindings），未修改部署工具或正式環境。最終健康檢查、公開頁面、安全標頭、未登入錢包拒絕，以及根頁／動畫 JS／CSS／三張 WebP／大廳入口的線上位元組比對均通過。證據為 `test-results/launch-screen-deploy-final.log`、`launch-screen-public-final.log`、`launch-screen-deploy-report.json`、`launch-screen-deployment.json`；產品版本維持 1.0.2，commit／merge／push 由使用者處理。
- 本機純美術動畫預覽：`node scripts/game/launch-preview.js`，入口 `http://127.0.0.1:4205/`，可用 `?art=1`、`?art=2`、`?art=3` 固定看各張；不啟動 SDK、遊戲或錢包。已驗證三圖動畫與私密檔案拒絕，報告為 `test-results/launch-preview-report.json`。這個工具不進入發布建置。

### LOADING 逐字波紋（2026-11-06）

- 依使用者後續要求，將七個字母與三個點各自以合成器 transform 做小幅上浮、輕微回彈，逐字間隔 75ms，整輪 1.8 秒。幅度依字級縮放，字型金色漸層、整句排版外框、三張隨機背景與大廳交接方式不變；減少動態與背景暫停同時涵蓋文字和後方光波。
- 瀏覽器直接取樣實際 CSS 動畫：依動畫階段定位並量測十個字元的波峰，確認峰值由 L 到第三點依序前進、每字都有可見小幅上浮、整句不位移。三圖×五尺寸另檢查移動後的字元邊界仍在畫面與深色區內，並保留 SDK、故障降級與雙遊戲回歸。專項日誌為 `test-results/launch-letter-ripple-ui.log`。
- 本機 `npm run verify:ci -- --suite=browser` **12/12 步通過**（一般回歸 567 項通過、1 項既有條件略過），結果為 `test-results/launch-letter-ripple-browser-ci.log`、`launch-letter-ripple-browser-verification.json`、`launch-letter-ripple-ui-report.json`；純美術預覽三圖動畫另通過。此次只調整文字呈現，未重跑後端服務整合，遠端 CI 未執行。
- 已發布至既有專用測試 Worker，版本 `3069f6ac-9260-4244-bc2f-13fc4641d3ee`，沿用既有密鑰。公開頁面／CSP／未登入 API 保護及線上根頁、動畫 CSS／JS、三張背景與大廳入口的逐檔位元組比對通過；證據為 `test-results/launch-letter-ripple-deploy.log`、`launch-letter-ripple-public.log`、`launch-letter-ripple-deploy-report.json`、`launch-letter-ripple-deployment.json`。產品版本維持 1.0.2，未 commit、merge 或 push。

## 固定環境邊界

| 設定 | 值 |
| --- | --- |
| 測試 App | Joker’s Circus · Test |
| App ID | `1567875182792544256` |
| 測試伺服器 | `760012177326997544` |
| 指定啟動頻道 | `1564243344857632818` |
| Worker | `jokers-circus-yakyuken-test` |
| 公開測試來源 | `https://jokers-circus-yakyuken-test.nini900219.workers.dev` |
| Firestore 專案 | `slot-game-203db` |
| Firestore namespace | `yakyuken-playtest-20261105-test` |

現有正式／舊測試設定共用的 App `1561284960986599626` 不得交給新測試部署工具；工具與雲端執行器均明確拒絕該 App ID。正式 App 的 URL Mapping 不修改。

## Portal 與部署

新測試 App 已在 Codex 內建瀏覽器建立。名稱中的 Discord 一詞會被平台拒絕，因此使用上表名稱。已保存 OAuth Redirect `https://127.0.0.1`、根映射 `/` 至專用 Worker、Activity 啟用、網頁／iOS／Android 與手機直向設定。

私有 App 設定保存在忽略版控的 `.tools/discord-test-app.json`，包含 `purpose: "discord-test"`、`clientId`、`clientSecret`、`publicKey`、固定 `guildId`／`channelId` 及可選 `testerIds`。Client Secret 不放入 Vite 環境變數、網頁、網址、聊天或報告。需要用內建瀏覽器保存時，可啟動只限本機的 `node scripts/game/discord-test-configure.js`；表單只寫入上述本機檔案。

```sh
node scripts/game/discord-test.js build
node scripts/game/discord-test.js deploy
node scripts/game/discord-test.js configure-entry
node scripts/game/discord-test.js check
```

建置輸出為 `test-results/discord-test-dist`；部署設定為忽略版控的 `wrangler.discord-test.local.jsonc`。建立多入口的測試建置，不覆蓋正式 `dist`；新流程接管後，舊 `yakyuken-test-deploy.js` 會拒絕部署，以免移除 Discord 的前端與登入設定。前端、後端、加密會話與原測試玩家 DO 均在同一專用 Worker，保留既有測試資料。

根路徑 `/` 載入保留 Discord SDK 的測試外框，內部 `/yakyuken-preview.html` 顯示大廳、`/slot/` 顯示原有老虎機；HTML 自動轉址關閉，由 Worker 明確映射，避免 `/index.html` 被導回大廳。HTML 使用既有 Discord iframe CSP，手機音樂沿用原 Range 適配器。

Portal 的 Interactions Endpoint 已保存為該來源的 `/api/interactions`，通過 Discord PING；條款／隱私網址已保存為 `/terms.html` 與 `/privacy.html`。`configure-entry` 已將新 App 唯一的 Activity 入口設為 APP_HANDLER（handler 1）；使用者啟動時回應 `type:12`，不自動張貼邀請。測試 App 已以單一 `applications.commands` scope 安裝至小丑俱樂部，沒有新增機器人權限或發送邀請訊息。其他測試員尚未邀請，須取得實際帳號後再加入 Portal 測試員名單。

2026-11-05 最終短期會話恢復版本為 `ddc863d0-233b-4e29-a40a-05d4d6123d35`。公開頁面與未登入 API 保護檢查通過；部署、公開檢查及安靜入口證據保存在 `test-results/discord-test-deployment.json`、`test-results/discord-test-deploy-session.log`、`test-results/discord-test-public-check.log`、`test-results/discord-test-quiet-entry.log`。臨時密鑰設定服務在保存完成後已關閉。

## 身分、權限與錢包

- 啟動互動先驗證新 App 的 Ed25519 簽章、App ID、伺服器及頻道。錯誤範圍只回覆觸發者的私人提示；不產生公開推播。
- OAuth 使用 `identify` 與 `guilds.members.read`。後端向 Discord 驗證使用者與伺服器成員資格，並要求先從指定頻道取得有效的簽章啟動紀錄；網址上的 `channel_id` 不能取代此檢查。
- 會話最長一小時，保存在加密 Durable Object SQL；每次授權有持久請求限制，定期重新檢查成員資格。可用 `testerIds` 進一步限定 Discord 使用者；Portal 的 App 測試員名單也須允許對方使用未驗證活動。
- 同一次活動的短期錢包會話暫存於該分頁的 sessionStorage，鍵包含測試 App、frame 與 instance；不保存 Discord OAuth access token。跨文件切換或重載時，先向 `/api/session` 重新驗證伺服器身分，不重新握手 SDK。身分不符會停止並清除暫存，過期會要求關閉活動後重新啟動；未確認遊戲操作仍保留原 ID。這項驗證使用 Auth DO，不讀寫 Firestore。
- 玩家鍵固定由後端產生 `d_<guildId>_<userId>`。Discord 入口禁止指定 `player` 查詢參數；只有本機閘道持有的私有權杖可使用合成 `qa-*` 帳號。
- 同一玩家的兩款遊戲共用測試餘額、同一份每日／七日簽到與權威 revision。野球拳、老虎機紀錄分開顯示，扣發款、最新紀錄及去重憑證在同一玩家文件交易完成。
- 野球拳入場扣 1,000，通關發 2,500；暖機後平手不讀寫 Firestore、不累計平手數。老虎機沿用原條帶、算獎、下注額與兩秒冷卻，結果只由伺服器產生。
- 切換遊戲保留 `frame_id`、`instance_id`、`platform`、`guild_id`、`channel_id`、`location_id`、`discord_shim` 及手機版本等必要啟動資訊，會話、OAuth token 與 proxy ticket 不複製至切換網址。真正 Discord 網頁測試發現，跨文件重新握手 SDK 會逾時，單純補齊 URL 參數仍無法解決；最終改用上述伺服器驗證的短期會話恢復。桌機／手機瀏覽器外框刻意拒絕第二次握手，防止這類回歸。簽到跨遊戲只領一次；未確認請求保留原 ID，不重新扣款或重抽結果。
- 此 Worker 沒有 Discord 公告／維運推播工作，也沒有免費額度 80% 通知或持續 Firestore 輪詢。

## 驗證分層

1. `tests/discord-test.test.js`：拒絕正式 App、啟動參數白名單、共用餘額／簽到、原老虎機冷卻及客戶端同身分重授權。
2. `tests/discord-test.integration.js`：官方 emulator 與真正 workerd，驗證簽章／頻道、OAuth、跨玩家隔離、兩款遊戲、持久會話及重啟；所有外部 Discord 回應皆是隔離 fixture，不傳送真實訊息。
3. `scripts/qa/discord-test-activity.js`：已建置前端與真正 Embedded App SDK，透過模擬 Discord RPC 外框，在桌機與手機觸控跑完整大廳／野球拳／老虎機、CG 下載、共用簽到與重載。前端受原有 CSP 約束；這項自動檢查不冒充真實 Discord 客戶端驗收。
4. `npm run verify:ci`：目前共 16 步，包含上述瀏覽器檢查、野球拳領獎順序與新後端整合，保留全部停輪、慢幀、安全與恢復檢查。CI services 不啟動瀏覽器；SDK 雙遊戲檢查由 browser 組執行。
5. 部署後實際核對公開頁面、未登入 API 401、Portal 設定與安靜入口；再由真正 Discord 桌機／手機及實際測試帳號確認使用體驗。真人／實機結果與上述隔離檢查分開記錄。

測試證據位於 `test-results/discord-test-*`。Portal 憑證、加密金鑰、OAuth token、資料庫與實際玩家資料不得加入 CI 附件或版控。

## 測試服共用管理指令（2026-11-06）

`DISCORD_TEST_COMMANDS_ENABLED=true` 後，既有測試 App 提供與正式服共用的 `/戲籌`、`/戲籌管理`、原生表單、紀錄分頁與重設確認卡。以 `node scripts/game/discord-test.js register-commands` 註冊，只使用測試 App 的 client credentials 與指定測試群；保留 Activity Launch，不安裝 Bot、不建立或要求 Bot Token、不發送公開通知。測試發放表單省略公開通知選項，竄改提交通知選項也會拒絕。

所有指令與元件重新驗證簽章、App、測試群 `760012177326997544`、頻道 `1564243344857632818`、面板開啟者及管理權限。預設只有 Discord 管理員可操作；可另設定 `DISCORD_TEST_ADMIN_ROLE_IDS`。資料與雲端固定為既有專用測試 Worker、`slot-game-203db`、`yakyuken-playtest-20261105-test`，不使用正式 App、正式 DO 或正式資料庫。表單原請求也綁定操作、目標、金額及原因，不能以同一表單改發給第二位玩家。

發放與收回經原玩家 DO 依序操作同一份測試錢包，兩款遊戲立即共用餘額。正常玩法、持久去重與未知提交恢復沿用原機制。開啟面板／表單不查 Firestore，重複管理操作使用原結果；沒有新服務、輪詢、推播或排程。必要的實際結算與查帳仍會計入既有 Cloudflare／Firestore 用量，不能宣稱零用量：啟用後成功改變測試錢包的交易增加同一測試命名空間內的計數器與一份查帳紀錄，發放另更新每日額度，收回另標記原發放；暖機後平手和重播遊戲憑證仍不讀寫 Firestore。

新查帳資料存於 `testAdminLedger`（單欄索引）、`testAdminMeta`、`testAdminDays`；從功能啟用後開始記錄，不批次改寫舊遊玩。原有遊玩紀錄、收藏與簽到狀態保留。歷史每頁 10 筆；單次摘要最多 1,000 筆，超出明確提示縮短期間，不回傳不完整的總計。

全群重設只涵蓋本測試群既有 Discord 玩家錢包，合成 `qa-*` 玩家不在其中。先以既有 Auth DO 保存意圖、逐一凍結玩家 DO 並完成未確認操作，再以單筆 Firestore 交易更新全部錢包、重設帳本與一份結果憑證；成功後清除快取及解凍。中斷或未知提交時，後續授權先用原意圖恢復；不允許遊玩穿插到半完成的重設。每次最多 100 份錢包，保留簽到／遊玩／收藏／舊去重憑證；超出整筆拒絕，不略過玩家。結果位於 `testAdminOperations`，與正式帳本集合完全分離。

本次部署採本機建置及直接 Wrangler 部署，不推送 Git、不合併 main、不呼叫 Netlify 部署。既有網站流量及供應商正常用量仍依其方案計算。

本次本機 `verify:ci` 完成 16/16 步：一般回歸 596 通過、1 個既有條件略過；Firestore／workerd 整合 80 通過、2 個既有條件略過；監控 2 通過。沒有新增略過、延長 CI 逾時或調整停輪。日誌與完整報告為 `test-results/branch-commands-verify-ci.log`、`test-results/branch-commands-verification.json`。遠端 CI 未觸發，避免 Git push 連帶觸發 Netlify。

正式 Worker 版本 `fdae6a33-2e1d-490f-95b7-9cee20bcb6dc`，測試 Worker 版本 `e4470c47-3700-406e-a80d-cbddae35e1fe`；產品版本仍為 1.0.3。部署後唯讀核對正式群／資料庫／DO／監控設定未變、正式桌機／手機頁面就緒、9 個測試入口 404，測試 Worker 綁定只增加指令啟用旗標。測試群的兩個 slash 根指令及原 APP_HANDLER Launch 已透過 Discord API 核對，未安裝 Bot、未重設或保存 Bot Token。證據位於 `test-results/branch-commands-release/`，部署日誌為 `test-results/branch-commands-production-deploy.log`、`test-results/branch-commands-test-deploy.log`、`test-results/branch-commands-test-registration.log`。

Netlify 最近部署仍為 `6aedbb42fa418ba844b992a1`，開始與結束時的五筆清單完全相同，沒有進行中的部署。修改留在 `modify` 工作分支，未 commit、push 或合併 main。正式服驗證沒有發放／扣除真實玩家戲籌或發送測試公告；實際金融操作與通知清理由隔離測試覆蓋，不能冒充真人 Discord 點擊驗收。

2026-11-05 本機 `verify:ci` 全部 15/15 步通過，一般回歸 549 項通過、1 項既有條件略過；結果與日誌為 `test-results/discord-test-verification.json`、`test-results/discord-test-verify-ci.log`。獨立 runtime 補驗 2 項通過；桌機與手機觸控的實際 SDK／已建置前端檢查皆通過，證據為 `test-results/discord-test-runtime.log`、`test-results/discord-test-activity/report.json` 及同目錄截圖。新瀏覽器檢查第一輪使用錯誤的簽到選擇器，修正為實際 `daily-checkin` 控制後通過，原始失敗另保留。這些是本機及隔離平台結果，未冒充遠端 CI 或真人 Discord 手機結果。

跨頁連線修正後再次完整執行 `verify:ci`，15/15 步通過；結果與日誌為 `test-results/discord-test-verification-navigation.json`、`test-results/discord-test-verify-ci-navigation.log`。正式停輪與兩秒冷卻參數沒有調整。

最終短期會話恢復版本另一次完整 `verify:ci` 為 15/15 步通過；結果與日誌為 `test-results/discord-test-verification-session.json`、`test-results/discord-test-verify-ci-session.log`。新增測試包含無效／跨來源／錯誤方法會話查詢、後端重啟恢復、無 Firestore 讀取、前端身分竄改／過期拒絕與只握手一次的雙遊戲往返。

## 前次實際 Discord 網頁驗收與待辦（修正前）

在指定頻道的真正 Discord 網頁中，已確認 App 啟動器、簽章啟動、OAuth、測試身分、野球拳入場／勝敗／平手、遊玩紀錄及每日簽到。首場紀錄為 1 勝 2 敗、戲籌變化 -1,000；簽到後餘額 9,500。最終部署已成功切換老虎機，下注 100、獲得 200、餘額 9,600；返回大廳及野球拳後仍為 9,600，簽到仍為已領取。證據為 `test-results/discord-test-real-history.jpg`、`test-results/discord-test-real-slot.jpg`、`test-results/discord-test-real-shared-wallet.jpg`、`test-results/discord-test-ready.jpg`。沒有發送公開邀請或公告。

尚未完成的項目：

- CG 收藏可顯示，但實際 Discord 活動 iframe 沒有 `allow-downloads`，點擊原本的網頁下載按鈕沒有產生下載事件。原 PNG 在專用 Worker 回應 200；仍須接上 Discord 官方的外部連結流程，才能完成活動內下載相容。自動瀏覽器的下載通過不代表此項實機已通過；參考 [Discord User Actions](https://github.com/discord/discord-api-docs/blob/main/developers/activities/development-guides/user-actions.mdx)。
- 一次實際獲勝動畫的 `win-018-Do4sWUNm.webp` 經 Discord 代理載入失敗；同一原始 Worker 檔案補查為 HTTP 200、1,065,920 bytes。權威結算與餘額同步成功；代理載入穩定性仍需追蹤，不以調整停輪參數掩蓋。
- 真正手機 Discord 的音效、方向、下載及重連仍待實機驗收。其他測試員尚未提供帳號，未發出任何測試員邀請；遠端 GitHub CI 也未執行。

測試服可供擁有者開始遊玩；以上待辦不能標示為全數驗收完成。所有修改留在 `add-function`，未 commit、merge 或 push；正式環境與原 SQLite 帳本未變更。


## 2026-11-05 連線、下載與素材容錯修正

- 獨立測試外框持有唯一的 Discord SDK，切換遊戲僅替換同來源內頁。內頁取得連線前核對來源、允許路徑及 App 啟動範圍，並由 `/api/session` 再驗證身分；不新增 Firestore 輪詢。短期錢包過期時以同一 SDK 重新授權，拒絕身分改變。老虎機的 401 最多重送一次、保持相同操作內容與請求 ID。舊的無 SDK 快取恢復僅保留為舊入口相容路徑，新外框不依賴它。
- CG icon 使用官方 `openExternalLink`。目前下載來源為獨立 Cloudflare Pages `https://jokers-circus-gallery.pages.dev`，路徑為 `/cg/yakyuken/dealer/invitation`、`first-win`、`finale`，不再露出 Worker 帳號網域；不使用 Netlify。連結不攜帶 OAuth、錢包或啟動資訊；使用者可取消或再次開啟。頁面只顯示圖片名稱、「下載圖片」及「查看原圖」。舊 Worker 的 `/cg-download.html?stage=0..2` 保持相容；手機相簿實際儲存仍待真人確認。原圖沿用既有公開靜態素材，不宣稱伺服器端解鎖保護。
- 荷官素材恢復目前只在獨立 Discord 測試建置啟用：最多同時載入四張圖集；暫時性網路／408、429、500、502、503、504 失敗最多重試兩次，間隔 300ms、1000ms，網址保持不變。404／解碼等永久錯誤不自動重試。失敗動畫保留待機，初始待機失敗時嘗試靜態原畫；同一失敗動畫有 30 秒冷卻，資源仍按既有生命週期回收。
- 素材診斷只保留本頁最多 64 筆檔名、嘗試次數、耗時與可辨識狀態；不傳送遙測、Discord 訊息或資料庫寫入。前次偶發網路失敗的實際上游原因仍不能僅憑後來 HTTP 200 推定。
- 測試建置新增兩個入口後，原逐檔快取標頭超過 100 條上限。獨立測試建置改驗證所有 `assets/` 名稱均帶內容雜湊，再用一條快取規則；正式 Vite 設定不變。只有測試外框允許 `frame-src 'self'`，遊戲頁與下載頁沿用既有 CSP。
- 回歸涵蓋真實 SDK 配合 Discord 相同 iframe sandbox 權限、跨遊戲後下載、取消後再開、子頁重載、桌機／手機觸控，以及故障注入的重試上限、永久錯誤、併發限制與資源回收。完整驗證、部署及真正 Discord 結果以下方本次紀錄為準。


本次驗證與部署結果：

- 本機 `verify:ci` **15/15 步通過**，一般回歸 555 通過／1 個既有條件略過；後端整合 79 通過／2 個既有條件略過。日誌與彙整為 `test-results/discord-test-recovery-verify-ci.log`、`test-results/discord-test-recovery-verification.json`。遠端 GitHub CI 未執行。
- 專用測試 Worker 已部署版本 `1a28d473-a18e-463f-8904-0a64fce0f341`，日誌 `test-results/discord-test-recovery-deploy.log`。部署後根頁、老虎機、下載頁及原圖均 HTTP 200；只有根外框有 `frame-src 'self'`，未登入錢包仍拒絕。
- 真正 Discord 網頁已重新啟動新版本，實測大廳 → 老虎機 → 大廳 → 野球拳 → 既有 CG 收藏 → 下載。跨頁後官方外部連結確認視窗正常出現，確認後開啟測試下載頁，實際 PNG 成功下載；與來源 PNG SHA-256 相同（1,469,836 bytes）。證據：`test-results/discord-test-recovery-external.png`、`test-results/discord-test-recovery-download.png`、`test-results/discord-test-recovery-download-check.json`。沒有新增下注、簽到、邀請或公開訊息。
- 本次證明圖片故障注入可恢復／有上限及資源正確回收，不代表已證實前次偶發失敗的上游根因或所有網路情境永不失敗。真正手機 Discord 的外部開啟、儲存、音效、背景返回，以及其他測試員驗收仍待配合。
- 正式 App、正式 Worker、正式 Firestore、停輪參數及產品版本未變更；本機舊錢包仍為 86,016 bytes、最後修改時間 2026-10-27 20:31:07。修改保留在 `add-function`，未 commit、merge 或 push，也沒有自行推播。

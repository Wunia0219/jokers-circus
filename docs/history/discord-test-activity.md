# 舊 Discord 測試活動

此文件保存舊測試 Worker 與帳本的設定，供回退與查閱歷史使用。現行測試 App 的活動根映射和互動端點請依[測試服與正式服發布](../arcade-release.md)設定。維護現行測試服時請勿執行本頁的舊部署或指令設定流程。老虎機沿用[停輪基準](../reel-timing-baseline.md)。野球拳流程、角色與 CG 規格見[玩法文件](../yakyuken-preview.md)。

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

測試 App 已保存 OAuth Redirect `https://127.0.0.1`、根映射 `/` 至專用 Worker、Activity 啟用、網頁／iOS／Android 與手機直向設定。

私有 App 設定保存在忽略版控的 `.tools/discord-test-app.json`，包含 `purpose: "discord-test"`、`clientId`、`clientSecret`、`publicKey`、固定 `guildId`／`channelId` 及可選 `testerIds`。Client Secret 不放入 Vite 環境變數、網頁、網址、聊天或報告。需要用內建瀏覽器保存時，可啟動只限本機的 `node scripts/discord/configure-test.js`；表單只寫入上述本機檔案。

```sh
node scripts/cloud/discord-test.js build
node scripts/cloud/discord-test.js deploy
node scripts/cloud/discord-test.js configure-entry
node scripts/cloud/discord-test.js check
```

建置輸出為 `test-results/discord-test-dist`；部署設定為忽略版控的 `wrangler.discord-test.local.jsonc`。建立多入口的測試建置，不覆蓋正式 `dist`；新流程接管後，舊 `yakyuken-test-deploy.js` 會拒絕部署，以免移除 Discord 的前端與登入設定。前端、後端、加密會話與原測試玩家 DO 均在同一專用 Worker，保留既有測試資料。

根路徑 `/` 載入保留 Discord SDK 的測試外框，內部 `/yakyuken-preview.html` 顯示大廳、`/slot/` 顯示原有老虎機；HTML 自動轉址關閉，由 Worker 明確映射，避免 `/index.html` 被導回大廳。HTML 使用既有 Discord iframe CSP，手機音樂沿用原 Range 適配器。

Portal 的 Interactions Endpoint 已保存為該來源的 `/api/interactions`，通過 Discord PING；條款／隱私網址已保存為 `/terms.html` 與 `/privacy.html`。`configure-entry` 已將新 App 唯一的 Activity 入口設為 APP_HANDLER（handler 1）；使用者啟動時回應 `type:12`，不自動張貼邀請。測試 App 已以單一 `applications.commands` scope 安裝至小丑俱樂部，沒有新增機器人權限或發送邀請訊息。其他測試員尚未邀請，須取得實際帳號後再加入 Portal 測試員名單。

## 身分、權限與錢包

- 啟動互動先驗證新 App 的 Ed25519 簽章、App ID、伺服器及頻道。錯誤範圍只回覆觸發者的私人提示；不產生公開推播。
- OAuth 使用 `identify` 與 `guilds.members.read`。後端向 Discord 驗證使用者與伺服器成員資格，並要求先從指定頻道取得有效的簽章啟動紀錄；網址上的 `channel_id` 不能取代此檢查。
- 會話最長一小時，保存在加密 Durable Object SQL；每次授權有持久請求限制，定期重新檢查成員資格。可用 `testerIds` 進一步限定 Discord 使用者；Portal 的 App 測試員名單也須允許對方使用未驗證活動。
- 現行外框持有 SDK 與短期錢包會話，內頁切換時透過 `/api/session` 重新驗證身分。舊無外框入口保留以 App、frame、instance 分區的 sessionStorage 相容路徑，不保存 OAuth access token；該路徑失效時清除暫存並要求重開。身分驗證使用 Auth DO，不讀寫 Firestore，未確認遊戲操作保留原 ID。
- 玩家鍵固定由後端產生 `d_<guildId>_<userId>`。Discord 入口禁止指定 `player` 查詢參數；只有本機閘道持有的私有權杖可使用合成 `qa-*` 帳號。
- 同一玩家的兩款遊戲共用測試餘額、同一份每日／七日簽到與權威 revision。野球拳、老虎機紀錄分開顯示，扣發款、最新紀錄及去重憑證在同一玩家文件交易完成。
- 野球拳入場扣 1,000，通關獎金依[角色規則](../yakyuken-probability.md)；暖機後平手不讀寫 Firestore、不累計平手數。老虎機沿用原條帶、算獎、下注額與兩秒冷卻，結果只由伺服器產生。
- 切換遊戲保留 `frame_id`、`instance_id`、`platform`、`guild_id`、`channel_id`、`location_id`、`discord_shim` 及手機版本等必要啟動資訊，會話、OAuth token 與 proxy ticket 不複製至切換網址。外框持有唯一 SDK，內頁經同來源握手與 `/api/session` 恢復授權；過期時使用同一 SDK 重新授權，拒絕身分變更。桌機／手機瀏覽器外框刻意拒絕第二次握手，防止這類回歸。簽到跨遊戲只領一次；未確認請求保留原 ID，不重新扣款或重抽結果。
- 此 Worker 沒有 Discord 公告／維運推播工作，也沒有免費額度 80% 通知或持續 Firestore 輪詢。

## 測試服共用管理指令

`DISCORD_TEST_COMMANDS_ENABLED=true` 後，既有測試 App 提供與正式服共用的 `/戲籌`、`/戲籌管理`、原生表單、紀錄分頁與重設確認卡。以 `node scripts/cloud/discord-test.js register-commands` 註冊，只使用測試 App 的 client credentials 與指定測試群；保留 Activity Launch，不安裝 Bot、不建立或要求 Bot Token、不發送公開通知。測試發放表單省略公開通知選項，竄改提交通知選項也會拒絕。

所有指令與元件重新驗證簽章、App、測試群 `760012177326997544`、頻道 `1564243344857632818`、面板開啟者及管理權限。預設只有 Discord 管理員可操作；可另設定 `DISCORD_TEST_ADMIN_ROLE_IDS`。資料與雲端固定為既有專用測試 Worker、`slot-game-203db`、`yakyuken-playtest-20261105-test`，不使用正式 App、正式 DO 或正式資料庫。表單原請求也綁定操作、目標、金額及原因，不能以同一表單改發給第二位玩家。

發放與收回經原玩家 DO 依序操作同一份測試錢包，兩款遊戲立即共用餘額。正常玩法、持久去重與未知提交恢復沿用原機制。開啟面板／表單不查 Firestore，重複管理操作使用原結果；沒有新服務、輪詢、推播或排程。必要的實際結算與查帳仍會計入既有 Cloudflare／Firestore 用量，不能宣稱零用量：啟用後成功改變測試錢包的交易增加同一測試命名空間內的計數器與一份查帳紀錄，發放另更新每日額度，收回另標記原發放；暖機後平手和重播遊戲憑證仍不讀寫 Firestore。

新查帳資料存於 `testAdminLedger`（單欄索引）、`testAdminMeta`、`testAdminDays`；從功能啟用後開始記錄，不批次改寫舊遊玩。原有遊玩紀錄、收藏與簽到狀態保留。歷史每頁 10 筆；單次摘要最多 1,000 筆，超出明確提示縮短期間，不回傳不完整的總計。

全群重設只涵蓋本測試群既有 Discord 玩家錢包，合成 `qa-*` 玩家不在其中。先以既有 Auth DO 保存意圖、逐一凍結玩家 DO 並完成未確認操作，再以單筆 Firestore 交易更新全部錢包、重設帳本與一份結果憑證；成功後清除快取及解凍。中斷或未知提交時，後續授權先用原意圖恢復；不允許遊玩穿插到半完成的重設。每次最多 100 份錢包，保留簽到／遊玩／收藏／舊去重憑證；超出整筆拒絕，不略過玩家。結果位於 `testAdminOperations`，與正式帳本集合完全分離。

## 開場、下載與素材恢復

- 外框先顯示讀取層，再準備 SDK、登入、錢包與大廳。每次活動只選一次主題；橫直切換使用同主題對應構圖，遊戲切換不重新選圖。三張橫式核准來源與雜湊見 `art/launch-screen/approved-assets.json`；直式圖位於 `images/launch/portrait-*.webp`。
- 橫式保留完整構圖，直式／正方形使用直圖，依 Discord／裝置安全區排版。開場允許手機旋轉，完成後恢復遊戲直向設定。`LOADING...` 逐字波紋與背景光波在背景暫停，減少動態時靜止。
- 外框核對同來源及真正內頁 window 的就緒事件，待大廳實際繪製後才淡出並解除輸入鎖定。裝飾圖失敗退回深色底；登入／大廳失敗保留遮罩與重開提示。純美術預覽：`node scripts/preview/launch.js`，入口 `http://127.0.0.1:4205/`，以 `?art=1..3` 指定主題。
- CG 下載透過 SDK `openExternalLink` 開啟 [獨立下載站](https://jokers-circus-gallery.pages.dev)，不攜帶 OAuth、錢包或啟動資訊。舊 `/cg-download.html?stage=0..2` 保持相容。圖庫為公開靜態素材；遊戲內解鎖檢查不等於下載站的伺服器授權。
- 私有 `.tools/discord-test-app.json` 可設定單一 `cgPreviewUserId`。只有已通過測試群授權且 ID 相符的帳號可預覽全數 CG；不寫入收藏、勝場或錢包，移除設定並重新部署後恢復原進度。
- 荷官恢復僅在獨立測試建置啟用：最多同時載入四張圖集；網路／408、429、500、502、503、504 最多重試兩次，間隔 300ms、1000ms。404／解碼錯誤不重試。失敗動畫保留待機，初始待機失敗嘗試靜態原畫；同一失敗動畫冷卻 30 秒。
- 素材診斷只保留本頁最近 64 筆，不傳遙測或寫資料庫。測試建置核對雜湊資源名稱後共用快取規則；只有外框允許 `frame-src 'self'`，內頁沿用既有 CSP。

## 驗證與已記錄發布

自動驗證入口、連接埠及 CI 分組集中於[測試文件](../testing.md)。`tests/discord-test.test.js` 與整合測試覆蓋簽章、頻道、OAuth、玩家隔離、共用錢包及重啟；`scripts/qa/discord-test-activity.js` 使用真正 SDK 與模擬 Discord 外框驗證桌機／手機雙遊戲。這些隔離檢查不取代真正 Discord 客戶端驗收。

| 最近記錄 | 版本／證據 |
|---|---|
| 2026-11-09 萬世與五角色 CG | 測試 Worker `fb3ad0d1-54a0-4b91-8f03-9159ae53a32a`；圖庫 `c5ec5957-5c5e-4b2a-ab2f-835e4ac21fec`；`test-results/wanshi/` |
| 該次本機驗證 | `verify:ci` 16/16、野球拳瀏覽器回歸 28 項；62 份 WebP／PNG 比對通過，遠端 CI 未執行 |
| 測試管理指令 | `test-results/branch-commands-release/`；指令註冊及正式／測試隔離記錄 |
| 真正 Discord 網頁下載 | `test-results/discord-test-recovery-download-check.json`；官方外部連結確認後 PNG 下載與來源雜湊相符 |

以上為歷史記錄，不代表本次重新部署或目前線上探測。舊版本與逐次驗證數量見 Git 歷史；本機結果、遠端 CI 與真人驗收分開記錄。憑證、加密金鑰、資料庫及玩家資料不得加入 CI 附件或版控。

仍需真人驗收：手機 Discord 的外部開啟／相簿儲存、音效、方向、背景返回與重連，以及其他測試員權限。素材故障注入已驗證有限重試和資源回收，但尚未證實先前 Discord 代理偶發失敗的上游根因。

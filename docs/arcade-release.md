# 測試服與正式服發布

測試服與正式服共用 Worker 程式、老虎機和 `/operator`，各自使用 Discord App、Durable Object、Firestore v2 帳本、備份、監控及管理金鑰。

| | 雙遊戲測試服 | 正式服 |
|---|---|---|
| Worker | `jokers-circus-arcade-test` | `jokers-circus-production` |
| 後台網址（部署後） | [測試後台](https://jokers-circus-arcade-test.nini900219.workers.dev/operator) | [正式後台](https://jokers-circus-production.nini900219.workers.dev/operator) |
| Discord App | Joker’s Circus · Test | Joker’s Circus |
| 遊戲入口 | 雙遊戲大廳，野球拳預設模糊預告 | 直接進入老虎機 |
| Discord | 原有指令，私下回覆 | 原有指令、聊天室機器人與 @ 通知 |
| 帳本 | `slot-game-203db` / `jokers-circus-arcade-test` | `jokers-circus-production` / `jokers-circus-v2-20261030-production` |
| Wrangler 設定 | `wrangler.arcade-test.jsonc` | `wrangler.production.local.jsonc` |
| 監控 Worker | `jokers-circus-arcade-test-monitor` | `jokers-circus-monitor` |

## 四項發布前檢查

1. **保留前版產物。** 首次雙遊戲測試從空白帳本開始，可以省略舊產物。後續更新測試服時保存它自己上一版的產物。正式服第一次接入也要保存當時實際上線的老虎機 `dist`。建置會保留原本的雜湊素材，讓換版時開著的頁面能完成當局。
2. **共用自動測試，在測試服做完整真人演練。** 每個提交跑一份 `npm run verify:ci`，另跑 `node scripts/qa/arcade-release.js` 與 `node scripts/qa/operator-console.js`。用測試帳號與手機、桌面 Discord 驗證登入、入場、暫停、繼續未結算回合和收據查詢。原請求重試應只結算一次。正式部署後只做健康、大廳、舊頁面與隱藏閘道的驗收，揭曉及暫停演練留在測試服。
3. **分別建置並稽核。** `npm run arcade:preflight -- test` 產出 `dist-arcade-test`，`npm run arcade:preflight -- production` 產出僅含老虎機的 `dist`。更新時以 `--legacy <該環境上次實際部署的產物路徑>` 保留前版素材。兩個指令都檢查環境綁定、建置對應的 Discord App 並做 Wrangler `--dry-run`，報告存到 `test-results/arcade-preflight/`。
4. **各自備份與核對回退。** 測試服可用自己的帳本演練更新備份、核對備份、離線還原及 `S-`／`D-` 原請求。正式切換前核對正式服的最新快照與回退版本。備份解密與完整還原在隔離環境執行，入口與備份的日常操作走後台。參見[備份與恢復](recovery.md)。

## 測試服首次接入

1. 將[測試維運範本](../deploy/arcade-test.env.example)複製成 `.env.arcade-test.local`，填入測試專案服務帳戶的絕對路徑。首次在新的 SQLite 路徑用 `node --env-file=.env.arcade-test.local scripts/database/init-db.js` 準備空白測試帳本。接入測試時用 `node --env-file=.env.arcade-test.local scripts/firestore/import-firestore.js --from <空白 SQLite>` 初始化新 namespace，接著用同一份設定執行 `scripts/firestore/backup-firestore.js`。這兩個遠端步驟需要在該私有設定中暫時啟用 `FIRESTORE_LIVE_ENABLED=true`。
2. 把測試快照連同三份用量資料庫交給 `cloud:handoff -- prepare --env .env.arcade-test.local --from <測試快照> --to <交接檔> --writers-stopped true`。全新且未啟用 Discord 公告時，缺少的 `.highlights.sqlite` 可用 `FirestoreQuota` 以同一測試 project 初始化為空。使用新 Worker 專屬的 `CLOUD_ADMIN_TOKEN`、`CLOUD_ENCRYPTION_KEY` 和 `ARCADE_CONSOLE_TOKEN`，以及測試 App 的 `DISCORD_CLIENT_SECRET`、測試專案的 `GOOGLE_SERVICE_ACCOUNT_JSON`。部署測試 Worker 後，以 `.env.arcade-test.local` 為目標，用既有 `cloud:control` 的 `seed`、`verify`、`activate` 完成測試帳本接入。測試後台管理金鑰與正式服分開設定。
3. 測試 Worker 就緒後，在 **測試 App** 把根映射及 Interactions Endpoint 分別指向新測試 Worker 及其 `/api/interactions`。Discord 不須重新註冊指令；兩款遊戲和指令使用同一個現行測試帳本。切換後請重新輸入指令以開啟新的管理表單。舊測試 Worker 和帳本可保留供回退，餘額與紀錄不自動搬移。
4. 用 `wrangler.arcade-test-monitor.jsonc` 部署測試監控。為測試遊戲 Worker 的 `CLOUD_MONITOR_TOKEN` 和測試監控的 `MONITORED_TOKEN` 設定同一把測試專用唯讀金鑰。測試監控每十分鐘查看測試服狀態，結果可在監控的 `/__ops/status` 查詢。測試服不設定 Discord 公告憑證。

## 正式服接入

正式設定使用 `./dist`，不啟用 `ARCADE_RELEASE_ENABLED`。把 `/operator`、`/__operator/*`、`/game-entry.json` 加到現有 `assets.run_worker_first` 路由。正式 Worker 保留既有 Discord App、聊天室機器人、@ 通知、DO、Firestore 及既有 Secrets。首次接入後台時新增正式服專用 Worker Secret `ARCADE_CONSOLE_TOKEN`（64 字元十六進位）。

發布後核對 `/readyz`、`/operator`、`/game-entry.json?controls=1` 和 Discord 直接進入老虎機。老虎機預設開放；`/api/arcade` 以及野球拳頁面、素材與 API 應收到 404。

測試服素材經 Worker 路由，方便攔截未揭曉的遊戲素材。測試大廳只在可見時更新狀態，並在回大廳時立即刷新。營運狀態查詢只讀 DO。揭曉後已載入的雜湊素材可由瀏覽器快取。 [Cloudflare 靜態素材路由與用量](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## 營運面板

在一般瀏覽器開啟 Worker 網址的 `/operator`，貼上專用管理金鑰。頁首會顯示正式或測試環境。每次變更前可先閱讀玩家會受到的影響，確認後由伺服器核對入口狀態。

| 遊戲 | 選項 | 玩家行為 |
|---|---|---|
| 老虎機 | 開放／維護 | 維護時停止新回合。已入帳的原請求仍可確認，原本已開的頁面也能完成當局。 |
| 野球拳（測試服） | 預告隱藏 → 揭曉 → 暫停新場次／重新開放 | 揭曉前只有「即將揭曉」。開放後顯示原圖和名稱。暫停時可看紀錄與續玩已付費的場次。 |

揭曉與暫停可直接操作面板，約 15 秒內更新已開啟且可見的大廳。已揭曉後需要止血時使用「暫停新場次」。DO 重啟會保留狀態。重建全新的 DO 時會從預告隱藏開始，由營運管理員重新確認狀態後開放。

測試服的兩款遊戲沿用同一位玩家的 Firestore v2 錢包及週簽到。野球拳的入場、出拳、離場、派彩與收藏進度可用原請求重播。平手不扣戲籌，會保存出拳進度。備份用收據重建場次和收藏，並核對權威錢包的校驗值。

現有公開 CG 下載站仍可由既有外部連結開啟。測試大廳直到揭曉才會載入遊戲的下載功能。

## 玩家遇到扣款或派彩回應中斷

1. 請玩家保留原畫面。老虎機再按 SPIN 確認上一局，野球拳按畫面上的重試，或重新載入同一活動視窗讓遊戲恢復原請求。
2. 記下玩家、台灣時間和畫面上的 `S-`（老虎機）或 `D-`（野球拳）回報碼。請透過私訊或私下支援管道收集。
3. 在後台的 **查詢玩家回報** 貼上使用者 ID 和回報碼，再按 **取回原結果**。查到結果時可核對原紀錄、時間和前後餘額，並複製回覆給玩家。查無紀錄時，先確認身分、時間和回報碼，讓玩家以同一操作再次確認。 [Discord 使用者 ID 說明](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID)
4. 若同時有多名玩家回報，先關閉受影響遊戲的入口。到 **備份與服務恢復** 查看上次成功時間，可手動更新備份並核對完整性。看到服務就緒後可重新開放入口。

玩家重試會沿用原請求 ID。後台查詢、核對備份皆為唯讀。需要更換資料來源或還原整份帳本時，依正式的 [備份與恢復流程](recovery.md) 進行。

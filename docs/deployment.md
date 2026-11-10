# 部署與維運

本機版本以 `package.json` 為準，線上版本另查 health。正式服務使用 Cloudflare Workers Paid（2026-10-31 使用者確認）／SQLite DO 與台灣 `asia-east1` Firestore v2；使用者已確認 Firebase Blaze 並授權超額營運，Firestore 內部額度只告警。入口、群／頻道、發布版本及驗證紀錄見[正式服交付](customer-handoff.md)。

## 設定與資料範圍

`main` 可以同時保存正式與測試功能的原始碼；合併不代表全部功能發布正式服。1.0.3 起，一般 `npm run build` 以 `productionBoundary` 排除野球拳、Discord 測試會話與大廳導航模組，並只複製明確核准的政策頁與公告圖片，不複製 `public/downloads/yakyuken/`。模組圖或產物含野球拳／測試雲端識別即拒絕建置。獨立測試建置使用自己的插件、多入口及輸出目錄，保留所有測試玩法、CG 與開場素材。

正式發布前執行 `npm run build`、`npm run cloud:build` 及 `node scripts/qa/production-release.js`，核對正式 `dist`、Worker bundle、正式／測試的 Worker、DO、Firestore 與通知頻道。稽核只讀設定，不調整綁定。野球拳只允許專用 `jokers-circus-yakyuken-test`、`slot-game-203db`／`yakyuken-playtest-20261105-test`；不得使用正式 App、Worker、DO 或帳本。測試部署流程見[獨立 Discord 測試活動](discord-test-activity.md)。

Netlify 的建置預覽由根目錄 `netlify.toml` 指定 `NPM_VERSION=12.2.1`，在自動安裝依賴前切換 npm；Node 仍依 `.node-version`。`packageManager`／`engines` 不會替 Netlify 升級 npm，放在 build command 裡才升級也來不及。保留 `.npmrc` 的版本與安裝腳本限制。參考 [Netlify 相依管理](https://docs.netlify.com/build/configure-builds/manage-dependencies/#npm)。

| 項目 | 設定 |
|---|---|
| 正式 Firestore | 專案 `jokers-circus-production`，namespace `jokers-circus-v2-20261030-production`，`APP_ENV=production`，`asia-east1` |
| 正式 Worker | `jokers-circus-production`；忽略 Git 的 `wrangler.production.local.jsonc` |
| 正式維運設定 | `.env.cloud.production.local`；Discord CLI 使用 `.env.server.production.local`（本機 live writer 關閉） |
| 保留測試 Firestore | 專案 `slot-game-203db`，namespace `jokers-circus-v2-20261024-test`，`APP_ENV=test`；舊服務未刪除，Discord 共用應用程式入口已切正式 |
| 測試群／頻道 | 群 `760012177326997544`，頻道 `1564243344857632818` |
| 測試 Worker | `wrangler.jsonc`；私密覆寫為忽略 Git 的 `wrangler.cloud.local.jsonc`，不要用於正式更新 |
| 執行設定 | `CLOUD_PLAN`（`free`／`paid`，核對實際方案）、`APP_ENV`、`FIRESTORE_PROJECT_ID`、`FIRESTORE_NAMESPACE`、`FIRESTORE_ENDPOINT` |
| Discord 範圍 | `DISCORD_CLIENT_ID`、`DISCORD_PUBLIC_KEY`、`ALLOWED_GUILD_IDS`、`DISCORD_COMMAND_CHANNEL_IDS`、`CHIP_ADMIN_ROLE_IDS`（相容舊 Worker 的 `ADMIN_ROLE_IDS`） |
| 遊戲限制 | `WEEKLY_CHECKIN_REWARDS`、`ADMIN_GRANT_MAX`、`ADMIN_DAILY_MAX` |
| Secrets | `DISCORD_CLIENT_SECRET`、`GOOGLE_SERVICE_ACCOUNT_JSON`、`CLOUD_ADMIN_TOKEN`、`CLOUD_ENCRYPTION_KEY`、`CLOUD_MONITOR_TOKEN`；正式公告使用 `DISCORD_BOT_TOKEN`，舊 Webhook 模式使用 `DISCORD_HIGHLIGHTS_WEBHOOK_URL` |

前端只放公開 client ID 與 auth／wallet 開關；私密值不得使用 `VITE_` 前綴。環境範本在 `deploy/`；既有服務更新保留同一 Worker、DO identity、全部變數、Secrets 及額度，不能重做 seed。程式發布不等於資料遷移。

雲端是唯一 writer；本機 `.env.server.local` 的 `FIRESTORE_LIVE_ENABLED=false` 保留。不可為本機測試重開 4188 直連現行帳本，也不能由本機維護工具額外消費另一份額度。writer 轉移見[恢復程序](recovery.md)。

Cloudflare 於 2026-10-30 將 Durable Object 更新預設改為最多延後 300 秒；Worker 發布成功不表示正在執行的 DO 已切換。緊急修正需立即呼叫新增管理入口時，可對已驗證版本使用 `wrangler versions deploy <VERSION_ID>@100 --config wrangler.production.local.jsonc --durable-objects-code-update-mode immediate --yes`，監控同理使用它自己的設定及版本。這只覆寫該次部署的更新策略；持久資料不清空，未確認操作仍沿原 request ID 恢復。套用後核對實際狀態欄位、`/readyz`、來源版本與原綁定，不能僅以 CLI 成功判定生效。[官方更新策略](https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/)

## 用量與容量

Cloudflare 費率、方案標記及容量限制見[Cloudflare 費用](cloudflare-costs.md)。設定兩種角色變數時必須一致；有衝突即拒絕啟動，避免部署後更換授權對象。

2026-10-31 使用者授權完整使用 Firestore 免費資源、超額後繼續付費營運；2026-11-05 進一步明確要求移除免費額度八成推播，保留用量及其他異常通知。正式服採 `notify-only`，不再因讀取、寫入、傳出流量、儲存或公告／備份的內部額度拒絕操作。保留全部既有用量、失敗／未確認操作的原計數、帳本與原請求去重；不重設或折減歷史用量。Cloudflare Workers Paid 與 Firestore Blaze 分別計費，方案升級不重設任何用量。

告警參考線為每日讀取 50,000、寫入 20,000，儲存 1 GiB、每月傳出 10 GiB。維護及公告共用相同參考線，不再套用較低分配額度；維護服務仍保持唯讀。讀寫保留 24 小時滾動估算，傳出流量使用太平洋時間曆月的持久累計，儲存保留原保守估算；這些不能取代供應商用量與帳單。切換時把仍保存的流量觀測帶入月累計，不反推不存在的歷史。月累計不因每日清理、重啟或匯出／移入而遺失。[官方免費額度](https://firebase.google.com/docs/firestore/quotas#free-quota)

只告警模式須在核對正式專案 Blaze 及使用者付費授權後，以管理員明確啟用；監控 token 無權變更。發布程式不會自行解除原有保護。未明確切換的測試／舊服務仍使用原保護上限，`quota-limits` 可在免費上限內提高其讀寫額度。此授權不包含原生付費備份、PITR 或其他新增付費產品。

```powershell
node scripts/cloud/cloud-control.js quota-notify-only --env .env.cloud.production.local --allow-paid-usage true
```

正式服超過參考線仍可操作；免費額度百分比只記錄，不再推播，也不在 100% 升級成停服告警。登入、權限、交易完整性、文件／備份實體容量及備份失效的保護仍保留；供應商實際故障或平台硬限制不在應用程式的額度開關控制範圍內。不得用新 namespace、主機或 DO 隱藏用量。

## 日常操作

結算減少寫入、P/R 獨立編號、費用情境與相容版本回復方式見[結算儲存與編號](settlement-storage.md)。

```powershell
npm run cloud:control -- health --env .env.cloud.production.local
npm run cloud:control -- status --env .env.cloud.production.local
node --env-file=.env.server.production.local scripts/discord/check-discord.js --cloud --discord --public-origin https://jokers-circus-production.nini900219.workers.dev
```

`status`／`health` 只讀 DO 摘要，不查玩家文件、不觸發備份。`health` 會核對本機版本；未發布分支的版本差異不等於遊戲故障。下載與還原見[備份](recovery.md)。

### 遊戲入口開關

要切換時可直接請 Codex「正式服切維修」或「正式服開放」。修改 `public/game-entry.json` 的 `mode` 為 `maintenance` 或 `open`，保留 `previewUserIds` 中已確認的 Discord 使用者 ID。設定檔是公開靜態資源，只放模式與允許預覽的 ID。首次發布預設 `maintenance`。

首次發布後，單純切換狀態時使用線上同一版程式，只改入口設定。以正式 Discord App 的公開 client ID 建置，確認 `VITE_DISCORD_AUTH_ENABLED` 和 `VITE_DISCORD_WALLET_ENABLED` 均為 `true`。依本文件的正式發布前檢查核對產物和綁定，以 `wrangler.production.local.jsonc` 發布到既有正式 Worker。確認線上的 `/game-entry.json` 回傳預期模式與 `Cache-Control: no-store`、公開入口能顯示預期畫面、`/readyz` 正常。本機開發、loopback 測試錢包與獨立 Discord 測試活動沿用各自入口。

新版遊戲啟動、回到前景或前景每 15–20 秒檢查入口。讀到維修後停止自動轉及新操作，正在處理的局或簽到完成後切到維修畫面。玩家可按「重新檢查」重新進入。舊版頁面仍可能提交操作。搬移資料或需要停止所有帳本寫入時，依[恢復程序](recovery.md)停寫並確認排空，適用於所有帳號。

## Discord

新增的同身分大獎逐筆公告與玩家出入場公告見[賭場機器人公告](casino-announcements.md)。這是可選的 Bot REST 功能，預設停用；不需要 Gateway 常駐綠燈，也不更改既有 HTTP 指令。啟用前必須完成 bot 安裝、私密 Bot Token 與指定頻道的核對。

Activity `/` URL Mapping 指向固定 HTTPS 主機；Interactions Endpoint 為該網址加 `/api/interactions`。OAuth scope 為 `identify`、`guilds.members.read`，前後端 Application ID 一致。只有調整指令定義或新群安裝時才執行 `commands:register`；定義及權限見[指令](discord-commands.md)。

公開 `/healthz` 代表 HTTP 程序存活，`/readyz` 檢查錢包與維運是否可服務；都不輸出玩家或憑證。政策頁為 `/privacy.html`、`/terms.html`；資料查詢、更正或刪除須先核對本人及帳本關聯，不能只刪錢包而留下不一致流水。

## 獨立監控

Cloudflare 官方用量由外部 GitHub 排程監測；設定、Free 門檻／Paid 每日觀測及失敗處理見[Cloudflare 用量預警](monitoring.md)。以下為既有遊戲健康監控，兩者的用量口徑不同。

健康條件、通知去重、退避及監控權限集中於[監控文件](monitoring.md#遊戲健康條件)。

設定範本 `deploy/monitor.env.example`、`wrangler.monitor.jsonc` 預設停用；不要拿範本覆蓋已啟用服務。撤回通知只改監控 `MONITOR_ENABLED=false`，保留遊戲與資料。

## 本機 Node／SQLite

`npm run dev` 提供 4187 瀏覽器 localStorage 試玩。完整隔離入口與 4192 QA 見[測試](testing.md)。4189 開發使用 `deploy/backend.env.example`、`APP_ENV=test`、`HOST=127.0.0.1`、`DATABASE_PATH=data/backend.sqlite`。

```powershell
npm run backend:init
npm run backend:dev
npm run backend:check
npm run backend:backup
npm run backend:restore -- --from <已驗帳快照> --to <新SQLite檔>
```

檢查為唯讀一致快照；備份使用 VACUUM INTO 包含已提交 WAL；還原只建立新檔。確認原 writer 停止並驗帳後才切換 DATABASE_PATH。`server/index.js` 與 Docker 入口保留，啟動前驗證環境及 Discord 憑證；Node session 重啟失效，雲端 session 加密持久保存。

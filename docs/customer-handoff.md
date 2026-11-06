# 正式服交付

正式遊戲與監控版本 **1.0.3**，發行分支 `main`。2026-11-06 已將 `add-function` 全部變更與原 `main` 合併，正式服部署發放戲籌通知選項；野球拳只部署獨立測試服。原備份續作、免費額度八成推播退役及通知防重複修正完整保留。CI 不會自動部署，遠端結果另依最終提交核對。

## 1.0.3 發布（2026-11-06）

使用者要求更新至 1.0.3、將 `add-function` 的全部變更與 `main` 合併，並允許機器人通知功能發布正式服。野球拳的原始碼、素材與測試功能完整保留在 Git，但任何野球拳內容不得進入正式部署；只使用獨立測試 App、Worker、DO 與 Firestore。版本、停輪及兩秒冷卻仍各自沿用原來源與基準。

新增發放表單的通知選項，預設不通知；明確選擇後只在正式遊玩頻道 `1565731918107115690` @ 收款玩家，公開數量與原因、不公開餘額。正式建置排除測試內容及 CG 下載，發布前以 `node scripts/qa/production-release.js` 核對產物與環境隔離。發布結果與本機／遠端驗證分開記錄。

合併保留整個 `add-function` 歷史（27 筆既有開發提交及 1.0.3 提交），也保留原 `main` 的備份／監控修正。合併後本機 `verify:ci` **16/16 步通過**：一般回歸 583 通過／1 個既有條件略過；Firestore／REST／workerd／恢復 79 通過／2 個既有條件略過；監控 workerd 2 通過。正式產物稽核通過，82 個檔案不含野球拳或測試雲端內容。

部署前後的正式服唯讀檢查、桌機／手機完整載入及線上檔案雜湊比對通過；9 個野球拳／測試入口與資產路徑均 404。正式／測試／監控的變數、Secrets 名稱及 DO 綁定前後相同，原正式帳本來源及備份保留，writer active、health／ready 正常；未登入玩家、下注、發放或發送正式測試通知。實際線上 Worker 程式已確認包含新通知選項，不含野球拳或測試資料來源。這些檢查不取代真人 Discord 指令操作驗收。

證據保存在 `test-results/release-1.0.3/`：`verify-ci.json`、`isolation.json`、`before.json`／`after.json`、`production-browser-before.json`／`production-browser-after.json`、部署日誌與畫面；遠端 GitHub CI 與本機結果分開記錄。

## 方案與發布

2026-10-31 使用者確認 Cloudflare **Workers Paid**；Firebase **Blaze** 已確認。Firestore 保留 `notify-only`、全部用量記錄、P/R 編號及一般每局 4 寫；免費額度八成推播於 2026-11-05 依指示移除，備份實體容量及其他異常通知仍保留。動畫與冷卻沿用[停輪基準](reel-timing-baseline.md)。

2026-11-05 修正將 20 筆備份 checkpoint 的續作等待縮短為一秒，與十分鐘一般維護分開；保留一致 readTime、完整驗帳、最近三份有效快照及 48 小時保護，新增持久退避。告警按個別事件去重、持續正常 30 分鐘才重新準備提醒；同類排程／備份異常另有六小時持久冷卻，嚴重度升級或獨立異常仍可通知。429 遵守供應商期限並增加一分鐘至一小時的退避，uncertain 不盲目重貼。舊免費額度告警與待送重試原地退役，不補發遲到的恢復訊息。未變更前端、結算、玩法計時或未發布開發分支，也沒有發送部署完成通知。

正式遊戲與監控皆已部署，100% 流量使用修正版；`paid` 標記、原有變數／Secrets 名稱／DO 綁定與 Firestore 來源均核對通過。2026-10-31 的共用設定、runtime／歷史分工及 Paid 文案整理保留；外部 GitHub 用量排程以預設分支實際 Actions 結果為準。

本機 `verify:ci` **14／14 通過**；部署後 health／ready、備份、前端入口與引用資源雜湊及 Discord 20 項自動檢查通過。新增真正 workerd 排程／重啟的舊收據退役與六小時反覆故障測試；重新加入八成提醒、移除冷卻或限流退避均被反向測試拒絕。正式 writer 為 active，`notify-only` 且 `blocked=false`；超額用量及百分比仍可查閱，不再產生 `QUOTA_HIGH`。真人登入／遊玩驗收未包含在自動檢查內。

2026-11-05 台灣時間 15:00 的正式例行監控已確認舊八成告警退役，`lastAttemptAt`／`lastNotificationAt` 均仍是部署前時間，沒有補發舊提醒或恢復訊息。讀取保守估算仍約為參考線的 589%，用量未重設；證據為 `test-results/notification-policy-release/quiet-migration.json`。

2026-11-05 台灣時間 13:56，新備份已通過完整驗帳並發布，revision 由 10,465 推進至 18,346，`BACKUP_DELAYED` 與 `ALARM_FAILED` 解除。原用量與帳本未重設；本次通知政策更新保留此有效備份，不觸發額外備份。

同份新備份已下載、解密驗帳並還原到全新本機 SQLite；28 個錢包及 18,264 筆原請求重播檢查通過，七表與來源 archive 均未變更。此演練禁止連外，不是正式資料回灌；證據在 `backups/backup-fix-20261105/after-drill/`，通知停用。

| 已記錄的發布 | 遊戲／監控版本 ID | 本機證據 |
|---|---|---|
| 2026-11-06：1.0.3（目前） | `ca09a534-259d-492c-a337-2523a63015eb`／`8e01731f-aa16-43ad-8024-2af3eff7349c` | `test-results/release-1.0.3/`：合併後完整驗證、正式／測試隔離、前後綁定、線上程式與正式服唯讀影響檢查 |
| 2026-11-05：1.0.2 免費額度通知退役／防重複 | `a3dd6044-f10d-4cb1-a68d-9ee0f482e801`／`800a89de-529b-4763-8ba0-95bcc99c5903` | `test-results/notification-policy-release/`：完整驗證、反向測試、前後綁定、100% 版本與用量／備份保留核對 |
| 2026-11-05：1.0.2 備份／告警修正 | `6016afa3-65b3-4dcf-8393-227c2fff6026`／`24ad0fa8-2130-4d78-a045-9c9ecb9a383f` | `test-results/backup-fix-release/`：完整驗證、前後綁定、100% 版本與新備份核對 |
| 2026-10-31：1.0.2 | `f33dd347-7141-4df2-ae1a-ee3e1a18d76e`／`527f5b0d-ff15-4dc0-bf0d-a7bdab5b02ca` | `test-results/release-1.0.2/`：完整驗證、部署前後綁定與正式入口核對 |
| 本次部署前：1.0.1 | `a36d8e1c-aee3-4d63-80ea-5982f9abcd52`／`191111f2-7eb9-4a42-85c0-fca73592aa43` | 同目錄的 `*-version-before.json` 與 `status-before.json` |
| 精簡結算最早相容版 | `ed978184-955e-46fa-a231-98d29fa87cd6`／`89a2abdf-5e20-4459-a85c-f626563eb33e` | `test-results/db-write-optimization-20261031/`；啟用時 nextId 1555 |

本次本機驗證看 `test-results/notification-policy-release/verify-ci.json`，正式核對看同目錄 `verification.json`；前次備份修復的加密副本與還原證據位於 `backups/backup-fix-20261105/`，這些證據不進版控。遠端 CI 須另外核對最終 commit。歷史版本不作為可直接回退清單；回退必須保留[新舊格式相容性](settlement-storage.md#啟用與回復)。

## 正式配置

| 項目 | 設定 |
|---|---|
| 入口／Worker | `https://jokers-circus-production.nini900219.workers.dev`／`jokers-circus-production` |
| Discord 群／頻道 | `1503958213454856252`／`1565731918107115690` |
| 指令 | `/戲籌`、`/戲籌管理`；管理操作限授權身分 |
| 資料庫 | `jokers-circus-production`，Standard Firestore `(default)`，台灣 `asia-east1` |
| namespace | `jokers-circus-v2-20261030-production`，schema v2 |
| writer | 雲端唯一 writer，本機 `FIRESTORE_LIVE_ENABLED=false` |
| 監控 | `jokers-circus-monitor` 每 10 分鐘；[外部用量設定](monitoring.md)；[維護頻道](https://discord.com/channels/1441097301685698703/1564187899019141140) |

Bot 用 REST 發送大獎與出入場公告，不維持 Gateway 綠燈；遊戲／管理指令走 HTTP interactions。詳見[公告](casino-announcements.md)。

## 資料與交付條件

- 正式帳本於 2026-10-30 以全新來源啟用，未帶入測試餘額／簽到／歷史；測試資源保留。更新不得重新 seed、重編帳本或重設用量。
- 服務帳號 `circus-wallet-production@jokers-circus-production.iam.gserviceaccount.com` 使用 `roles/datastore.user`；Firestore 規則拒絕用戶端直接存取。
- 金鑰保存在 Worker Secrets 與 `C:/Users/nini9/.config/jokers-circus-production/`，目錄限目前使用者及 SYSTEM；不得進版控。
- 初次空白帳本備份已做隔離還原，證據在 `backups/production-cutover-20261030/empty-baseline-restore-verified/`；這不等於正式玩家交易重播驗收。
- 隔離測試涵蓋單群、60 錢包與 5 人並行，不能當作連線容量或正式 RTO 保證；恢復以最後成功快照為準。

發布前完成 [verify:ci](testing.md)、檢查提交與部署版本一致、保留原綁定／Secrets，再核對 health／ready／備份。真人登入、跨裝置、新手只發一次、簽到、下注、出入場及手機音效仍需實機驗收。

日常操作見[部署](deployment.md)，事故處理見[恢復](recovery.md)，憑證與相依維護見[資料保護](security.md)。

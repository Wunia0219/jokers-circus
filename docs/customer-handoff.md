# 正式服交付

正式遊戲與監控版本 **1.0.2**，發行分支 `main`。2026-11-05 已由本機驗證產物部署備份續作、移除 Firestore 免費額度八成推播與通知防重複修正，版本號不變；使用者另行 commit／merge，未 push，遠端 CI 尚未驗證本次修改。CI 不會自動部署。

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
| 2026-11-05：1.0.2 免費額度通知退役／防重複（目前） | `a3dd6044-f10d-4cb1-a68d-9ee0f482e801`／`800a89de-529b-4763-8ba0-95bcc99c5903` | `test-results/notification-policy-release/`：完整驗證、反向測試、前後綁定、100% 版本與用量／備份保留核對 |
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

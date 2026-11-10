# 正式服交付

來源版本以 `package.json` 為準，線上版本另以 health 與部署紀錄核對。正式服提供老虎機與戲籌管理；野球拳、CG 和雙遊戲大廳僅部署獨立測試服。Git 合併、CI 與部署分開處理，CI 不自動發布。

## 發布基準與證據

1.0.3 加入管理員發放戲籌的通知選項，預設不通知；明確選擇後只在正式遊玩頻道 @ 收款玩家，公開數量與原因、不公開餘額。正式建置以模組圖及產物檢查排除野球拳與測試入口，發布稽核見[部署](deployment.md)。

| 已記錄發布 | 遊戲／監控版本 ID | 證據 |
|---|---|---|
| 2026-11-06：測試指令整合後的正式隔離核對 | `fdae6a33-2e1d-490f-95b7-9cee20bcb6dc`／該次未記錄新的監控 ID | `test-results/branch-commands-release/` |
| 2026-11-06：1.0.3 發放通知 | `ca09a534-259d-492c-a337-2523a63015eb`／`8e01731f-aa16-43ad-8024-2af3eff7349c` | `test-results/release-1.0.3/` |
| 2026-11-05：免費額度推播退役／通知防重複 | `a3dd6044-f10d-4cb1-a68d-9ee0f482e801`／`800a89de-529b-4763-8ba0-95bcc99c5903` | `test-results/notification-policy-release/` |
| 2026-11-05：備份續作修正 | `6016afa3-65b3-4dcf-8393-227c2fff6026`／`24ad0fa8-2130-4d78-a045-9c9ecb9a383f` | `test-results/backup-fix-release/` |

以上是保存的發布記錄，不代表本次線上查核。較早部署見 Git 歷史；不可將歷史 ID 直接當成可回退清單，必須保留[新舊帳本格式相容性](settlement-storage.md#啟用與回復)。本機驗證、遠端 CI 與真人驗收各自記錄，歷史通過數量不作為目前程式的通過證明。

2026-11-05 的有效備份曾完成下載、解密、全新 SQLite 還原與 28 個錢包／18,264 筆原請求重播；證據位於 `backups/backup-fix-20261105/after-drill/`。這是禁止連外的隔離演練，不是正式資料回灌。備份續作、容量與通知政策集中於[恢復](recovery.md)及[監控](monitoring.md)。

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

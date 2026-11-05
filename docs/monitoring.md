# 監控與用量

| 監控 | 執行位置 | 資料與通知 |
|---|---|---|
| 遊戲健康 | `jokers-circus-monitor`，每 10 分鐘 | 唯讀 DO 狀態、備份、alarm；Firestore 用量保留記錄，不發免費額度八成提醒 |
| Cloudflare 用量 | GitHub `cloudflare-usage.yml`，每 15 分鐘 | 官方帳戶彙總；Free 門檻／預測，Paid 每日觀測；API 故障／恢復 |

兩者都不下注、不修改帳本。2026-11-05 使用者明確要求移除 Firestore 免費額度達八成提醒：整體、備份維護與得獎公告的讀寫、流量、儲存保守估算及百分比仍保留，但不再產生 `QUOTA_HIGH`。備份實體容量八成、用量資料無效及保護模式真正耗盡仍告警。Cloudflare 方案與 Firestore `notify-only` 仍是不同設定，遊戲健康條件見[部署](deployment.md#獨立監控)。

遊戲健康通知以「告警代碼、嚴重度、範圍」分別保存事件，個別異常連續兩次才確認；新增異常只通知新增項目，部分恢復不重貼其他警告。同項異常需連續消失至少 30 分鐘才重新準備提醒；同類排程、備份健康或備份容量告警另共用六小時送出冷卻，錯誤代碼切換、重啟及短期反覆恢復不會繞過。同類從提醒升級成嚴重仍可通知，其他獨立異常也不受影響。全部正常持續 30 分鐘後才發一次服務恢復。

舊 `QUOTA_HIGH` 收據與待送重試原地退役，混合訊息中的其他異常及未知送出結果仍保留；取消免費額度通知不補發遲到的恢復訊息。429 遵守供應商期限，連續限流再加一分鐘至一小時的指數退避，換告警內容也不能縮短等待。blocked／uncertain 及送出前保存意圖的保護保留，不盲目重貼。私有狀態提供 `lastAttemptAt`／`lastNotificationAt`，可唯讀核對升級後是否新增送出，不含 webhook 或訊息內容。

## 外部排程設定

在 [GitHub Actions 設定](https://github.com/Wunia0219/jokers-circus/settings/secrets/actions) 配置：

| 類型 | 名稱 | 值 |
|---|---|---|
| Variable | `CF_ACCOUNT_ID` | 遊戲的 Cloudflare Account ID |
| Secret | `CF_ANALYTICS_TOKEN` | 該帳戶的 Account Analytics → Read 專用 token |
| Secret | `CF_USAGE_DISCORD_WEBHOOK` | 私人維護頻道 webhook，勿用遊戲公告頻道 |

Workflow 的 `CLOUD_PLAN` 已設 `paid`（2026-10-31 使用者確認）；CLI 必須明確提供 `CLOUD_PLAN=free|paid`，不猜測方案。`node scripts/cloud/cloudflare-usage.js dry-run` 只查詢與輸出摘要，不發通知。憑證不得放入 Git、聊天、前端，亦不可用 Wrangler OAuth 代替長期監控 token。[token 權限](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)

排程只在預設分支執行，PR 不取得 Secrets。合併後用 **Actions → Cloudflare usage → Run workflow** 驗證；正常狀態安靜，表格保存在 run Summary。Secrets 存在不代表內容或權限已驗證。

監控以固定 repository ID `1424023431` 限定原儲存庫，歷史通知附件也以 ID 核對來源，改名後沿用同一份通知狀態，fork 不能冒用。GitHub 改名為 `jokers-circus` 前，須先將此修正合併至預設分支，避免排程仍用舊名稱判斷而跳過。改名後更新本機 `origin` 並確認新的預設分支監控執行成功；不重建儲存庫、不重設通知狀態，也不變更正式 Worker、Discord 入口或資料庫。

## Free 與 Paid 判斷

- **Paid（現行）**：顯示 UTC 當日 Worker／DO 請求、SQL 讀寫、DO 活躍時間與近 24 小時儲存峰值合計；只通知用量 API 故障與恢復，不發 Free 耗盡警示。未量測月累計、Worker CPU 或 GB-month，付費內含量與帳單查 Cloudflare Billing。
- **Free（相容）**：Worker／DO 各 100,000 次／日，SQL 讀 5,000,000／寫 100,000 列／日，DO 13,000 GB-s／日，儲存 5 GB。80%、90%、100% 各通知一次；最近最多一小時速率預測會在重設前耗盡時提醒，至少觀察 15 分鐘。
- Free 每日窗口為 UTC 午夜至午夜（台灣 08:00 重設）；儲存不每日歸零，低於 70% 才重新準備提醒。官方值可能延遲，預測不是帳單。
- 切換 Free → Paid 取消尚未送出的 Free 額度重試；API 故障狀態仍保留。方案變更不能讓結果不明的舊訊息再次送出。

指標含同帳戶所有應用，Firestore 文件數不能替代 SQL 列數。來源：[Workers](https://developers.cloudflare.com/workers/platform/pricing/)、[DO](https://developers.cloudflare.com/durable-objects/platform/pricing/)；價格集中於[費用文件](cloudflare-costs.md)。

## 發送與故障處理

`monitor/usage/analytics.js` 查官方 API，`policy.js` 判斷方案，`notifications.js` 維護去重狀態；`monitor/discord.js` 負責發送分類。API 錯誤顯示「用量未知」，不當成零。

通知意圖先存 artifact，成功後才 POST，完成狀態再保存（保留 7 天）。429 到期重新查風險；過時提醒取消。逾時／5xx／中斷保存 `uncertain`，不盲目重貼；`blocked`／`uncertain` 須核對頻道及 webhook，勿刪狀態強制重送。歷史或狀態缺損讓 workflow 失敗，應啟用 Actions 失敗通知作備援。

GitHub 排程可能延遲，公開 repo 60 天無活動可停用排程；需確認最近成功時間。[排程限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) 標準公開 runner 與 artifact 儲存分開計算，見 [GitHub 計費](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。

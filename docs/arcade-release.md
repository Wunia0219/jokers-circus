# 雙遊戲正式服接入

## 發布前

1. 在隔離環境執行 `npm run verify:ci` 與 `node scripts/qa/arcade-release.js`。用有舊餘額、簽到和轉輪紀錄的測試帳號演練換版、原請求重送與備份還原。舊頁面轉動時切換入口，確認已受理的轉輪可以收尾，結算只發生一次。
2. 留存前一版實際部署的 `dist`。以正式 Discord Application ID 設定 `VITE_DISCORD_CLIENT_ID`，執行 `npm run arcade:build -- --legacy <前一版 dist 路徑>`。輸出在 `dist-arcade`，並保留舊版雜湊素材供仍開著的老虎機頁面使用。原本的 `dist` 仍供單遊戲建置使用。
3. 沿用既有的正式 Discord App、Worker、DO 和 Firestore v2 命名空間。在本機正式 Wrangler 設定加入 `ARCADE_RELEASE_ENABLED="true"`。為營運後台建立一把獨立的 32 位元組隨機金鑰，將 64 字元的十六進位值存入 Worker 的 Secret `ARCADE_CONSOLE_TOKEN`，並由維護者保管。
4. 將正式 `assets.directory` 設為 `./dist-arcade`、`assets.run_worker_first` 設為 `true`，`html_handling` 和 `not_found_handling` 設為 `"none"`。揭曉前必須由 Worker 先拒絕玩法頁面、程式與素材，包含變形路徑。正式大廳與野球拳分開建置，預告階段只載入預先模糊化的 WebP。
5. 依序執行 `npm run cloud:build`、`node scripts/qa/operator-console.js` 與 `node scripts/qa/production-release.js --arcade`，驗證後台操作並核對部署設定。先備妥最新可還原快照，發布後核對 `/readyz`、`/api/arcade` 和實際 Discord 大廳。全新接入的營運狀態是老虎機開放、野球拳隱藏。此時直開野球拳頁面、素材和 API 應收到 404。

同源素材在正式配置下先經 Worker 路由，這些請求會計入 Worker 用量。大廳只在可見時更新狀態，並在回大廳時立即刷新。營運狀態查詢只讀 DO。揭曉後已載入的雜湊素材可由瀏覽器快取。 [Cloudflare 靜態素材路由與用量](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## 營運面板

在一般瀏覽器開啟 Worker 網址的 `/operator`，貼上專用管理金鑰。頁首會顯示正式或測試環境。每次變更前可先閱讀玩家會受到的影響，確認後由伺服器核對入口狀態。

| 遊戲 | 選項 | 玩家行為 |
|---|---|---|
| 老虎機 | 開放／維護 | 維護時停止新回合。已入帳的原請求仍可確認，原本已開的頁面也能完成當局。 |
| 野球拳 | 預告隱藏 → 揭曉 → 暫停新場次／重新開放 | 揭曉前只有「即將揭曉」。開放後顯示原圖和名稱。暫停時可看紀錄與續玩已付費的場次。 |

揭曉與暫停可直接操作面板，約 15 秒內更新已開啟且可見的大廳。已揭曉後需要止血時使用「暫停新場次」。DO 重啟會保留狀態。重建全新的 DO 時會從預告隱藏開始，由營運管理員重新確認狀態後開放。

兩款遊戲沿用同一位玩家的 Firestore v2 錢包及週簽到。野球拳的入場、出拳、離場、派彩與收藏進度可用原請求重播。平手不扣戲籌，會保存出拳進度。備份用收據重建場次和收藏，並核對權威錢包的校驗值。正式野球拳會在收到權威結果後翻牌。

現有公開 CG 下載站仍可由既有外部連結開啟。正式大廳直到揭曉才會載入可接觸遊戲下載功能的程式。

## 玩家遇到扣款或派彩回應中斷

1. 請玩家保留原畫面。老虎機再按 SPIN 確認上一局，野球拳按畫面上的重試，或重新載入同一活動視窗讓遊戲恢復原請求。
2. 記下玩家、台灣時間和畫面上的 `S-`（老虎機）或 `D-`（野球拳）回報碼。請透過私訊或私下支援管道收集。
3. 在後台的 **查詢玩家回報** 貼上使用者 ID 和回報碼，再按 **取回原結果**。查到結果時可核對原紀錄、時間和前後餘額，並複製回覆給玩家。查無紀錄時，先確認身分、時間和回報碼，讓玩家以同一操作再次確認。 [Discord 使用者 ID 說明](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID)
4. 若同時有多名玩家回報，先關閉受影響遊戲的入口。到 **備份與服務恢復** 查看上次成功時間，可手動更新備份並核對完整性。看到服務就緒後可重新開放入口。

玩家重試會沿用原請求 ID。後台查詢、核對備份皆為唯讀。需要更換資料來源或還原整份帳本時，依正式的 [備份與恢復流程](recovery.md) 進行。

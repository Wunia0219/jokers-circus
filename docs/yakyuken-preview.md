# 野球拳：流程、資料與開發入口

本文件描述目前實作；逐次畫面調整、舊原型與歷史測試日誌可從 Git 歷史追溯。角色機率見[機率規則](yakyuken-probability.md)，Discord 設定見[獨立測試活動](discord-test-activity.md)，完整驗證見[測試文件](testing.md)。產品版本維持 1.0.3。

## 執行模式

| 模式 | 入口 | 身分、錢包與紀錄 |
|---|---|---|
| 本機預覽 | `node scripts/game/yakyuken-preview.js` | 訪客；不扣款、不發獎，CG／紀錄保存在 localStorage |
| 合成帳號雲端測試 | 同指令加 `--cloud-test` | 同源私有閘道連專用測試 Worker；`qa-a`／`qa-b`／`qa-low`／`qa-zero` |
| Discord 測試活動 | `scripts/game/discord-test.js` 與獨立測試 shell | 真正 Discord 授權；每群每人一個測試錢包，老虎機與野球拳共用餘額及簽到 |

本機入口為 `http://127.0.0.1:4195/yakyuken-preview.html`，只監聽 loopback。一般模式不讀環境憑證；雲端模式的私有設定存於忽略版控的 `.tools/yakyuken-playtest.json`，不能由瀏覽器讀取。`?testPlayer=qa-b` 僅供合成帳號入口，Discord 身分不能指定其他玩家。

專用測試身分固定為 Firestore project `slot-game-203db`、namespace `yakyuken-playtest-20261105-test`、Worker `jokers-circus-yakyuken-test`。正式 Worker／Firestore 與舊 SQLite `data/validation/wallet.sqlite` 不屬於此資料範圍。修改這些字串不能當作資料遷移方式。

## 遊戲流程

1. 大廳選野球拳，以獨立 Logo／讀條等待素材與 GPU 準備完成，進入選角。目前開放命運荷官、優然與夏澄，其餘兩位準備中。
2. 選角進牌桌採純淡出淡入。雲端先送 `begin`，以原每拳權重預抽整場勝敗平手到終局，和扣 1,000 於同一提交確認後進場；若已有進行中的場次，恢復該場，不再扣款或重抽。無錢包預覽只建立本機紀錄。
3. `begin`／`state`／上一拳 `hand` 回應附帶下一拳固定結果，沒有額外預取請求。選拳頭／剪刀／布後確認，雲端先送附 `handIndex` 的原 `hand`，同時以已備妥結果展示出牌與翻牌，規劃 330ms 完成。尚未確認結算時顯示確認紀錄、鎖住下一拳與派彩；斷線可用原手勢／順序／request ID 重試，過期票券須重新同步，不能另送新拳。沒有預取結果的舊場次先等權威回覆再翻牌。本機使用相同角色權重與勝敗推進函式。命運荷官累積 2 勝通關、獎金 2,500，優然累積 3 勝通關、獎金 5,000，兩位皆於第 2 敗結束。夏澄累積 5 勝通關、獎金 10,000，第 3 敗結束。輸一拳不清除勝數。平手不收費、不改寫場次摘要。
4. 勝利先揭牌、對話與新造型；通關先實際繪製最後造型一幀，再展示 350ms、於 1,200ms 累加獎金，最後停留並淡出 650ms。COINS 與音效跟隨顯示進度，伺服器已一次發獎，演出不再呼叫結算。
5. 勝敗結束均保留結果，由玩家選「再次挑戰」或「返回」選角。再次挑戰才開始新場並扣一次入場費；返回不扣款、不退費。進行中返回大廳需確認，成功 `leave` 後將該場標為離場。
6. 未知網路／提交結果保留原 request ID 與操作內容，鎖住其他財務操作，重試同一筆。重整會先恢復待確認操作，再讀最新錢包；舊 revision 不覆蓋新餘額。已結束場次重載不重播領獎。

領獎、翻牌、換裝與入場期間維持各自的輸入鎖定；縮放與背景恢復不重抽結果。音效、背景音樂可獨立切換，靜音與背景不補播舊聲音；減少動態保留相同結果及結算。老虎機時序依[停輪基準](reel-timing-baseline.md)，不隨野球拳整理變更。

## 後端與資料庫

`TestWalletClient → 同源 API → 測試授權 → 每玩家 Durable Object → PlaytestService → Firestore 交易`。

- Worker 根據已授權身分選擇玩家；Discord 鍵為 `d_<guildId>_<userId>`。DO 將所有該玩家請求序列化，包含兩款遊戲的操作。
- Firestore 文件為 `circus_wallet_v1/<namespace>/players/<player>`，以 `state` JSON 保存 version 1 錢包；文件另有 environment／namespace 身分檢查。
- 錢包包含 balance／revision、最近 100 場摘要、activeId、每角色最高 CG 解鎖、週簽到、老虎機近期歷史與最後開轉時間。單場包含入場費、獎金及淨變化，不累計平手次數。進行中新場另存私有 `duelPlan`，只供伺服器推進，不包含在公開錢包或場次歷史，終局／離場移除。
- 只有伺服器決定每拳結果與獎金。`characters.js` 是規則唯一來源；`challengeProgress()` 共用勝敗門檻，錢包層處理扣費／發獎。請求與場次編號必須是 16–80 字元字串，不接受陣列或數字的隱式轉換。
- 有變更的操作先將抽樣結果與原請求存為 DO `pending`，再交易讀取並更新玩家文件。Firestore `lastReceipt` 識別已成功但回應遺失的提交，避免重扣／重發；最後在同一 DO storage transaction 保存 `receipt:<requestId>` 並刪除 pending。
- 原請求重播回傳當時收據；相同 ID 改動操作內容會拒絕。前端的恢復、明確重試與 refresh 共用一個進行中請求，不重複發送。
- 新場 DO 的 `hand-cursor` 和每拳收據於同一 storage transaction 推進；決勝拳先沿用 Firestore `pending` 恢復契約，再原子保存游標和收據。平手只推進 DO 游標及收據，熱對局不讀寫 Firestore；冷啟動需先讀一次玩家文件。紀錄、解鎖與餘額由同一交易更新，沒有額外的背景輪詢或推播。只持有未來單拳結果不能跳拳、改序或提交自訂勝敗；舊請求回應不倒退前端已預取的順序。
- DO 收據保留完整原回應，尚無到期清除機制；最近 100 場上限只作用於錢包摘要。不能直接刪除收據，否則會破壞舊請求去重；擴展長期用量前需另行設計收據保存與恢復策略。

不需新增索引或遷移。維護不刪除玩家帳本、舊相容紀錄、備份或私有設定。

## 本機紀錄、CG 與素材

`PlayerArchive` 使用 `jokers-circus:yakyuken:archive:v1:<player>:`；每場與每張 CG 各自一鍵，讓不同分頁不覆寫其他場次。存檔損壞僅忽略該項，容量／權限失敗仍保留可讀資料與本頁暫存。舊紀錄缺 reward 時依當時狀態補讀，舊 draws／rounds 欄位不再寫回。

CG 收藏可獨立切換荷官、優然與夏澄，顯示各自的解鎖進度；尚未解鎖的格子只顯示條件。首次遊玩的三位角色共 13 張皆上鎖。入場只解鎖當前角色的初始 CG，每勝一次解鎖下一張，命運荷官共三張，優然共四張，夏澄共六張。點選已解鎖卡片查看全身原構圖，可用畫面按鈕或左右方向鍵切換同角色的已解鎖圖片。收藏回顧不更改牌桌進度。歷史使用可捲動、可展開的單場清單。普通本機重載不續玩原場；測試雲端可由伺服器恢復未完成場次。

牌桌使用 `images/yakyuken/{dealer,youran,xiache}/` 的 WebP。荷官與優然的各階段採用同一個 1024×1536 畫布，上身對齊中央，鞋底共用同一基準；只平移圖像，不裁切或單獨縮放。三位角色共十三張 1024×1536 透明 PNG 位於 `public/downloads/yakyuken/`，供玩家下載，不納入牌桌預載。下載版保留核定原圖的構圖；荷官的 PNG 也可由 `scripts/assets/export-yakyuken-cg.py` 以相同像素重建。

`cg-catalog.js` 統一圖片名稱、檔名與公開路徑。本機下載先核對解鎖；Discord 透過官方外部連結開啟 [CG 下載站](https://jokers-circus-gallery.pages.dev)，玩家可取消。該站是公開靜態圖片服務，沒有錢包或授權資料。

## 模組責任

| 位置 | 責任 |
|---|---|
| `main.js`、`scene.js` | 入口、生命週期、畫面及互動協調 |
| `characters.js`、`rules.js`、`challenge.js` | 角色資料、手勢勝負、加權抽樣、共用勝敗推進與機率驗算 |
| `test-wallet-client.js` | 測試身分、原請求保存與單一送出鎖、授權恢復、revision 防倒退 |
| `player-archive.js` | 本機玩家分區紀錄、相容讀取與 CG 解鎖 |
| `reward-presentation.js`、`reward-audio.js`、`audio.js` | 領獎時序與聲音，不處理財務結算 |
| `pixi/lobby*`、`layout.js`、`chrome.js`、`dialogs.js` | 大廳、選角、牌桌排版與介面 |
| `pixi/card*`、`motion.js`、`wardrobe-transition.js` | 卡牌、實際 elapsedMS 動畫與換裝資源 |
| `pixi/entry-loading.js`、`entry-state.js`、`screen-fade.js` | 入場準備、錯誤恢復與純轉場 |
| `pixi/archive-dialogs.js`、`match-history.js`、`cg-*.js` | 收藏、紀錄與圖片下載 |
| `cloud/yakyuken-playtest-core.js` | 權威錢包、交易意圖、去重及恢復 |
| `cloud/yakyuken-playtest-worker.js` | HTTP、授權路由、DO 序列化與 Firestore adapter |

舊 `state.js`／`controller.js`、固定輪替的 `pixi/demo-duel.js`、HTML 原型的 `presentation.js`／`icons.js`／圖片預載函式與公平猜拳試算已移除；現行角色引擎及其獨立機率驗算保留。

## 驗證

使用 `.node-version` 指定工具鏈；Windows 啟用方式見 [README](../README.md#開發與驗證)。

| 指令 | 範圍 |
|---|---|
| `node --test tests/yakyuken*.test.js` | 規則、原請求恢復／併發、扣款發獎、機率、紀錄、呈現與排版 |
| `node scripts/qa/yakyuken-cloud-test.js` | 隔離瀏覽器錢包、平手零存取、重試、續玩與閘道邊界 |
| `node scripts/qa/yakyuken-reward.js` | 造型先於領獎、金額音效同步、縮放／背景恢復及結束操作 |
| `node scripts/qa/yakyuken-preview.js` | 完整本機 UI、導航、素材生命週期、收藏與紀錄 |
| `node scripts/qa/cg-responsive.js` | 14 尺寸與原圖下載 |
| `node scripts/qa/test-firestore.js tests/yakyuken-playtest.integration.js` | 官方 emulator＋真正 workerd 的交易、隔離與重啟 |
| `npm run verify:ci` | 完整本機回歸；與遠端 Actions 結果分開報告 |

手動預覽與部分 QA 共用連接埠，執行前確認 `docs/testing.md` 的說明。所有預設測試使用隔離資料；`yakyuken-cloud-test.js --live` 會操作遠端測試玩家 B，必須明確選用。此次維護不自動執行部署、正式資料清理、commit 或 merge。

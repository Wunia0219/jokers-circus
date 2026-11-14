# 野球拳：流程、資料與開發入口

本文件描述目前實作；逐次畫面調整、舊原型與歷史測試日誌可從 Git 歷史追溯。角色機率見[機率規則](yakyuken-probability.md)，Discord 設定見[發布與環境](arcade-release.md)，完整驗證見[測試文件](testing.md)。產品版本以 `package.json` 為準。

## 執行模式

| 模式 | 入口 | 身分、錢包與紀錄 |
|---|---|---|
| 本機預覽 | `node scripts/preview/yakyuken.js` | 訪客；不扣款、不發獎，CG／紀錄保存在 localStorage |
| 合成帳號雲端測試 | 同指令加 `--cloud-test` | 同源私有閘道連專用測試 Worker；`qa-a`／`qa-b`／`qa-low`／`qa-zero` |
| 現行 Discord 雙遊戲 | `scripts/build/arcade-release.js`、`src/platform/arcade-lobby.js` | 正式／測試各自的 Discord App 與 Firestore v2 帳本；同環境的兩款遊戲共用餘額與簽到 |
| 舊 Discord 隔離測試 | `scripts/cloud/discord-test.js` 與獨立測試 shell | 舊每玩家 DO；僅供隔離 QA 與回退，見[歷史文件](history/discord-test-activity.md) |

本機入口為 `http://127.0.0.1:4195/yakyuken-preview.html`，只監聽 loopback。一般模式不讀環境憑證；雲端模式的私有設定存於忽略版控的 `.tools/yakyuken-playtest.json`，不能由瀏覽器讀取。`?testPlayer=qa-b` 僅供合成帳號入口，Discord 身分不能指定其他玩家。

舊合成帳號測試身分固定為 Firestore project `slot-game-203db`、namespace `yakyuken-playtest-20261105-test`、Worker `jokers-circus-yakyuken-test`。正式 Worker／Firestore 與舊 SQLite `data/validation/wallet.sqlite` 不屬於此資料範圍。修改這些字串不能當作資料遷移方式。

## 遊戲流程

1. 大廳選野球拳，以獨立 Logo／讀條等待素材與 GPU 準備完成，進入選角。可挑戰命運荷官、優然、夏澄、瑟洛與萬世。
2. 選角進牌桌採純淡出淡入。雲端先送 `begin`，以原每拳權重預抽整場勝敗平手到終局，和扣 1,000 於同一提交確認後進場；若已有進行中的場次，恢復該場，不再扣款或重抽。無錢包預覽只建立本機紀錄。
3. `begin`／`state`／上一拳 `hand` 回應附帶下一拳固定結果，沒有額外預取請求。選拳頭／剪刀／布後確認，雲端先送附 `handIndex` 的原 `hand`，同時以已備妥結果展示出牌與翻牌，規劃 330ms 完成。尚未確認結算時顯示確認紀錄、鎖住下一拳與派彩；斷線可用原手勢／順序／request ID 重試，過期票券須重新同步，不能另送新拳。沒有預取結果的舊場次先等權威回覆再翻牌。本機使用相同角色權重與勝敗推進函式；各角色勝敗門檻及獎金見[角色規則](yakyuken-probability.md)。輸一拳不清除勝數，平手不收費、不改寫場次摘要。
4. 勝利先揭牌、對話與新造型；通關先實際繪製最後造型一幀，再展示 350ms、於 1,200ms 累加獎金，最後停留並淡出 650ms。COINS 與音效跟隨顯示進度，伺服器已一次發獎，演出不再呼叫結算。
5. 勝敗結束均保留結果，由玩家選「再次挑戰」或「返回」選角。再次挑戰才開始新場並扣一次入場費；返回不扣款、不退費。進行中返回大廳需確認，成功 `leave` 後將該場標為離場。
6. 未知網路／提交結果保留原 request ID 與操作內容，鎖住其他財務操作，重試同一筆。重整會先恢復待確認操作，再讀最新錢包；舊 revision 不覆蓋新餘額。已結束場次重載不重播領獎。

領獎、翻牌、換裝與入場期間維持各自的輸入鎖定；縮放與背景恢復不重抽結果。音效、背景音樂可獨立切換，靜音與背景不補播舊聲音；減少動態保留相同結果及結算。老虎機時序依[停輪基準](reel-timing-baseline.md)，不隨野球拳整理變更。

## 後端與資料庫

現行路徑為 `ProductionDuelWallet → 大廳共用的授權 fetch → /api/feature/* → CircusProject DO → FirestoreWalletCore`。正式與測試使用同一份後端程式，各自的 App、DO、namespace、Secrets 與備份保持隔離。早期 `TestWalletClient`／每玩家 DO 的規格見[舊測試活動](history/discord-test-activity.md)，不代表現行服務。

- Firestore v2 的 `wallets` 保存玩家餘額、revision 與 `duel`（最近 100 場、各角色最高解鎖與進行中場次）。`operations` 保存原請求收據，`ledger` 保存扣費／派彩；收據不隨近期摘要裁切。
- `settlement-rules-v1.js` 保存權威結算規則，`characters.js` 加入角色名稱及呈現資料；`challenge.js` 共用勝敗推進。入場、出拳與離場經權威交易及原請求去重，不能從前端提供勝敗或跳過手數。
- 入場解鎖該角色初始 CG；每次獲勝更新最高解鎖。正式收藏依權威進度，只有測試環境可啟用全 CG 預覽；預覽不寫進度或餘額。
- 公開回應由 `duelView` 移除私有挑戰計畫，只提供目前場次與下一手的編號。現行正式 client 在缺少預取結果時等待權威回覆；舊測試引擎的單拳預取／平手零 Firestore 讀寫不可套用為現行正式後端保證。
- `ProductionDuelWallet` 以環境、群、玩家、walletEpoch 分區保存待確認請求；網路結果不明沿用原 ID，舊 revision 不覆蓋新狀態。大廳代管 Discord SDK 與授權更新，遊戲切換不重建登入。
- 隱藏／維護開關由同一 DO 保存；後端阻擋新操作，同時允許已提交的原收據重播。備份與恢復重播野球拳收據並核對解鎖與權威餘額。

本次不新增帳本 schema 或遷移，不刪除歷史收據。現行服務與舊測試資料不可透過修改 namespace 字串互換。

## 本機紀錄、CG 與素材

`PlayerArchive` 使用 `jokers-circus:yakyuken:archive:v1:<player>:`；每場與每張 CG 各自一鍵，讓不同分頁不覆寫其他場次。存檔損壞僅忽略該項，容量／權限失敗仍保留可讀資料與本頁暫存。舊紀錄缺 reward 時依當時狀態補讀，舊 draws／rounds 欄位不再寫回。

CG 收藏可獨立切換荷官、優然、夏澄、瑟洛與萬世，顯示各自的解鎖進度。每個視窗尺寸共用固定的卡片與縮圖尺寸，張數超過當頁容量就翻頁；尚未解鎖的格子只顯示條件。首次遊玩的五位角色共 31 張皆上鎖。入場只解鎖當前角色的初始 CG，每勝一次解鎖下一張，命運荷官共三張，優然共四張，夏澄共六張，瑟洛共八張，萬世共十張。點選已解鎖卡片後，在活動視窗中以最大可用尺寸顯示全身原構圖，不裁切；上方保留「下載原圖」。可用畫面按鈕或左右方向鍵切換同角色的已解鎖圖片，返回時會回到目前圖片所在的頁面。收藏回顧不更改牌桌進度。歷史使用可捲動、可展開的單場清單。普通本機重載不續玩原場；現行正式／測試雲端皆由伺服器恢復未完成場次。

測試服啟用 `ARCADE_CG_PREVIEW_ALL` 時，所有通過 Discord 測試服登入的玩家都可預覽 31 張 CG。這個設定只控制收藏的顯示和下載，不寫入通關進度或戲籌帳本。測試服優然終幕的浴巾版 PNG 由測試 Worker 提供，和牌桌及收藏使用的 WebP 採同一構圖。

CG 收藏外框與老虎機「遊戲規則」使用同一套尺寸、圓角、標題列、關閉鈕、Logo 與分頁規格。兩者以安全區內的可用畫面置中，切換收藏角色或分頁時外框尺寸不變。很矮的視窗會縮短 CG 的內容區，單張大圖仍使用獨立的全畫面檢視。大圖的「下載原圖」使用簡潔的單線圓角框，與關閉鈕保留 16 px（窄視窗）或 22 px（其他視窗）的間隔。

牌桌使用 `images/yakyuken/{dealer,youran,xiache,selo,wanshi}/` 的 WebP。荷官與優然的各階段採用同一個 1024×1536 畫布，上身對齊中央，鞋底各自共用同一基準。荷官只以平移對齊。新版優然四張採同一縮放比例，鞋底對齊至 y=1505（透明度至少 128，座標不含該列）。五位角色共 31 張 1024×1536 透明 PNG 位於 `public/downloads/yakyuken/`，供玩家下載，不納入牌桌預載。荷官的 PNG 也可由 `scripts/assets/export-yakyuken-cg.py` 以相同像素重建。

萬世以藍寶石蝴蝶領針、毛領披肩及全套高訂禮裝入場。先卸下領針、手套，再逐步卸下披肩、外套和背心。解開絲質襯衫並收起耳飾後，第八勝解開銀髮，第九勝褪下襯衫，保留黑色皮帶、高訂西裝褲與黑色繫帶皮鞋。十張立繪共用 1024×1536 透明畫布、全身構圖、冷白膚色與冷淡無笑意的神情，牌桌使用與收藏下載版同構圖的 WebP。

夏澄第六張依第五張調整頭肩和腿部比例，保留貝殼及泡泡。新版 PNG 與 WebP 使用同一構圖，兩張的可見頭頂和腳底在 1024×1536 畫布上分別對齊 y=17 與 y=1521（透明度閾值 180，底部座標不含該列）。

`cg-catalog.js` 統一圖片名稱、檔名與公開路徑。本機下載先核對解鎖；Discord 透過官方外部連結開啟 [CG 下載站](https://jokers-circus-gallery.pages.dev)，玩家可取消。該站是公開靜態圖片服務，沒有錢包或授權資料。

## 模組責任

| 位置 | 責任 |
|---|---|
| `main.js`、`scene.js` | 入口、生命週期、畫面及互動協調 |
| `characters.js`、`rules.js`、`challenge.js` | 角色資料、手勢勝負、加權抽樣、共用勝敗推進與機率驗算 |
| `production.js`、`production-wallet.js` | 現行雙遊戲入口、權威收藏、授權請求與原操作恢復 |
| `test-wallet-client.js`（舊隔離測試） | 測試身分、原請求保存與單一送出鎖、授權恢復、revision 防倒退 |
| `player-archive.js` | 本機玩家分區紀錄、相容讀取與 CG 解鎖 |
| `reward-presentation.js`、`audio.js` | 領獎時序與聲音，不處理財務結算 |
| `pixi/lobby*`、`layout.js`、`chrome.js`、`dialogs.js` | 大廳、選角、牌桌排版與介面 |
| `pixi/card*`、`motion.js`、`wardrobe-transition.js` | 卡牌、實際 elapsedMS 動畫與換裝資源 |
| `pixi/entry-loading.js`、`entry-state.js`、`screen-fade.js` | 入場準備、錯誤恢復與純轉場 |
| `pixi/archive-dialogs.js`、`match-history.js`、`cg-*.js` | 收藏、紀錄與圖片下載 |
| `server/wallet/duel-settlement.js`、`server/firestore/wallet-core.js` | 現行正式／測試的權威結算與收據 |
| `cloud/yakyuken-playtest-core.js`（舊隔離測試） | 權威錢包、交易意圖、去重及恢復 |
| `cloud/yakyuken-playtest-worker.js`（舊隔離測試） | HTTP、授權路由、DO 序列化與 Firestore adapter |

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

手動預覽與部分 QA 共用連接埠，執行前確認 `docs/testing.md` 的說明。所有預設測試使用隔離資料；`yakyuken-cloud-test.js --live` 會操作遠端測試玩家 B，必須明確選用。一般 QA 不執行部署或資料清理；Git 與雲端發布依當次授權範圍操作，發布步驟見[發布文件](arcade-release.md)。

# 野球拳：純 Pixi 牌桌框架

目前優先驗收畫面與操作。整個遊戲只使用一個 Pixi Canvas，沒有 HTML 網頁版的主視覺、卡片、按鈕或 dialog。荷官以固定展示順序出牌並演示猜拳勝負；正式機率、入場費、獎勵與錢包暫不接入，原型不讀寫舊試玩帳本，也不連接 Discord。

使用者指定後續錢包驗收沿用舊的本機測試資料庫。本機既有路徑為 `data/validation/wallet.sqlite`（見 `scripts/qa/validation-server.js` 與 `docs/testing.md`）；本次僅核對檔案存在，沒有開啟、重設或改寫它。錢包接線前仍須核對測試入口指向此舊庫，不能改接正式庫或另建一份取代。

## 場景與風格

- 直接沿用老虎機的 `images/jokers-circus/circus-background.webp`，維持深藍舞台、酒紅布幕與金色裝飾。
- 第一人稱坐在桌前，荷官位於桌緣另一側，桌面遮住人物下半身。
- 近處玩家三張牌較大，遠處荷官三張牌較小；雙方各有拳頭、剪刀、布，共六張。
- 桌面、桌緣、飾線、牌面、手勢圖示、文字、視窗與按鈕都由 Pixi Sprite／Graphics／Text／Container 繪製。
- 螢幕直橫向與尺寸改變時重新計算位置，不使用捲動頁面。CSS 只負責全畫面容器與 Canvas 的基本尺寸。
- Pixi 官方 accessibility 系統提供透明輔助層支援鍵盤與讀屏，沒有另外一套可見的 DOM 遊戲介面。

## 可操作範圍

1. 點選玩家牌，顯示抬牌與金框；鍵盤 1／2／3 分別選拳頭／剪刀／布。
2. 按「確認出牌」或 Enter，先鎖定玩家牌，接著荷官選中的牌會亮起、抬起，其餘兩張轉暗，再揭曉雙方牌與勝負。
3. 按「下一局」重設兩方手牌。展示時荷官依剪刀、拳頭、布循環，與玩家選牌無關；不是正式機率模型，不扣款或發獎。
4. 左上選單可進入荷官與造型、說明與設定；右上也有說明與設定入口。Esc 關閉視窗，沒有視窗時開啟選單。
5. 造型圖鑑可預覽三張既有荷官原畫。畫面中央的徽章遮住人物換圖，暫不綁定勝場。
6. 設定可切換音效、減少動態效果與全螢幕；全螢幕仍取決於瀏覽器支援。

## 模組

- `src/games/yakyuken/main.js`：唯一遊戲入口與頁面生命週期。
- `src/games/yakyuken/scene.js`：Pixi Application、背景／荷官／牌桌組合、選牌狀態、遊戲內視窗與造型展示。
- `src/games/yakyuken/pixi/layout.js`：共用邏輯座標與直橫向配置。
- `src/games/yakyuken/pixi/table.js`：桌布、桌緣、金飾與場景層次。
- `src/games/yakyuken/pixi/card.js`：兩方手牌、手勢、抬牌與命中區。
- `src/games/yakyuken/pixi/ui.js`：Pixi 按鈕、文字、視窗與基本樣式。
- `src/games/yakyuken/pixi/motion.js`：實際 elapsedMS 動畫、替換、暫停與釋放。
- `src/games/yakyuken/pixi/demo-duel.js`：固定展示順序及基本猜拳勝負；每次確認只推進一局，縮放中斷仍揭曉同一結果。
- `assets.js`、`audio.js`：荷官素材與獨立音效。

先前的 `rules.js`、`state.js`、`controller.js` 與相關規則測試暫時保留，當前入口不載入。待使用者確認機率與玩法後再決定如何接入；先前的機率試算不代表本框架的定案規則。

## 開啟與驗證

在專案根目錄以符合 `.node-version` 的 Node 執行 `node scripts/game/yakyuken-preview.js`。Windows 已備妥 `.tools/node-x64/node-v24.22.1-win-x64/node.exe` 可直接使用。

入口為 http://127.0.0.1:4195/yakyuken-preview.html 。只監聽本機，不讀 `.env`。開發相依預先打包與快取獨立於老虎機；正式建置入口與停輪基準沒有變更。

- `node --test tests/yakyuken-pixi.test.js`：牌列邊界、抬牌後不遮住對手、慢幀完成、動畫替換與清理。
- `node scripts/game/yakyuken-preview.js --build`：獨立輸出至忽略版控的 `test-results/yakyuken-preview`。
- `node scripts/qa/yakyuken-preview.js`：單一 Canvas、滑鼠／觸控／鍵盤、視窗輸入鎖定、造型、直橫向、資料隔離、素材失敗與初始化期間清理。證據位於 `test-results/yakyuken-pixi`。
- 完整回歸依 `docs/testing.md` 執行 `npm run verify:ci`；本機與遠端 CI 結果分開報告。

完整回歸的 SDK 隔離測試固定使用 4195，執行前需先關閉此試玩伺服器，檢查完成後再重新啟動。不能同時占用同一連接埠。

### 本機結果（2026-11-02）

- 荷官出牌補完後，獨立 Pixi 建置通過，牌列／動畫／展示勝負測試 5 項通過。
- 試玩瀏覽器檢查 10 項通過，涵蓋桌機、390×844、320×568、844×390、768×1024 與側邊視窗 544×680，並檢查荷官選牌／出牌／揭曉的階段、重複確認與演出中縮放。
- 一般回歸 505 項通過、1 項條件略過。
- 本次完整 `verify:ci` 全部 14 項通過，退出碼為 0。執行 SDK 測試前已停止試玩，該項通過後恢復原網址，沒有連接埠衝突。
- 完整結果為 `test-results/verification.json`；本次退出碼及日誌為 `test-results/yakyuken-pixi/verify-ci-exit.json` 與 `verify-ci.log`。瀏覽器證據為同目錄 `browser-report.json` 與畫面截圖。
- 舊本機測試庫 `data/validation/wallet.sqlite` 的最後修改時間仍為 2026-10-27 20:31:07，本次展示與自動回歸沒有改寫它。
- 未執行遠端 CI。

未部署、未接 Discord、未修改產品版本、未 commit 或 merge。

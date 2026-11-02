# 野球拳：純 Pixi 牌桌框架

目前優先驗收畫面與操作。整個遊戲只使用一個 Pixi Canvas，沒有 HTML 網頁版的主視覺、卡片、按鈕或 dialog。荷官以固定展示順序出牌並演示猜拳勝負；正式機率、入場費、獎勵與錢包暫不接入，原型不讀寫舊試玩帳本，也不連接 Discord。

使用者指定後續錢包驗收沿用舊的本機測試資料庫。本機既有路徑為 `data/validation/wallet.sqlite`（見 `scripts/qa/validation-server.js` 與 `docs/testing.md`）；本次僅核對檔案存在，沒有開啟、重設或改寫它。錢包接線前仍須核對測試入口指向此舊庫，不能改接正式庫或另建一份取代。

## 場景與風格

- 直接沿用老虎機的 `images/jokers-circus/circus-background.webp`，維持深藍舞台、酒紅布幕與金色裝飾。
- 標頭、訪客名稱、工具列、對話框與底部操作盤比照老虎機的尺寸、字級和配色；中文使用 Noto Sans TC／sans-serif，主要英文按鈕沿用 Georgia 粗體加中文副標。標誌、工具圖示與背景音樂使用原有資產，透過 Pixi 繪製。
- 第一人稱坐在桌前，荷官位於桌緣另一側，桌面遮住人物下半身。
- 近處玩家三張牌較大，遠處荷官三張牌較小；雙方各有拳頭、剪刀、布，共六張。
- 卡片為自繪 Pixi 圖案：金色邊框、酒紅布幕、寶石、手套手勢；統一牌背使用小丑冠與 J 徽章，不顯示手勢或索引。荷官三張預設蓋牌，只有出牌的那一張會翻正。
- 桌面、桌緣、飾線、牌面、手勢圖示、文字、視窗與按鈕都由 Pixi Sprite／Graphics／Text／Container 繪製。
- 螢幕直橫向與尺寸改變時重新計算位置，不使用捲動頁面。CSS 只負責全畫面容器與 Canvas 的基本尺寸。
- Pixi 官方 accessibility 系統提供透明輔助層支援鍵盤與讀屏，沒有另外一套可見的 DOM 遊戲介面。

## 可操作範圍

1. 點選玩家牌，顯示抬牌與金框；鍵盤 1／2／3 分別選拳頭／剪刀／布。
2. 按「確認出牌」或 Enter，先鎖定玩家牌，接著荷官選中的牌亮起並抬起。牌背先縮到側邊，於最窄處切換牌面，再展開揭曉；其餘兩張持續蓋牌。減少動態效果時直接顯示同一結果。
3. 按「下一局」重設兩方手牌，荷官恢復三張牌背。展示時荷官依剪刀、拳頭、布循環，與玩家選牌無關；不是正式機率模型，不扣款或發獎。
4. 左上頭像選單可進入荷官與造型、遊戲規則、遊玩紀錄與設定；頂部工具列提供音效、音樂、遊戲規則與紀錄，底部保留造型、出牌和設定。Esc 關閉視窗，沒有視窗時開啟選單。
5. 造型圖鑑可預覽三張既有荷官原畫。畫面中央的徽章遮住人物換圖，暫不綁定勝場。
6. 設定可切換音效、背景音樂、減少動態效果與全螢幕；全螢幕仍取決於瀏覽器支援。音樂預設關閉，由點擊後才載入播放；遊玩紀錄只保存在記憶體，重新整理清除。

## 模組

- `src/games/yakyuken/main.js`：唯一遊戲入口與頁面生命週期。
- `src/games/yakyuken/scene.js`：Pixi Application、背景／荷官／牌桌組合、選牌狀態、遊戲內視窗與造型展示。
- `src/games/yakyuken/pixi/layout.js`：牌桌邏輯座標與直橫向配置；介面用反向縮放保留實際像素字級。
- `src/games/yakyuken/pixi/slot-theme.js`：從老虎機介面比對的字型、尺寸、配色與桌機／觸控操作盤比例。
- `src/games/yakyuken/pixi/chrome.js`、`dialogs.js`：老虎機風格的標頭、操作盤與遊戲內視窗。
- `src/games/yakyuken/pixi/table.js`：桌布、桌緣、金飾與場景層次。
- `src/games/yakyuken/pixi/card.js`：兩方手牌、牌面狀態、抬牌與命中區。
- `src/games/yakyuken/pixi/card-art.js`、`card-flip.js`：自繪正反面與可取消的翻牌序列。
- `src/games/yakyuken/pixi/ui.js`：Pixi 按鈕、文字、視窗與基本樣式。
- `src/games/yakyuken/pixi/motion.js`：實際 elapsedMS 動畫、替換、暫停與釋放。
- `src/games/yakyuken/pixi/demo-duel.js`：固定展示順序及基本猜拳勝負；每次確認只推進一局，縮放中斷仍揭曉同一結果。
- `assets.js`、`audio.js`：荷官素材、獨立音效與既有背景音樂。

先前的 `rules.js`、`state.js`、`controller.js` 與相關規則測試暫時保留，當前入口不載入。待使用者確認機率與玩法後再決定如何接入；先前的機率試算不代表本框架的定案規則。

## 開啟與驗證

在專案根目錄以符合 `.node-version` 的 Node 執行 `node scripts/game/yakyuken-preview.js`。Windows 已備妥 `.tools/node-x64/node-v24.22.1-win-x64/node.exe` 可直接使用。

入口為 http://127.0.0.1:4195/yakyuken-preview.html 。只監聽本機，不讀 `.env`。開發相依預先打包與快取獨立於老虎機；正式建置入口與停輪基準沒有變更。

- `node --test tests/yakyuken-pixi.test.js`：牌列邊界、操作盤字級尺寸、翻牌順序／取消／減少動態、慢幀完成、動畫替換與清理。
- `node scripts/game/yakyuken-preview.js --build`：獨立輸出至忽略版控的 `test-results/yakyuken-preview`。
- `node scripts/qa/yakyuken-preview.js`：單一 Canvas、滑鼠／觸控／鍵盤、荷官蓋牌與只翻一張、下一局蓋牌重設、工具列切換、紀錄視窗、造型、直橫向、資料隔離、素材失敗與初始化期間清理。證據位於 `test-results/yakyuken-pixi`。
- 完整回歸依 `docs/testing.md` 執行 `npm run verify:ci`；本機與遠端 CI 結果分開報告。

完整回歸的 SDK 隔離測試固定使用 4195，執行前需先關閉此試玩伺服器，檢查完成後再重新啟動。不能同時占用同一連接埠。

### 本機結果（2026-11-02）

- 老虎機介面比對與卡片重繪後，獨立 Pixi 建置通過，牌列／介面尺寸／翻牌／動畫／展示勝負測試 8 項通過。
- 試玩瀏覽器檢查 10 項通過，涵蓋桌機、390×844、320×568、844×390、768×1024 與側邊視窗 544×680，並檢查荷官蓋牌／出牌／翻牌／揭曉、下一局蓋牌重設、減少動態效果、工具列音效／音樂狀態、紀錄、重複確認與演出中縮放。翻牌測試實際等到牌背縮至側邊才允許牌面出現。
- 一般回歸 508 項通過、1 項條件略過。
- 本次完整 `verify:ci` 全部 14 項通過，退出碼為 0。執行 SDK 測試前已停止試玩，該項通過後恢復原網址，沒有連接埠衝突。
- 完整結果為 `test-results/verification.json`；本次退出碼及日誌為 `test-results/yakyuken-pixi/verify-ci-exit.json` 與 `verify-ci.log`。瀏覽器證據為同目錄 `browser-report.json` 與畫面截圖。
- 舊本機測試庫 `data/validation/wallet.sqlite` 的最後修改時間仍為 2026-10-27 20:31:07，本次展示與自動回歸沒有改寫它。
- 未執行遠端 CI。

未部署、未接 Discord、未修改產品版本、未 commit 或 merge。

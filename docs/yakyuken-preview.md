# 野球拳：純 Pixi 牌桌框架

## 品牌下載站與兩種牌桌配置（2026-11-05）

- 下載站使用 `https://jokers-circus-gallery.pages.dev`，是獨立的 Cloudflare Pages 純靜態專案；沒有 Functions、Worker、錢包、憑證或 Netlify 服務。三張圖片分別使用 `/cg/yakyuken/dealer/invitation`、`/first-win`、`/finale`。可見文字只保留品牌、圖片名稱與下載／查看原圖，移除格式術語與手機操作教學；保留原生 1024×1536 透明 PNG。
- `src/games/yakyuken/cg-catalog.js` 集中管理圖片名稱、公開路徑與下載檔名；Discord 仍走官方外部連結及取消回應。本機下載仍核對解鎖，不預載 PNG；舊測試 Worker 的查詢參數連結保持相容。
- 收藏總覽與單張 CG 共用 800×680 上限及相同視窗留白、遮罩；縮放後使用相同可用尺寸，開啟圖片、返回收藏不改變外框。
- 牌桌只有寬版與窄版兩種構圖（寬高比 1.05 為切點）。寬版以 1600×820 的牌桌空間同時受可用寬高限制，人物、側牌、手牌與桌緣位置共同比例縮放，移除 1000px 以下的第三套桌機排列及獨立底部留白切換；桌面持續覆蓋視窗。窄版維持手牌、狀態及確認鈕直向排列。矮橫向視窗保留按鈕最小尺寸，狀態字級與行距隨空間調整。
- 重建下載站：`node scripts/game/build-cg-gallery.js`，輸出只在 `test-results/cg-gallery-dist`。更新既有 Pages 專案：`node node_modules/wrangler/bin/wrangler.js pages deploy test-results/cg-gallery-dist --project-name jokers-circus-gallery --branch main --commit-dirty=true`。不要以新的 `pages project create` 代替更新，也不要部署根目錄遊戲 `dist`。
- 專項驗證：`node scripts/qa/cg-responsive.js` 的 13 尺寸與 6 次原檔下載、`node scripts/qa/cg-gallery-live.js` 的 3 次線上原檔下載均通過；證據在 `test-results/cg-responsive/report.json`、`live-report.json`、對應截圖及 `test-results/cg-responsive-layout-final.log`。既有 24 項遊戲 UI 回歸通過，日誌為 `test-results/cg-responsive-game.log`。完整本機 `verify:ci` 15/15 項通過，一般回歸 557 項通過、1 項既有條件略過；日誌與結果快照為 `test-results/cg-responsive-verify-ci.log`、`cg-responsive-verification.json`。未執行遠端 CI。
- 已發布獨立 Pages 專案，並更新既有 Discord 測試 Worker（版本 ID `8ea1be33-f522-41f8-88b7-a1ff0c56cd3b`）。公開測試健康檢查與未登入錢包拒絕檢查通過；線上 HTML／遊戲入口／圖片目錄程式與本機建置的位元組比對見 `test-results/cg-responsive/test-deploy-report.json`。未部署正式服。
- 停輪與玩法計時、機率、獎金、現行產品版本 1.0.2 均未調整；commit、merge 及 push 仍由使用者處理。

大廳、選角與野球拳遊戲都使用同一個 Pixi Canvas，沒有 HTML 網頁版的主視覺、卡片、按鈕或 dialog。2026-11-03 已依使用者提供的通關勝率表接入五位角色的每拳機率、累積勝敗、整場結束與獎金顯示，詳見[機率規則](yakyuken-probability.md)。一般本機預覽仍不扣款、不發獎入帳、不連接 Discord，收藏與紀錄儲存在同裝置訪客的獨立儲存區。2026-11-05 新增使用者指定的獨立測試雲端模式，啟動方式及資料邊界見下節。

先前指定的本機 SQLite 測試資料庫仍保留於 `data/validation/wallet.sqlite`（見 `scripts/qa/validation-server.js` 與 `docs/testing.md`），沒有開啟、重設、遷移或取代它。使用者於 2026-11-05 明確選擇既有獨立測試雲端；目前野球拳雲端測試錢包使用下述獨立資料區，與舊 SQLite／老虎機錢包分開。

## 使用測試雲端實玩（2026-11-05）

Discord 測試服接線另見[獨立 Discord 測試活動](discord-test-activity.md)。該模式以真正 Discord 使用者分區，兩款遊戲共用測試錢包；下列 `qa-*` 模式仍保留作為本機合成帳號驗證。

- 啟動：`node scripts/game/yakyuken-preview.js --cloud-test`，入口仍為 `http://127.0.0.1:4195/yakyuken-preview.html`。一般無參數預覽及正式建置不啟用測試雲端。
- 既有測試 Firestore 專案為 `slot-game-203db`，野球拳專用 namespace 為 `yakyuken-playtest-20261105-test`；Worker 為 `jokers-circus-yakyuken-test`。既有測試 Worker、正式 Worker、正式 Firestore 及舊測試 SQLite 均不修改。雲端程式、部署工具及本機閘道各自檢查專用測試身分，禁止切至正式專案或其他 Worker。
- 預設為測試玩家 A（`qa-a`），新錢包 10,000 戲籌；可用 `?testPlayer=qa-b` 切換玩家 B。`qa-low`／`qa-zero` 為餘額不足情境。這些是此資料區的合成測試玩家，不使用 Discord 登入、正式玩家識別或正式餘額。真人實測前的遠端驗證只使用 B，A 保留給使用者。
- 入場由伺服器扣 1,000 戲籌；命運荷官 2 勝通關後發 2,500，該場淨變化為 +1,500；敗場或離場為 −1,000。重新載入後可續玩尚未結束的場次，不重扣入場費。每拳由伺服器依原角色權重決定，不接受客戶端金額、勝敗或獎勵。七日簽到亦只發放此測試錢包的戲籌。
- 本機瀏覽器只呼叫同源 `/api/playtest/*`；閘道使用私有存取權杖連至上述 Worker。權杖及 Google 憑證不放入前端；`.tools`、環境檔、帳本與私密檔不能透過預覽伺服器下載，外站 Origin 及轉送標頭亦拒絕。部署工具使用 `node scripts/game/yakyuken-test-deploy.js --deploy`，只支援專用測試設定；私有閘道設定保存在忽略版控的 `.tools/yakyuken-playtest.json`。
- 每名玩家一個持久 Durable Object，序列化操作；Firestore 保存餘額、最近 100 場的勝敗摘要、CG 解鎖與最近提交憑證。入場、有效勝敗、離場及新簽到以交易更新同一玩家文件；原請求 ID、先行持久化意圖與去重憑證處理未知提交結果，重試不重扣、不重發獎。紀錄與金額一起提交，沒有持續輪詢或 Discord 推播。
- 平手不累計、不儲存次數，也不改寫遊玩紀錄。已載入的對局發生平手時零 Firestore 讀寫；僅在 Durable Object 冷啟動時載入玩家文件。平手仍保留 Durable Object 的原出拳回應憑證，確保斷線重送不改抽另一個結果。舊本機紀錄讀取時捨棄平手／總拳數欄位，新平手不觸發本機存檔讀寫。
- 紀錄摘要使用「戲籌變化」，中央加入與遊戲一致的金色勝數／淡紅敗數；手機窄版將勝敗放在摘要下方中央，避免與正負金額重疊。展開只列勝敗及狀態，測試模式明示資料儲存在測試雲端。

### 本次驗證

- 單元檢查涵蓋身分邊界、扣款／發獎去重、未知提交後恢復、平手零存取、資料隔離、餘額不足、簽到及客戶端原請求恢復；`tests/yakyuken-playtest.integration.js` 另以官方 emulator 與真正 workerd 驗證 Firestore 實際文件、重啟及跨玩家隔離，已加入完整 CI 的 services 清單。
- `node scripts/qa/yakyuken-cloud-test.js` 以隔離 fixture 驗證實際瀏覽器接線、四尺寸金額排版、斷線重試、續玩、私密檔拒絕與外站拒絕；`--live` 明確使用上述測試 Worker 的玩家 B，已驗證真實扣款、出拳及重載保存。證據在 `test-results/yakyuken-cloud-isolated/`、`test-results/yakyuken-cloud-live/` 及 `test-results/yakyuken-wallet-runtime.log`。
- 最終野球拳單元檢查 48 項、隔離錢包 UI 10 組、真實測試雲端 3 組及獨立預覽建置均通過；既有野球拳整體瀏覽器回歸 24 組通過，最後的簽到／失敗提示與摘要高度調整另以上述 10 組補驗。日誌分別為 `test-results/yakyuken-cloud-wallet-unit-final.log`、`test-results/yakyuken-cloud-isolated.log`、`test-results/yakyuken-cloud-live.log`、`test-results/yakyuken-cloud-wallet-build.log` 與 `test-results/yakyuken-wallet-ui.log`。早期失敗的原因是新 Worker 未沿用 workerd fetch 適配器、emulator 文件名稱映射，以及瀏覽器 fetch 綁定／測試初始化同步；修正對應原因後驗證，沒有調整機率、放寬玩法參數或略過案例。
- 完整本機 `npm run verify:ci` 14/14 步通過，一般回歸 544 項通過、1 項既有條件略過；含新增的專用測試 Worker／Firestore 整合。日誌為 `test-results/yakyuken-cloud-wallet-verify-ci.log`，彙整快照為 `test-results/yakyuken-cloud-wallet-verification.json`。預覽 4195 已切換 `--cloud-test` 並確認 HTTP 200，玩家 A 在交付前為 10,000 測試戲籌、零紀錄；舊 SQLite 修改時間仍為 2026-10-27。最終簽到重試／入場失敗提示另以上述 UI 補驗與最終預覽建置確認。只部署專用測試後端，未執行遠端 CI、正式部署、版本更新、commit、merge 或 push。

## 場景與風格

- 直接沿用老虎機的 `images/jokers-circus/circus-background.webp`，維持深藍舞台、酒紅布幕與金色裝飾。
- 遊戲大廳不顯示頂部標頭；2026-11-04 依使用者老虎機參考圖，選角與牌桌改為共用老虎機標頭尺寸：桌機 80px、手機 132px、320px 窄版 140px，寬螢幕短橫向 72px。頭像、訪客文字、週簽到、工具列外框及五顆 48px 圖示均沿同一組 `slotHeaderLayout` 座標，手機分成上下兩列。音效維持停用，CG 收藏及遊玩紀錄已啟用，簽到僅介面展示；老虎機本身不變。中文使用 Noto Sans TC／sans-serif。
- 野球拳標頭與牌桌暫不放 Logo；入場載入畫面仍保留原 Logo。桌面移除重複的大型品牌水印及裝飾線，採較深的綠絨布、細微布紋與金屬桌緣。出牌按鈕使用酒紅琺瑯與細金屬邊框，結果主標與雙方手勢說明分層顯示。小尺寸將結果文字間距收緊，保留手牌、人物與按鈕間的空間。CG 收藏及紀錄由工具列進入，設定由 Esc 選單進入；頭像僅展示玩家資訊，不提供操作。
- 第一人稱坐在桌前，荷官位於桌緣另一側，桌面遮住人物下半身。桌子下移並縮小，將主要空間留給放大的荷官；桌機顯示約 525px 高的角色上半身，手機依可用高度調整。
- 人物左側顯示勝／敗兩列大型數字與目標，人物右側只放一張直立荷官牌；左右共用同一中心線、對稱間距及高度，標題同高。手機保留左右配置並依可用空間縮放，短橫向收起 Logo 避免干擾。
- 桌面只保留放大的玩家三張牌，從左至右為拳頭、剪刀、布；抬牌與選牌金框保持清楚。荷官右側單牌預設蓋牌，揭曉時先縮到側邊，在最窄處換成此次出拳，再展開；新一拳恢復同一張牌背。
- 手機、平板與中等寬度視窗的結果及主操作放在手牌下方；寬桌機放在右側。短橫向將手牌與右側操作分區，保留間距，不讓按鈕或結果文字壓在卡牌上。
- 使用 `images/yakyuken/cards-v3/` 的簡樸材質牌組：細暖金邊、午夜藍／酒紅底、立體緞面手勢及素色袖口。背景僅保留低對比帳篷頂紋、菱格及四角撲克牌花色；沒有寶石、金飾袖口、布幕或繁複雕花。牌背採小型小丑帽徽記；卡名由 Pixi 即時繪製，避免縮圖文字失真。左側進度框共用相同材質與底紋。
- 大廳封面改用 `images/lobby/yakyuken-cover-v3.webp`，手持三張牌與正式試玩牌組一致。內建製圖的完整提示詞與原始 RGBA 指紋見 `art/yakyuken/cards-v3/prompts.json`、`manifest.json`。WebP 採無損 exact RGBA 轉換；保留原生像素，僅用 Texture.orig／trim 對齊一像素的畫布高度差，不逐張裁切或重新縮放主體。
- 桌面、桌緣、飾線、牌面、手勢圖示、文字、視窗與按鈕都由 Pixi Sprite／Graphics／Text／Container 繪製。
- 螢幕直橫向與尺寸改變時重新計算位置，不使用捲動頁面。CSS 只負責全畫面容器與 Canvas 的基本尺寸。
- Pixi 官方 accessibility 系統提供透明輔助層支援鍵盤與讀屏，沒有另外一套可見的 DOM 遊戲介面。

## 可操作範圍

1. 開啟本機預覽先到遊戲大廳，可選老虎機或野球拳。老虎機選項開啟同一試玩伺服器的 `/?lobby=preview` 入口；停輪與結算程式沒有變更。
2. 兩款遊戲只有頂部工具列的「返回遊戲大廳」帳篷圖示能返回大廳，不需要關閉並重開應用程式；大廳沒有標頭，其他畫面的頭像皆無操作。老虎機當局／簽到尚未完成或有待確認下注時停用返回；自動旋轉需先按原有的停止自動按鈕，當局完成後再返回，既有本機進度會保留。正式入口沒有本機大廳標記時不顯示此尚未發布的入口。
3. 大廳進入老虎機或野球拳時皆顯示賭場 Logo 與 loading 讀條，各自保有獨立的載入流程。野球拳準備完成後顯示五個角色位置。第一位命運荷官開放，其餘四位顯示準備中，不能入場。角色開放狀態及五組規則統一由 `characters.js` 管理；每位角色固定對應原表的一組門檻、機率與獎金，不提供獨立難度選擇。
4. 選角頁標示入場 1,000 戲籌及「本機暫不扣款」，顯示該角色的通關勝場、敗場上限及獎金。按「進入試玩」後只做淡出淡入，沒有 Logo、讀條、場景推進或手牌進場演出；完成後才計入一次入場。兩款遊戲返回大廳也只做淡出淡入。轉場期間阻擋重複輸入。牌桌內不能重新選角；只能由上方按鈕返回大廳，再選擇遊戲入場。新入場會重設手牌與本場勝敗。

牌桌內：

1. 點選玩家牌，顯示抬牌與金框；鍵盤 1／2／3 分別選拳頭／剪刀／布。
2. 按「確認出牌」或 Enter，先鎖定並抬起玩家牌，接著右側荷官單牌亮起，牌背縮到側邊，於最窄處切換牌面，再展開揭曉。揭曉後左側大數字才更新；減少動態效果時直接顯示同一結果。
3. 每拳依所選角色的勝／敗／平手權重抽樣，荷官揭示對應手牌。按「下一局」重設兩方手牌，荷官恢復單張牌背。平手不計勝敗，敗場不重設累積勝場；達勝場門檻顯示通關與表定獎金，達敗場上限顯示挑戰結束。通關後可按「再挑戰一次」開始同角色的新場；達敗場上限則立即鎖定本場，保留約 1.6 秒閱讀結束對話，再純淡出淡入返回荷官選擇，不提供原地重開。試玩不扣款、不發獎入帳。
4. 移除遊戲規則與自由造型預覽入口；頂部工具列依序為音效、音樂、CG 收藏、遊玩紀錄與返回大廳。Esc 選單可進入收藏、紀錄及設定，沒有重新選角或返回大廳項目。音效未加入；簽到只作介面展示。Esc 關閉視窗，沒有視窗時開啟選單。荷官出牌期間不允許離開牌桌或改變角色。
5. 三張既有荷官原畫綁定累積勝場：初始「邀你入局」、第一勝「漸入佳境」、第二勝「終幕」。未達敗場上限的輸與平手保留造型；通關後再挑戰或敗場結束重新入場皆重設為初始造型。CG 收藏只能回顧實際解鎖的圖片；回顧不改變牌桌造型或增加解鎖進度。換裝採獨立的全畫面快照柔焦、暖金柔光、新造型淡入淡出與造型標題，不再使用中央徽章擋圖。
6. 勝／敗／平手揭曉時，人物下方顯示對應的簡短自然對話，通關或敗場結束使用各自的收尾台詞。台詞只依本場結果與拳數決定，縮放不重抽；下一局清除，不另外儲存逐拳對話清單。
7. 遊玩紀錄每場一筆，儲存對手、勝敗數及狀態；平手只更新同一場，不新增紀錄。通關、敗場結束、中途離場與重新入場皆保留正確場次；牌桌本身重新整理後重設，過往場次統計及 CG 解鎖仍保留。設定可切換背景音樂、減少動態效果與全螢幕；全螢幕仍取決於瀏覽器支援。大廳與兩款遊戲的背景音樂預設開啟，共用同一曲目與音量，第一次按音樂按鈕即關閉；瀏覽器拒絕自動播放時，保留開啟狀態，於第一次點擊或鍵盤操作時播放，手動關閉後不再自動重開。

## 模組

- `src/games/yakyuken/main.js`：唯一遊戲入口與頁面生命週期。
- `src/games/yakyuken/scene.js`：Pixi Application、背景／荷官／牌桌組合、選牌狀態、遊戲內視窗與造型展示。
- `src/games/yakyuken/pixi/lobby.js`、`lobby-layout.js`：遊戲大廳、五個角色位置與入場操作，獨立於牌桌配置。
- `src/games/yakyuken/characters.js`：五位角色的門檻、獎金、整數權重與可入場狀態；現行規則的唯一資料來源。
- `src/platform/game-navigation.js`：本機大廳入口、老虎機連結與離開條件；只接收固定本機預覽標記，不接受外部返回網址。
- `src/games/yakyuken/pixi/layout.js`：牌桌邏輯座標與直橫向配置；介面用反向縮放保留實際像素字級。
- `src/games/yakyuken/pixi/slot-theme.js`：從老虎機介面比對的字型、配色與標頭尺寸，不再預留底部操作盤。
- `src/games/yakyuken/pixi/chrome.js`、`header-layout.js`、`dialogs.js`：老虎機同尺寸標頭、材質進度框、分層結果提示、獨立出牌按鈕與遊戲內視窗。
- `src/games/yakyuken/pixi/table.js`：桌布、桌緣、金飾與場景層次。
- `src/games/yakyuken/pixi/card.js`：兩方手牌、牌面狀態、抬牌與命中區。
- `src/games/yakyuken/card-assets.js`、`pixi/card-art.js`、`card-flip.js`：延後到野球拳入場時準備牌組紋理、原生像素對齊、卡名疊字與可取消的翻牌序列；離開應用程式時先釋放紋理視圖，再回收共用圖源。
- `src/games/yakyuken/pixi/ui.js`：Pixi 按鈕、文字、視窗與基本樣式。
- `src/games/yakyuken/duel-presentation.js`、`pixi/wardrobe-transition.js`：勝場造型、結果對話與獨立全畫面轉場時間線；縮放保留新造型呈現進度，背景／減少動態直接完成同一造型；模糊快照、濾鏡與圖層重用至場景釋放。
- `src/games/yakyuken/player-archive.js`、`pixi/archive-dialogs.js`：本機玩家分區儲存、階段 CG 解鎖及回顧、單場紀錄與分頁；寫入失敗時以明示暫存維持可玩。
- `src/games/yakyuken/pixi/motion.js`：實際 elapsedMS 動畫、替換、暫停與釋放。
- `src/games/yakyuken/pixi/entry-loading.js`、`entry-state.js`：大廳進野球拳專用的 Logo、讀條、失敗恢復版面與可取消的準備工作，不依賴老虎機 loader。
- `src/games/yakyuken/pixi/screen-fade.js`：野球拳選角進牌桌、返回大廳與跨頁抵達大廳的純色淡出淡入，不含讀取 UI。
- `src/platform/lobby-transition.js`／`.css`：老虎機返回本機大廳的跨頁淡出遮罩，抵達後由大廳的 Pixi 模組淡入；不修改老虎機 loader 或玩法時序。
- `src/games/yakyuken/challenge.js`：依角色資料執行整數權重抽樣、本場累積勝敗與獎金，以及獨立動態規劃機率驗算；每次確認只推進一拳，縮放中斷仍揭曉同一結果。
- `assets.js`、`audio.js`：荷官素材、獨立音效與既有背景音樂。

先前的 `state.js`、`controller.js`、`pixi/demo-duel.js` 與舊試玩規則測試保留作為未接線的歷史原型，當前入口不載入。`rules.js` 的公平猜拳試算不作為現行機率設定；目前只共用其手勢與勝負判定，`challenge.js` 依 `characters.js` 的角色規則推進本場結果。

## 開啟與驗證

在專案根目錄以符合 `.node-version` 的 Node 執行 `node scripts/game/yakyuken-preview.js`。Windows 已備妥 `.tools/node-x64/node-v24.22.1-win-x64/node.exe` 可直接使用。

入口為 http://127.0.0.1:4195/yakyuken-preview.html ，現在先顯示遊戲大廳。只監聽本機，不讀 `.env`。開發相依預先打包與快取獨立於老虎機，預載其 `pixi.js/prepare` 以支援大廳切入原有老虎機。正式建置入口與停輪基準沒有變更；Discord 應用程式啟動入口待畫面流程驗收後再接線。

- `node --test tests/yakyuken-pixi.test.js`：放大玩家牌與左右進度／單牌的對稱、等高及互不遮擋邊界、角色可見比例、標頭尺寸、大廳與選角邊界／角色可用性、翻牌順序／取消／減少動態、慢幀完成、動畫替換與清理。
- `node scripts/game/yakyuken-preview.js --build`：大廳與原有老虎機一起獨立輸出至忽略版控的 `test-results/yakyuken-preview`，讓切換後的 `/` 入口也存在；不改正式建置入口。
- `node --test tests/yakyuken-challenge.test.js`：逐一核對五角色與三手勢的全部 10,000 個抽樣權重、門檻與獎金、平手與累積勝敗、亂數溢位拒絕，以及獨立枚舉驗算通關率。
- `node scripts/qa/yakyuken-preview.js`：大廳→選角→入場、已開放角色在五種尺寸的平手／通關／敗場結束／再挑戰、返回／重入／重設、原有老虎機入口、單一 Canvas、滑鼠／觸控／鍵盤、荷官蓋牌與只翻一張、下一局蓋牌重設、工具列切換、CG 鎖定／解鎖／回顧、場次紀錄／分頁／保存、造型、直橫向、資料隔離、素材失敗與初始化期間清理。抽樣的固定輸入只由隔離 QA 伺服器注入，正式入口使用 Web Crypto。證據位於 `test-results/yakyuken-pixi`。
- 完整回歸依 `docs/testing.md` 執行 `npm run verify:ci`；本機與遠端 CI 結果分開報告。

完整回歸的 SDK 隔離測試固定使用 4195，執行前需先關閉此試玩伺服器，檢查完成後再重新啟動。不能同時占用同一連接埠。
野球拳 UI QA 與完整回歸的荷官資源檢查皆使用 4196，兩者須依序執行。

### 前次本機結果（2026-11-03，UI 統一前）

- 大廳與角色選擇加入、操作盤移除後，包含大廳和原有老虎機的獨立建置通過。牌列／角色可見比例／標頭／選單幾何／翻牌／動畫／展示勝負測試 9 項通過；連同既有野球拳規則回歸共 18 項通過。
- 試玩瀏覽器檢查 14 項通過，涵蓋桌機、390×844、320×568、844×390、768×1024 與側邊視窗 544×680，新增兩款遊戲透過同一頭像選單返回大廳、手機返回、老虎機當局期間禁止離開／停止自動旋轉／重入保留一筆結算；同時保留大廳→選角→入場、返回／重新入場、重複入場防護、荷官蓋牌／出牌／翻牌／揭曉、下一局蓋牌重設、減少動態效果、工具列狀態、紀錄、造型與演出中縮放。翻牌與導航測試依實際階段同步，老虎機使用隔離測試 ticker 暫停，確保返回檢查發生在當局期間。
- 一般回歸 511 項通過、1 項條件略過。另有 17 項導航條件／自動旋轉／錢包請求測試通過，包含未確認下注時禁止離開。
- 本次完整 `verify:ci` 全部 14 項通過，退出碼為 0。執行 SDK 測試前已停止試玩，該項通過後恢復原網址，沒有連接埠衝突。
- 完整結果為 `test-results/verification.json`；本次退出碼及日誌為 `test-results/yakyuken-pixi/verify-ci-exit.json` 與 `verify-ci.log`。瀏覽器證據為同目錄 `browser-report.json` 與畫面截圖。
- 舊本機測試庫 `data/validation/wallet.sqlite` 的最後修改時間仍為 2026-10-27 20:31:07，本次展示與自動回歸沒有改寫它。
- 未執行遠端 CI。

未部署、未接 Discord、未修改產品版本、未 commit 或 merge。


### 前次 UI 統一結果（2026-11-03，大廳重新排版前）

- 頭像在遊戲大廳、選角、野球拳牌桌與老虎機皆無點擊動作；返回大廳只由上方工具列的帳篷圖示觸發。野球拳選單僅保留繼續遊戲、荷官與造型、遊戲設定；移除牌桌重新選角入口，並限制選角只能從遊戲大廳進入。
- 試玩瀏覽器檢查 14 項通過，包含各尺寸的頭像點擊、上方唯一返回入口、無重選／返回選單項目、遊戲切換、老虎機當局禁止離開與停止自動後只結算一局。截圖已人工檢查，獨立預覽建置通過。
- 本次 `npm run verify:ci` 完成 14 項，13 項通過；SDK 項因原本的試玩伺服器占用 4195 而失敗（退出碼 1）。確認並暫停該預覽後，以相同鎖定 Chromium 單獨補跑 `node scripts/qa/discord-sdk.js` 通過（退出碼 0）；其餘已通過項目沒有重跑或略過檢查。原始完整回歸失敗報告保留，沒有改寫為成功。
- 證據：`test-results/yakyuken-pixi/ui-verify-ci.log`、`test-results/verification.json`、`test-results/yakyuken-pixi/ui-sdk-verification.json`／`.log` 與 `browser-report.json`。未執行遠端 CI。
- 已恢復原本的本機預覽入口。未部署、未修改產品版本，停輪、音效與結算核心未變更。


### 大廳排版與簽到展示（2026-11-03）

- 使用者要求簽到先做「單純 UI 顯示、沒有功能」。因此本次不接入錢包；老虎機的本機大廳試玩入口與野球拳都顯示「週簽到／查看七日獎勵」展示按鈕。展示按鈕不開啟領獎、不發出簽到請求，也不改寫既有測試資料。正式及原本已連接錢包的老虎機簽到功能維持原流程；未來野球拳接線時應沿用相同帳號與既有簽到系統。
- 遊戲大廳改為不含頂部標頭的全舞台入口。Logo、標題與遊戲卡片整組置中，桌機／橫向並排，窄版直向上下排列；尺寸依可用高度限制，沒有捲動頁面。
- 遊戲標頭沿用老虎機的 1440px 最大寬度、桌機／手機行高、簽到尺寸、工具位置、48px 點擊區及音樂開啟狀態配色。野球拳仍由 Pixi 繪製，沒有另加 HTML 遊戲 UI。
- 原先 Pixi 輔助層會把滑鼠點擊後的 focus 轉成 mouseover，造成提示外框殘留。現在分開追蹤原生滑鼠進出與鍵盤焦點，並固定按鈕量測邊界，避免提示外框改變輔助層尺寸；保留鍵盤 Tab 焦點外框。
- 試玩瀏覽器檢查 14 項通過，涵蓋大廳無標頭、320px 至桌機的簽到位置、展示無動作、預設音樂／點擊關閉、野球拳無音效初始化、滑鼠移開／點擊後外框清除、鍵盤外框保留及既有導航與牌桌案例。證據為 `test-results/yakyuken-pixi/browser-report.json` 與同目錄截圖。獨立預覽建置通過。

- 本次完整 `npm run verify:ci` 的 14 項全部通過，退出碼 0；原始彙整為 `test-results/verification.json`，日誌為 `test-results/yakyuken-pixi/lobby-verify-ci.log`。SDK 測試前暫停原試玩伺服器，該項通過後已恢復同一網址。未執行遠端 CI，未部署或更新產品版本。
- 既有 `data/validation/wallet.sqlite` 的最後修改時間仍為 2026-10-27 20:31:07，本次沒有連接或改寫該帳本；停輪與玩法核心來源未變更。


### 生成封面新大廳（2026-11-03）

- 依使用者確認，採用對話中兩張已改成獨特字形的「老虎機／野球拳」封面定稿，連同圖內的切角金屬外框完整放入新大廳。移除原先程式繪製的轉輪示意、圓角底板與文字底欄，不再疊加重複遊戲標題。
- 原稿在 `art/lobby/`，執行時素材在 `images/lobby/`。原稿以無損 WebP 保留，已逐像素比對與生成 PNG 相同；執行圖則另作 WebP 壓縮，兩張合計約 614 KiB。完整尺寸、雜湊與內建 image_gen 提示詞見 [素材說明](../art/lobby/README.md)。
- 桌機兩張封面並排、窄版直向上下排列。全尺寸維持 3:2，不裁掉標題、人物或圖內外框；小手機另外壓縮 Logo 與標題區的留白，讓完整封面仍能放入不捲動畫面。
- 封面沿用原有 Pixi 按鈕、無障礙名稱、鍵盤焦點與指標提示；圖片加入場景既有載入／失敗／釋放流程。遊戲網址、選角、簽到展示、音樂與停輪基準不變。
- 版面測試 10 項、素材格式與版面補驗共 12 項、試玩瀏覽器 14 項與獨立預覽建置通過。桌機、320px 手機、橫向與側邊視窗截圖已檢查，證據為 `test-results/yakyuken-pixi/browser-report.json`、同目錄截圖與 `cover-build.log`。

- 完整 `verify:ci` 初次完成 14 項，其中 13 項通過，一般回歸因最初保存 PNG 原稿而觸發專案既有格式規則。已改為逐像素相同的無損 WebP，並以特色字定稿重新執行 `npm test`：514 項通過、1 項既有條件略過、0 失敗。原始失敗彙整未改寫；補驗日誌為 `test-results/yakyuken-pixi/cover-unit-after-format-fix.log`。
- 特色字版本的視窗重驗亦揭露選單測試在輔助層更新前立即讀取舊返回按鈕的競態。檢查改為等待「繼續遊戲」選單控制實際出現，再執行原本「無重新選角／返回大廳項目」的嚴格斷言；沒有增加重試、略過斷言或修改遊戲時序。

- 等待選單實際顯示後的最終特色字 UI 檢查 14 項通過、0 錯誤；預覽建置通過。日誌為 `test-results/yakyuken-pixi/cover-ui-final.log` 與 `cover-build.log`。本機預覽已確認引用 `slot-cover-v2.webp` 與 `yakyuken-cover-v2.webp`。未執行遠端 CI，未部署或修改產品版本。

### 前次野球拳獨立讀取與入場轉場（2026-11-03，載入位置調整前）

- 選角先以 340ms 淡至深藍舞台底色，這一段不顯示 Logo 或進度；接著顯示賭場 Logo、野球拳標題及酒紅／金色讀條。準備完成後讀條先淡出，再以 520ms 顯露牌桌，同時輕微推進場景，讓雙方手牌依序進場。轉場與資源準備有各自的階段，不以單次圖片替換實現。
- 只有視覺語彙比照賭場整體風格。動畫、進度與錯誤恢復由野球拳自己的 Pixi 模組處理；未修改或呼叫老虎機 loader、主程式、音效、停輪或結算核心。
- 選角先載入必要素材，其餘荷官造型延至入場準備；讀條等待真實素材與 GPU 上傳完成才到 100%。錯誤時不計入入場，提供「再試一次／返回選角」；成功入場後仍沒有重新選角入口。背景操作與重複輸入在入場期間停用。
- 縮放保留目前進度與轉場階段；減少動態效果時跳過裝飾動畫，仍等待實際資源完成。中途釋放場景會取消等待，晚到的素材也會卸載；漸層資源在同一 renderer 內重用，於 renderer 關閉後釋放。
- 版面、動畫與取消單元檢查共 13 項通過。試玩瀏覽器檢查 18 項通過、0 錯誤，涵蓋實際素材等待、淡出／淡入中間影格、連點防護、縮放、失敗重試、減少動態與中途離開；保留既有大廳、牌桌與老虎機切換檢查。另將 Pixi BindGroup 資源警告列為失敗條件。獨立預覽建置通過。
- 完整本機 `npm run verify:ci` 全部 14 項通過。彙整為 `test-results/verification.json`，日誌為 `test-results/yakyuken-pixi/entry-verify-ci.log`；獨立 UI 證據為同目錄 `browser-report.json`、`entry-ui.log`、`entry-fade-out.png`、`entry-fade-in.png` 與 `entry-loading-*.png`。檢查後已恢復 4195 本機預覽。未執行遠端 CI，未部署、更新版本、commit 或 merge。

### 載入與純轉場分開（2026-11-03，目前流程）

依使用者後續確認，取代上一節的入場順序：

| 路徑 | 畫面呈現 |
| --- | --- |
| 大廳 → 老虎機 | 沿用老虎機本身的賭場 Logo 與 loading 讀條 |
| 大廳 → 野球拳選角 | 野球拳獨立的賭場 Logo 與 loading 讀條，等待荷官素材及 GPU 準備完成 |
| 老虎機 → 大廳 | 純淡出淡入，跨頁底色銜接，不顯示讀取文字或讀條 |
| 野球拳 → 大廳 | 純淡出淡入 |
| 野球拳選角 → 牌桌 | 純淡出淡入；不再顯示 Logo／讀條，移除場景推進與手牌進場演出 |

- 純轉場採用獨立的 `YakyukenScreenFade`；正常狀態只有深藍色遮罩。大廳進野球拳才使用 `YakyukenEntryLoading`。兩者都保留轉場期間輸入鎖定、縮放、減少動態效果與釋放處理；素材失敗仍可重試或取消載入，不會提前計入遊戲入場。
- 後續依使用者要求，野球拳正常載入畫面改為與老虎機相同的「Logo＋讀條」，不顯示遊戲名稱、準備文字或完成提示，也不保留原文字區的空白。Logo 尺寸限制、讀條寬度與兩者間距比照老虎機的桌機／手機／橫向規格；準備狀態仍提供給讀屏。錯誤時才顯示失敗說明與恢復按鈕，與老虎機的錯誤處理方式一致。
- 移除載入文字後，準備／取消／版面單元檢查 3 項、既有 UI 檢查 20 項與獨立預覽建置均通過，桌機／手機截圖已檢視。證據為 `test-results/yakyuken-pixi/logo-only-browser-report.json`、`logo-only-ui.log`、`logo-only-build.log` 與 `logo-only-loading-*.png`。此小幅畫面調整未重跑完整 CI；下列完整回歸紀錄屬於前一次導航調整。
- 老虎機僅在本機大廳返回按鈕補上離頁遮罩與轉場期間的操作防護；原有 loader、停輪、結算與音效模組未修改。返回大廳的預覽網址帶固定 `transition=fade` 標記，讓大廳初始準備期間維持相同純色底，準備完成後再淡入。基礎 CSS 改由頁首載入，避免腳本啟動前閃白。
- 瀏覽器測試會分別暫停在淡出與淡入的實際中間影格，檢查純遮罩沒有讀條或 Logo 節點、牌桌沒有縮放或手牌位移，且跨頁返回與縮放仍保留當下進度。素材準備使用實際請求閘門；測試先等控制項出現，再暫停 ticker，避免把輔助層尚未更新誤判為操作失效。
- 最終本機 UI 檢查 20 項通過、0 錯誤，預覽建置通過；版面、動畫、準備取消與導航條件單元檢查 15 項通過。證據為 `test-results/yakyuken-pixi/navigation-browser-report.json`、`navigation-ui-final.log`、`navigation-build.log`，以及 `slot-return-fade-*.png`、`table-fade-*.png`、`lobby-fade-*.png`、`entry-loading-*.png`。
- 完整本機 `npm run verify:ci` 已完成 14 項，其中 13 項通過；荷官資源項因與當時的 UI QA 同占 4196 而未能啟動。UI QA 結束釋放該埠後，以同一鎖定瀏覽器單獨執行 `npm run test:dealer` 通過，0 錯誤且影格基準比對通過；沒有變更檢查條件或停輪參數。原始完整回歸失敗結果保留於 `test-results/verification.json` 與同內容快照 `test-results/yakyuken-pixi/navigation-verification.json`，未改寫為成功。完整日誌為 `navigation-verify-ci.log`，補驗日誌為 `navigation-dealer-after-port-fix.log`。一般回歸為 517 項通過、1 項既有條件略過。
- 已恢復 4195 本機預覽，既有 `data/validation/wallet.sqlite` 修改時間仍為 2026-10-27 20:31:07。未執行遠端 CI，未部署、更新產品版本、commit 或 merge。

### 角色規則與流動排版（2026-11-04）

- 依使用者澄清移除獨立難度模型、選擇視窗與進度框難度字樣。五組原表數值依序綁定角色一至五；目前僅命運荷官可入場，2 勝／2 敗／2,500 戲籌，其餘角色保留準備中。
- 進度兩列以面板中央為基準置中，勝／敗行上下對稱。選牌立即上抬約牌寬的 20%，桌機約 31px；確認保留同一高度，換牌及縮放仍正確。
- 選角右區文字、五個角色框與單一入場按鈕共用隨寬高調整的比例，加入細金邊舞台面板；牌桌左右卡框依空間等高對稱放大。桌機底部空間逐步調整，避免在原 1500px 切點突然改變人物與側框大小。
- 保留既有卡牌圖、同老虎機標頭、無紀錄／不扣款／不發獎的本機設定。
- 本次角色／規則／版面／翻牌／入場與歷史原型單元檢查 28 項通過；瀏覽器驗證 22 項通過，涵蓋 320px 至 2560px、1500px 前後連續尺寸、上抬完成位置、通關獎金與重開。截圖已檢視，獨立預覽建置通過。證據為 `test-results/yakyuken-pixi/browser-report.json`、`character-fluid-ui.log`、`character-fluid-build.log` 與 `fluid-*-characters.png`／`fluid-*-table.png`。
- 完整本機 `npm run verify:ci` 的 14 項全數通過，一般回歸 523 項通過、1 項既有條件略過。日誌為 `character-fluid-verify-ci.log`，完整彙整快照為 `character-fluid-verification.json`。SDK 檢查後已恢復 4195 預覽，確認 HTTP 200；舊測試帳本修改時間維持 2026-10-27。未執行遠端 CI，未部署、更新版本、commit 或 merge。

### 勝場造型、自然對話與全畫面換裝（2026-11-04）

- 選角縮圖加上深藍／酒紅舞台漸層、低亮度聚光與舞台線，人物保持既有透明原畫；五個位置共用同一套底圖語彙。
- 勝利揭曉後自動顯示對話並切換對應勝場造型。一般勝／敗／平手各有三句短台詞，通關與失敗另有收尾；不影響每拳機率、門檻或獎金。
- 換裝使用 2.1 秒全畫面演出：背景逐步柔焦壓暗，人物交疊淡化、暖金柔光與底部文字漸層，最後淡回牌桌。演出期間阻擋連點、下一局、選單與返回；縮放保留進度，支援減少動態及中途釋放。
- 對話仍只保留當前一句；沒有加入遊戲紀錄、錢包結算、音效或新角色素材。
- 本次單元檢查 31 項通過；完整 UI 檢查 23 項通過，最後的縮放排程調整另以 5 項集中補驗通過，包含原生視窗錯誤收集、全畫面柔焦範圍、時間線保留及中途關閉時 GPU 綁定清理，無錯誤。獨立預覽建置通過。證據為 `test-results/yakyuken-pixi/wardrobe-ui-verified.log`、`browser-report.json`、`wardrobe-resize-report.json`、`wardrobe-unit.log`、`wardrobe-build.log` 與 `wardrobe-*.png`／`dialogue-*.png`。
- 完整本機 `npm run verify:ci` 全部 14 項通過；一般回歸 526 項通過、1 項既有條件略過。完整日誌為 `wardrobe-verify-ci.log`，本次彙整快照為 `wardrobe-verification.json`。SDK 後已恢復 4195 本機預覽；未執行遠端 CI、未部署、更新版本、commit 或 merge。

### 新造型單獨呈現、返回效能與敗場結束（2026-11-04）

- 特效移除舊造型的大圖，只淡入淡出新造型。柔焦背景擷取時暫時隱藏荷官本體，避免舊造型殘影。
- 柔焦改成入場／縮放時烘製一次的背景快照，最高 1280×720 實體像素；動畫幀不再執行全場景 BlurFilter。返回時保留快照貼圖、濾鏡與透明轉場圖層，避免當幀集中銷毀／重建 GPU 及文字資源；整個場景關閉後才統一釋放。
- 同一台 1920×1080 隔離瀏覽器的 CPU 繪製取樣：特效中平均約 3.77ms→0.80ms，返回首幀約 6.30ms→2.10ms，結束清理約 4.10ms→0.40ms。此為本機取樣的繪製提交成本，並非各裝置的 FPS 保證；原始結果為 `wardrobe-profile-before.json` 與 `wardrobe-profile-cached.json`。量測只在忽略版控的隔離測試中進行，產品不加入 FPS／測速 UI。
- 敗場集滿立刻禁止出牌、Enter、重開及手動導航；結束對話保留約 1.6 秒（減少動態不略過閱讀時間），再自動返回荷官選擇並清除本場。重新入場必須在選角頁明確操作；通關後的再挑戰保留。
- UI 驗證 23 項與縮放／生命週期補驗通過，涵蓋五尺寸的敗場自動返回、無重開控制、直接 confirm 亦不能重開、重新入場勝敗歸零、僅新造型、動畫幀零模糊運算、返回資源重用與中途關閉清理。證據為 `wardrobe-return-ui.log`、`browser-report.json`、`wardrobe-return-resize.log`、`wardrobe-resize-report.json`；獨立預覽建置通過。
- 本次完整回歸的安全項已完成全部功能斷言並輸出成功報告，但 Windows 瀏覽器子程序退出後兩條輸出管線未關閉，使 finally 停在 browser.close。以本機 Inspector 核對資源後只關閉這兩條已確認的子程序管線，原安全測試自然以 0 結束並繼續後段；沒有重跑、修改斷言、略過檢查或人工改寫退出碼。此本機關閉干預記錄保留於 `wardrobe-return-verify-ci.log`。
- 完整本機回歸最終 14/14 項通過，原始成功結果為 `test-results/verification.json`，本次快照為 `wardrobe-return-verification.json`；安全項的關閉管線曾需上述人工清理，原始日誌與耗時均保留。預覽已恢復，舊測試帳本修改時間維持 2026-10-27。未執行遠端 CI，未部署、更新版本、commit 或 merge。

### 狹長手機的人物與左右卡框（2026-11-04）

- 狹長直向畫面依寬高比平順調整：人物同時受可用高度與手機寬度限制，較小手機額外微縮，避免只依高度過度放大；保留足夠的實際可見人物高度。
- 左右卡框對稱上移、靠外並略縮，為臉部、肩膀及手勢留出空間；卡框標題、勝敗數字與揭牌效果保留。調整幅度隨畫面比例和可用高度連續變化，桌機比例維持原設定。
- 新增人物可見範圍、狹長手機臉部／肩部空間及相鄰尺寸連續性的檢查。最後排版補驗 32 項通過，11 種視窗 × 3 個造型共 33 張畫面產出且無瀏覽器錯誤，已檢視狹長／較小手機與桌機代表畫面；獨立預覽建置通過。證據為 `test-results/yakyuken-pixi/slim-final-unit.log`、`slim-layout-report.json`、`slim-final-layout.log`、`slim-final-build.log` 與 `slim-*-pose-*.png`。
- 中斷前啟動的完整本機 `npm run verify:ci` 已在背景完成，14/14 項通過；原始日誌為 `slim-layout-verify-ci.log`，彙整快照為 `slim-layout-verification.json`。最終手機間距微調另以上述單元及實際渲染補驗，沒有重跑已通過的整套檢查。
- 未修改機率、獎金、勝敗結束或停輪設定；未新增遊戲紀錄。未執行遠端 CI，未部署、更新版本、commit 或 merge。

### CG 收藏與單場遊玩紀錄（2026-11-04）

- 依最新需求取代先前不實作紀錄的範圍。規則圖示改為 CG 收藏，時鐘啟用遊玩紀錄；移除可任意切換造型的展示視窗。初始 CG 在成功開始對局後解鎖，後兩張分別由累積 1 勝、2 勝解鎖。未解鎖卡片不繪製 CG 圖，按鈕及回顧方法皆檢查解鎖狀態；查看圖片不改變牌桌進度／造型。
- 每次成功入場建立一筆紀錄；同一場每拳只更新該筆，保存人物、勝敗、平手數及狀態。通關後再挑戰另建一筆；敗場結束保留終局後返回選角；中途返回／重新整理亦保存已達勝敗，不另外建立逐拳清單。紀錄顯示人物、勝敗、時間與狀態並可翻頁。
- 目前仍是本機訪客試玩，使用 `jokers-circus:yakyuken:archive:v1:` 獨立命名空間；正式帳號／跨裝置同步尚未接線。儲存介面支援由受信任啟動程式注入玩家識別，不從網址冒充玩家；不同玩家鍵分開，同玩家不同分頁每場／每張 CG 各自寫入，避免整份存檔互相覆蓋。
- 讀取損壞項目時只略過該項；儲存被拒絕或容量不足時，保留可讀的舊資料與本頁暫存，介面明示無法永久保存。沒有讀寫舊老虎機試玩帳本、OAuth token、錢包或正式服務。
- 新增 5 項儲存測試：單場去重與重載、離場統計、玩家隔離／雙分頁、儲存故障、損壞資料。瀏覽器 24 項通過，包含圖片鎖定、實際勝利解鎖、回顧不改變造型、重新整理保存、勝／敗／離場紀錄、手機翻頁、跨玩家隔離及儲存故障；獨立預覽建置通過。證據為 `archive-ui.log`、`browser-report.json`、`archive-mobile-*.png`、`archive-small-history-page-2.png`、`archive-blocked-storage.png` 與 `archive-build.log`。
- 手機另可從收藏／紀錄視窗右上選單進入原有設定，避免移除規則入口後只剩鍵盤 Esc；320px、390px 與桌機觸控入口補驗通過，鎖定條件保持清楚可讀。補驗為 `archive-menu-report.json`、`archive-menu-final.log` 及 `archive-collection-final-*.png`。
- 完整本機 `npm run verify:ci` 14/14 項通過，包含停輪體驗、安全、慢幀與 Firestore 回歸；原始日誌為 `archive-verify-ci.log`，彙整快照為 `archive-verification.json`。未執行遠端 CI，未部署、更新版本、commit 或 merge。

### CG 收藏品牌與單一功能入口（2026-11-04）

- CG 工具列改為細線畫冊圖示，與大廳圖示採相同線寬、圓角與尺寸。依最新需求移除收藏／紀錄右上的額外選單，各入口只開啟自己的功能；保留關閉、CG 內的圖片切換與返回收藏。既有鍵盤 Esc 選單不變。
- 收藏頁加入原品牌 Logo、角色與解鎖進度，手機採直向收藏列、桌機採三欄展示，並保留未解鎖條件。底部加入服務條款、隱私權政策、品牌名稱與現行版本；條款在新分頁開啟，原對局和收藏畫面保持原狀。版本讀取既有 APP_VERSION，未更新產品版本。
- 新增 320×568、390×844、844×390、1600×900 的可見範圍／觸控尺寸、品牌資訊、無額外選單及兩條政策連結的實際瀏覽器斷言；24 項瀏覽器檢查與隔離預覽建置通過。證據為 `collection-brand-ui.log`、`collection-brand-*.png`、`browser-report.json` 與 `collection-brand-build.log`。
- 完整本機 `npm run verify:ci` 14/14 項通過，日誌為 `collection-brand-verify-ci.log`，快照為 `collection-brand-verification.json`。4195 預覽已恢復；未執行遠端 CI，未部署、更新版本、commit 或 merge。
- 後續依老虎機樣式統一條款與隱私文字連結：滑鼠停留／點擊不畫外框或底色，保留手形游標、44px 點擊高度與鍵盤焦點提示。320px、390px、1600px 已實際驗證兩個政策連結、滑鼠／鍵盤狀態與一般工具列原有回饋，隔離建置通過；補驗為 `collection-text-links-report.json`、`collection-text-links.log`、`collection-text-links-build.log`。

### 共用頁尾、紀錄清單與原畫下載（2026-11-04）

- 頁尾沿用一致的 `JOKER’S CIRCUS` 字串、Georgia 11px／1px 字距、分隔線、條款文字間距 24px 與手機 16px／桌機 24px 留白；兩款遊戲的實際 DOM／Pixi 字型尺寸、品牌字串與留白已在四尺寸交叉核對。現行版本繼續讀取 APP_VERSION。老虎機只調整規則頁尾的桌機左右留白。
- 野球拳遊玩紀錄改為與老虎機同類型的 800px／760px 視窗及直向捲動卡片清單，不再以翻頁收納。支援滑鼠滾輪、觸控拖曳與方向鍵／Page Up／Page Down／Home／End；清單只繪製當前可見卡片，保留所有舊紀錄。較大襯線勝敗數字、綠色獎勵數字與金色通關標記突顯結果；時間、狀態與試玩未入帳說明留在次要層級。
- 每場另存當時獲得獎勵 `reward`；敗場／離場／進行中為 0，通關為該角色獎金。舊格式未帶 reward 的紀錄可相容讀取；沒有接入錢包或實際發獎。
- CG 卡片只保留「已解鎖」。全圖頁新增下載圖示及「下載去背 PNG」，下載前再次核對解鎖與圖號。遊戲繼續載入 `images/yakyuken/dealer/stage-*.webp`；獨立原畫位於 `public/downloads/yakyuken/dealer-stage-*.png`，只在玩家點擊時由瀏覽器原生下載，不加入 Assets／入場準備、貼圖或預載依賴。
- 三張 PNG 均由 `art/yakyuken/dealer/stage-*-master.webp` 直接無損轉檔，保留原生 1024×1536 與完整透明像素，無放大或再次有損壓縮；單張約 1.47MB。可用 `python scripts/assets/export-yakyuken-cg.py` 重建。逐像素與母圖比對通過。
- 6 項 archive 單元檢查、24 項遊戲瀏覽器檢查、隔離預覽建置與四尺寸補驗通過；補驗含原生觸控、捲動限制、無預載下載請求，以及三張實際下載檔與原 PNG 全檔位元組相同。主要證據為 `cg-download-ui-final.log`、`cg-polish-report.json`、`cg-polish.log`、`polish-*.png` 與 `cg-download-build.log`。原生下載不一定出現在 Playwright Page request 事件，因此按需請求以隔離 Vite 伺服器紀錄和實際下載事件交叉確認；早期觀察方式的測試失敗保留於 `cg-download-ui.log`。
- 完整本機 `verify:ci` 首次結果 12/14 步通過，日誌與彙整保留於 `cg-download-verify-ci.log`、`cg-download-verification.json`。一般回歸的「全部禁止 PNG」舊規格與最新需求衝突，已改為精確列舉三張下載檔，並驗證原生尺寸、RGBA、完整透明像素及未授權新增／缺檔的反向案例；該資源檢查補驗通過（`cg-png-guard-final.log`）。REST 整合另在 `tests/cloud-rest.integration.js:24` 的併發簽到發生 HTTP 409／ABORTED，保留失敗、沒有重試到成功或修改錢包／重試次數。未執行遠端 CI，未部署、更新版本、commit 或 merge。
- 最終一般回歸補驗 534 項通過、1 項既有條件略過、0 失敗，保留於 `cg-download-unit-passed.log`；完整回歸仍維持上述原始失敗結果，沒有將補驗冒充整套 CI 成功。

### CG 輕量控制與遊玩紀錄樣式（2026-11-05）

- CG 原畫下載改為無文字的細線下載圖示，保留 52×44px 點擊範圍及「下載高畫質去背 PNG」無障礙名稱；返回收藏、上一張／下一張與收藏項目改用輕量呈現，滑鼠停留與按下只顯示柔和底色，鍵盤焦點仍有清楚外框。
- 野球拳選單、設定、收藏、原畫及紀錄視窗的關閉控制統一採老虎機的 44px 圓形樣式、21px 共用 X 圖案及相同的柔和互動回饋。
- 紀錄沿用老虎機的時間／獎勵摘要、襯線金額及可展開卡片。展開後顯示荷官、勝敗平手數與自然語句狀態；野球拳特有欄位使用「通關獎勵」，並持續標示試玩未入帳。保留原紀錄與滾輪、拖曳、鍵盤捲動，展開收合不修改存檔。
- 38 項野球拳單元檢查及 24 組隔離瀏覽器檢查通過，包含四尺寸的 CG 控制、手機／桌機紀錄排版、滑鼠與鍵盤展開收合、捲動，以及三張 PNG 的實際原檔下載。證據為 `test-results/yakyuken-refined-ui-browser.log`、`test-results/yakyuken-pixi/browser-report.json`、`cg-refined-*.png` 與 `history-refined-*.png`。第一輪因新紀錄無障礙覆層攔截滾輪而失敗，修正指標事件後重新驗證，原失敗保留於 `test-results/yakyuken-refined-ui-browser-before-scroll-fix.log`。
- 隔離預覽建置及完整本機 `npm run verify:ci` 14/14 步通過；一般回歸 534 項通過、1 項既有條件略過。日誌為 `test-results/yakyuken-refined-ui-build.log`、`test-results/yakyuken-refined-ui-verify-ci.log`，彙整快照為 `test-results/yakyuken-refined-ui-verification.json`。SDK 測試以 `DISCORD_SDK_QA_PORT=4199` 避開目前預覽，4195 持續回應 HTTP 200。未執行遠端 CI、部署、版本更新、commit、merge 或 push。

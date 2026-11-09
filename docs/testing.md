# 測試與驗收

所有負載、故障及資料清理演練使用隔離資料；不拿真實玩家下注測效能。

## 自動測試

| 指令 | 範圍 |
|---|---|
| `npm run verify` | 固定順序：一般回歸、前端／Worker dry-run、啟動／荷官／數字／停輪／CSP 瀏覽器驗證 |
| `npm run verify:full` | 上述全部，再跑官方 emulator、REST／workerd、備份恢復、重設與監控 |
| `npm run verify:ci` | 完整驗證＋Discord 測試活動雙遊戲＋野球拳領獎順序＋慢幀／輸入延遲＋CSP 延遲通知，共 16 項；彙整獨立失敗 |
| `node scripts/qa/check-toolchain.js` | 安裝相依前核對 Node／npm、lockfile、Netlify、Docker 與 CI 的版本設定 |
| `npm test` | 算獎、介面契約、Discord 權限、SQLite、備份、同步與防重送 |
| `npm run test:bot` | 指令、HTTP、帳本與維運 |
| `npm run test:firestore` | 官方 emulator：交易、索引、遷移、完整／增量備份 |
| `npm run test:cloud` | 官方 emulator＋真正 workerd：REST、額度、登入、分塊備份 |
| `npm run test:recovery` | 60 錢包／5 人並行、全新 DO 恢復、原請求及重設重播 |
| `npm run test:reset` | 測試帳本清除、未知提交結果、重啟續作、舊登入拒絕 |
| `npm run test:experience` | Edge：正常／快停、慢結果、慢歷史、慢幀與手機觸控 |
| `npm run test:dealer` | Edge：荷官完整影格、短期重用、背景／到期釋放及故障清理 |
| `npm run test:startup` | Edge：六種啟動失敗、立即停止渲染、晚到素材回收與重試畫面 |
| `npm run test:numbers` | 數字、符號、空值與後備文字的像素／尺寸／無障礙基準，以及 Canvas 重設次數 |
| `npm run test:security` | 先 build；Edge：CSP、腳本注入阻擋、SQLite 結算 |
| `npm run test:discord-sdk` | 隔離父頁／iframe：真實 SDK 握手、OAuth、方向鎖定及大型非法集合拒絕 |
| `npm run test:monitor` | scheduled handler、持久去重、故障與恢復通知 |
| `node --test tests/yakyuken*.test.js` | 野球拳規則、紀錄、測試錢包邊界、原請求恢復與去重 |
| `node scripts/qa/yakyuken-cloud-test.js` | 隔離瀏覽器：測試錢包、扣款發獎、四尺寸金額、平手零 Firestore 存取、簽到重試與私有閘道 |
| `node scripts/qa/cg-responsive.js` | 隔離瀏覽器：14 種尺寸及 3 組短視窗／安全區的規則與 CG 外框對照、跨角色等尺寸縮圖、全畫面檢視與下載鈕間距、手機觸控翻頁與 6 次 PNG 原檔下載 |
| `node scripts/qa/yakyuken-reward.js` | 隔離錢包：造型先於領獎、金額與音效同步、獨立靜音、縮放／背景恢復、重載不重播、勝敗再次挑戰／返回、新場只扣一次費，以及預取後 330ms 翻牌規劃、暫扣結算、原拳重試、缺票券與跨裝置進度衝突 |
| `node scripts/qa/cg-gallery-live.js` | 唯讀公開 Cloudflare Pages：三位角色共十三張原圖下載、位元組比對、CSP 與僅同源請求；不呼叫錢包 |
| `node scripts/qa/yakyuken-cloud-test.js --live` | 明確連接獨立測試 Worker 與 Firestore，只用玩家 B 實際扣測試戲籌；不屬於自動 CI |
| `node scripts/qa/discord-test-activity.js` | 使用已建置前端、真正的 Embedded App SDK 與隔離帳號。三主題各跑 13 種尺寸，驗證橫直切換、人物裁切、文字安全區、開場故障與來源，再跑桌機／手機雙遊戲及共用簽到 |
| `node scripts/qa/test-firestore.js tests/discord-test.integration.js` | 官方 emulator＋真正 workerd：Discord 簽章／頻道、OAuth、每位玩家、共用錢包／簽到與重啟 |
| `node --test tests/cloudflare-usage.test.js tests/monitor.test.js` | Free 門檻／Paid 觀測、方案切換、跨日、通知意圖、429／未知送出、可信附件恢復；不聯絡正式服務 |
| `npm run build`、`cloud:build`、`monitor:build` | 前端與 Worker dry-run，不部署 |
| `npm run verify:math`、`verify:sessions` | 完整枚舉與固定 seed 回合驗算 |

需要 `.node-version` 指定的 Node 24 安全版本、npm 12.2.1 與 Java 21；Windows 先在儲存庫根目錄啟用工具鏈，腳本受阻擋時見 [README 的直接啟用方式](../README.md#開發與驗證)，以下 `npm` 指令改用 `npm.cmd`。首次以 `npm run firestore:emulator:setup` 準備模擬器。Windows 還原測試使用 NTFS 硬連結，沙箱禁止時須允許隔離測試的檔案操作，不能改成覆寫目的檔。

`npm ci` 會執行 Discord SDK 的相容安全修補；不可略過專案 `postinstall`。使用 `--ignore-scripts` 安裝時，必須另執行 `node scripts/security/patch-discord-sdk.js`，再以 `--check` 核對。完整驗證與正式建置會拒絕未修補或未知的 SDK 內容；細節見[資料保護](security.md#discord-sdkzod-修補)。

瀏覽器測試使用鎖定的 Playwright 開發相依；一般驗證在 Windows 預設 Edge、Linux 預設 Chromium。`verify:ci` 在兩個平台都預設使用 Playwright 隨附的 Chromium，先執行 `npx playwright install chromium`（Linux 加 `--with-deps`）。可用 `PLAYWRIGHT_MODULE_PATH` 指定既有模組目錄、`PLAYWRIGHT_BROWSER_CHANNEL` 指定測試通道；`bundled` 表示鎖定版本的 Chromium，Windows 使用完整 Chromium 的新 headless 模式（`channel: 'chromium'`），Linux 沿用 headless shell，兩者由同一份 Playwright browser revision 鎖定。Windows ARM 執行 x64 headless shell 時曾在動畫與資源載入期間發生控制命令延遲；同版完整 Chromium 的對照測試保留真實輸入、可操作性及反向案例。此模式也由上述安裝指令準備，不需額外相依。[Playwright 新 headless 模式](https://playwright.dev/docs/browsers#chromium-new-headless-mode)

實際 Node／瀏覽器／Playwright 版本與啟動 channel 寫入 `test-results/browser-runtime.json`；同版瀏覽器仍不能取代遠端 Linux CI 驗證。

Discord 雙遊戲的荷官圖片恢復檢查，以 `verifySlotAtlasRecovery` 將故障注入、回應觀察與「選擇老虎機」動作放在同一階段；原 60 秒門檻保留，不把前面的野球拳／CG 流程計入。桌機與手機都必須實際收到 503→200、恰好兩次圖片請求，並等待老虎機就緒；報告保存各回應的階段耗時，失敗報告也保存已觀察結果。`tests/slot-atlas-recovery.test.js` 覆蓋超過 60 秒的前段延遲、即時回應、不發請求、不重試、恢復失敗、額外重試及未就緒等情境；真實缺圖仍須失敗。這些都只作用於隔離 QA，不調整正式遊戲的載入、停輪或重試參數。

Discord SDK 隔離測試預設使用 4195；若正在開啟同埠的野球拳預覽，可設定 `DISCORD_SDK_QA_PORT=4199` 再跑驗證，保留既有預覽。替代連接埠仍須未被占用，並維持只監聽 `127.0.0.1`。

數字測試以 `willReadFrequently: true` 固定 Canvas 軟體繪製，避免 GPU／CPU 切換造成像素雜湊差異；此設定僅限隔離測試頁，正式遊戲不受影響。固定基準位於 `tests/fixtures/number-rendering.json`，仍逐一核對像素、尺寸及無障礙文字。僅在有意更改字型／外觀，或已證實需要統一測試繪圖路徑時，用 `npm run test:numbers -- --baseline` 更新並審查差異；失敗時也會保存 `test-results/number-rendering/after.json`。

停輪測試精確檢查 60ms 目標間隔、正常末軸 1640ms 及快停減速規劃，並確認音效在跨過目標的第一幀依序觸發。實際回呼可能因慢幀集中到同一幀，因此保留牆鐘量測供診斷，不以 CI 機器的即時幀率判定玩法。`npm run test:experience -- --slow-frames` 將隔離測試的 ticker 限為 5 FPS，驗證慢幀仍符合相同契約；正式遊戲不受影響。失敗時間線同時寫入日誌與 `test-results/reel-experience/failure.json`。

快停案例以動畫階段同步原按鈕／觸控操作：早期與晚期案例暫停測試 ticker，排隊案例暫扣模擬回應，並斷言輸入確實發生於指定階段；晚期快停必須保留全部落地時間。`npm run test:experience -- --slow-frames --slow-input` 再將第二次操作延後兩秒，驗證 CI 輸入延遲不會改變測試情境。這些案例的牆鐘時間包含測試等待，不作效能基準。

音效按鈕是畫面內的頂部控制，停輪測試以 Playwright `scroll: 'none'` 點擊，避開曾在 Windows Chromium 卡住的自動捲動命令。測試確認音效預設開啟、首次互動後能播放，手動靜音與重新開啟各只需一次真實點擊。隔離反向案例驗證停用、遮擋、畫面外、隱藏與持續移動的按鈕都會失敗。延遲啟用案例會等按鈕實際可操作後才點擊。

CSP 注入測試等待非同步違規通知，確認 `script-src-elem` 對 `inline` 執行實際阻擋（`enforce`），再檢查注入腳本未執行；通知未到仍會逾時失敗，不更改正式安全政策。`npm run test:security -- --delayed-csp-report` 將測試收集通知的時間延後 500ms，防止重新引入立即讀取的競態。

`node scripts/qa/verify.js --full --list` 或 `--ci --list` 只列出步驟。檢查清單與依賴集中在 `scripts/qa/helpers/verification-plan.js`；一般驗證第一個失敗即停止，CI 模式則繼續獨立檢查。建置失敗時，依賴它的 CSP／Worker／整合測試標為受阻，絕不當成通過。每一步結束都更新 `test-results/verification.json`；任何失敗／受阻都保留非零結束碼。Windows ARM 的 workerd 步驟使用 `.tools/node-x64/` 中與 `.node-version` 一致的 Node；其他步驟使用啟動驗證的 Node。

手動 `yakyuken-preview.js` 與 `dealer-resources.js` 共用 4196 埠；先結束前者，再執行後者或完整 CI，不要與 CI 同時啟動。
`cg-responsive.js` 與數字繪製像素檢查共用 4198 埠，也應循序執行。

GitHub Actions 使用三個獨立 runner 並行驗證，各組內仍循序執行：

| `--suite` | 範圍 |
|---|---|
| `browser` | 一般回歸、前端建置、全部瀏覽器與壓力測試、相依漏洞稽核 |
| `wallet` | Firestore 錢包、v2、狀態快取 |
| `services` | 自行建置前端及兩個 Worker，再驗證服務、備份、恢復、重設與監控 |

重現單組使用 `npm run verify:ci -- --suite=browser`（或 `wallet`／`services`）；漏洞稽核由 workflow 另跑 `npm audit --audit-level=high`。本機完整重驗仍用 `npm run verify:ci`，不可在同一個目錄同時啟動多組，因為會共用模擬器連接埠及輸出目錄。分組覆蓋測試會檢查所有整合測試檔均分配且不重複、workflow 啟動所有組；新增檢查請同步維護清單。任一組失敗仍讓其餘組完成診斷，最後的 `Verify / verify` 只有全部成功才通過。

CI 每組保留 7 天的 `verification-<suite>-<run_id>-<attempt>` 診斷附件，並在執行摘要列出各步驟結果與耗時。附件只包含指定的 QA JSON，不包含 SQLite、玩家資料、備份或環境檔。一般停輪報告在 `test-results/reel-experience/`，壓力測試在 `test-results/reel-experience-stress/`；CSP 每次使用獨立 `run-*` 目錄，互不覆蓋。

### 從零重驗

使用儲存庫外的新目錄，複製目前來源或從待驗證提交建立 checkout。不要帶入 `.env*.local`、`data/`、`backups/`、`node_modules/`、`dist/`、`.wrangler/` 或舊測試結果，也不要放在已有 `node_modules` 的父目錄下，以免 Node 向上尋找舊套件。

```sh
node scripts/qa/check-toolchain.js
npm ci
npx playwright install chromium
npm run firestore:emulator:setup
npm run verify:ci
npm run verify:math
npm run verify:sessions
```

Linux 的瀏覽器安裝使用 `npx playwright install --with-deps chromium`。若將瀏覽器快取放在專案 `.tools/playwright`，安裝與驗證時都須將 `PLAYWRIGHT_BROWSERS_PATH` 設為該目錄的絕對路徑。

Windows ARM 建議在 **Node 24 x64 環境**內完成以上全部步驟，確保 npm 安裝的原生套件與 workerd 執行架構一致；只在最後切換 Node 不足以補齊 x64 套件。Java 21 可由 `JAVA_HOME`／`FIRESTORE_JAVA_PATH` 指定；官方 emulator 會核對 SHA-256。數學驗算會重建 `docs/data/` 報告及 `src/game/model-config.js`，應與來源比對；未調整玩法時內容須一致。

單獨執行 `test:security` 前需先 build；`verify` 已按此順序執行。全新目錄沒有荷官的本機影格基準時，`test:dealer` 仍檢查格數、時長及資源生命週期；要比較修改前後像素，先依[素材文件](assets.md)保存同機基準。

Discord SDK 隔離測試預設使用 `127.0.0.1:4195`。若既有開發預覽占用此埠，可設定 `DISCORD_SDK_QA_PORT` 為另一個固定的未占用埠，再執行 `verify:ci`；測試父頁／iframe、來源檢查與全部斷言使用同一個測試 origin，不會停止既有預覽或自動重試換埠。

`.github/workflows/verify.yml` 在 pull request、main 推送或手動觸發時執行 `verify:ci`；安裝前先檢查 `.node-version`、`packageManager`、engine、lockfile、Netlify、Docker 與 CI 是否一致，搭配 Java 21、Chromium 與經雜湊核對的官方 emulator。安裝後先稽核，high／critical 漏洞會阻止驗證通過。workflow 只有讀取程式碼權限，不注入正式憑證、不部署、不執行正式資料清理。Actions 提交已鎖定；遠端結果以實際 workflow 執行為準。設定參考 [Playwright CI 文件](https://playwright.dev/docs/ci-intro)與 [GitHub 診斷附件](https://docs.github.com/en/actions/tutorials/store-and-share-data)。

## 本機完整錢包

`npm run validation:start` 只監聽 `127.0.0.1:4192`，入口 `/wallet-test`。不載入 `.env`，明確關閉 Discord／雲端連線，外部 fetch 拒絕；轉送標頭、外站 Origin 也拒絕。連接埠被占用時直接失敗。

| 帳號 | 初始戲籌 | 情境 |
|---|---:|---|
| qa-a、qa-b | 10,000 | 下注、簽到、資料隔離 |
| qa-low | 50 | 餘額不足 |
| qa-zero | 0 | 零餘額與簽到恢復 |

首次選擇帳號登入才建立錢包，開啟測試總覽不建立資料。資料為虛構帳號，保存於 `data/validation/wallet.sqlite`，重啟不重設。建置輸出 `test-results/validation-dist`，不覆蓋 `dist`。Ctrl+C 正常停止後才能清理；不得只刪運行中的 SQLite 主檔而留下 WAL。一般瀏覽器的 localStorage 與這份帳本分開。

## 人工驗收

- 全新玩家：首次建立、新手戲籌、重開不重發；簽到領取與明日獎勵。
- 桌機／手機：版面、觸控、空白鍵、Enter、Esc、焦點及減少動態效果。
- 正常／快停：結果先送、連點僅一局、慢結果仍等待、歷史變慢不阻擋停輪、慢幀不延長時鐘、停輪音順序。
- 斷線／雙裝置：未確認請求原 ID 重送、餘額及紀錄一致、舊回應不覆蓋新狀態。
- 自動旋轉：開視窗、切背景、餘額不足時停止；回前景不補播音效。
- 管理員：他人／跨群／跨頻道／失去角色後拒絕；發放、更正及重設確認卡重複點擊不再次入帳。
- 備份：錯誤金鑰、損壞、錯誤環境及已有目的地拒絕；完整七表及原請求重播一致。
- 客戶實測：Discord OAuth、真機手機、自然大獎、持續用量及通知送達仍需真人確認。

報告保存在忽略版控的 `test-results/`；私密備份及恢復證據在 `backups/`。歷史測試數量不作為目前通過證明，應以本次執行結果為準。

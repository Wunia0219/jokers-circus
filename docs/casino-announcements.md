# 賭場機器人公告

產品版本以 `package.json` 為準。正式服以同一個「🎲命運荷官」Bot 發送得獎與出入場公告；使用 REST API，不需要 Gateway 常駐在線。遊戲與管理指令仍走 HTTP interactions。入場登記先確立帳目起點，Discord 訊息則由背景佇列傳送。

## 玩家看到的內容

| 項目 | 觸發／文案 | 圖片 |
|---|---|---|
| BIG WIN | 派彩達總下注 10 倍至未滿 30 倍；`@玩家，這局手氣不錯！` | 右側小方圖 |
| SUPER WIN | 30 倍至未滿 100 倍；`@玩家，這局贏得漂亮！` | 橫幅 |
| MEGA WIN | 100 倍以上；`@玩家，這局中了大獎，全場為你喝采！` | 橫幅 |
| 入場 | `♠ 入場 · @玩家，歡迎來玩！` | 無 |
| 正常離場 | `♣ 離場 · @玩家 離開賭場` | 有下注時附黑金收據 |
| 連線到期 | `♣ 離場 · @玩家 暫時離開賭場` | 有下注時附黑金收據 |

每局只發最高得獎級別的一則公告，顯示本局獎金倍率；一般獲獎不公告。玩家標記使用已驗證 ID，禁止 everyone、角色及名稱自行解析。未設定靜音旗標，但實際手機提醒仍由玩家的 Discord 通知設定決定。

有下注的離場卡用黑金收據呈現「這次獲得」的戲籌與「總遊玩」局數。正數用紅字與加號，負數用綠字與減號，打平顯示 0 並搭配金色邊線。卡片文字也顯示當時手上的戲籌。輸贏只計遊戲獎金減下注，簽到與管理員發放／更正不算遊戲獲利。未下注也會推播，離場訊息以一行顯示「這次還沒下注。」

## 程式與素材

| 位置 | 責任 |
|---|---|
| `server/discord/highlight-card.js` | 三種得獎文案、顏色、圖片與舊合併卡 |
| `server/discord/player-display.js` | 安全名稱、玩家標記與允許通知的 ID |
| `server/discord/casino-bot.js` | Bot 身分／目的地驗證、REST 傳送、限流 |
| `server/discord/casino-visits.js` | 出入場租約、帳目摘要、持久佇列與狀態 |
| `server/discord/casino-receipt.js` | 送出時以保存的淨輸贏與局數產生 PNG，並附替代文字 |
| `scripts/assets/build-casino-receipt.py` | 以 Windows 字型與 Pillow 重建收據底圖及數字字形 |
| `src/platform/casino-presence.js` | 瀏覽器心跳、關閉、返回頁面 |
| `public/announcements/` | Discord 使用的公開無損 WebP |
| `art/announcements/` | BIG 原尺寸無損母檔，不公開部署 |
| `docs/data/announcement-art.json` | 尺寸、檔案／像素雜湊與編碼紀錄 |

同一位荷官的三張核准插圖維持原設計。SUPER／MEGA 為 1671 × 941，WebP 與原 PNG 逐像素相同；BIG 保留 1254 × 1254 母檔，公告版先縮至 384 × 384，再無損編碼（215,632 bytes）。縮尺寸會改變像素，公告版的無損保證是相對於縮圖，不是原尺寸。Discord 代理的顯示縮圖另由平台處理。

公開網址以內容雜湊命名；換圖時同步更新 `HIGHLIGHT_ART` 與圖片紀錄。圖片不進入遊戲開場預載。符號只保留相關撲克牌花色與 Bot 名稱的骰子，不堆疊 Emoji。

## 連線、可靠性與用量

- 每 45 秒心跳；租約 180 秒，最後分頁關閉後保留 10 秒重連寬限。同一玩家多裝置合併一段遊玩，隱藏分頁不等於離場；手機凍結或網路中斷可能觸發到期公告。
- 心跳只更新 DO 狀態；入場、離場才讀權威帳目。離場等待已接受的結算。瀏覽器不能指定身分、餘額或輸贏；返回頁面的舊請求也不能影響新連線。
- 得獎事件與下注交易一起存入 Firestore outbox，`recipientId` 使用已驗證玩家。備份還原從原回合擁有人重建；七表格式不變。沒有可驗證 ID 的舊事件只顯示安全名稱。
- 429 依持久等待時間重試，固定 nonce 防止近期重送；POST 結果不明或中途重啟標為 `uncertain`，不自動重貼。Discord 傳送失敗不回滾結算；不保證外部網路故障下每則必達。
- 出入場上限為 128 個同時遊玩帳號、每帳號 8 分頁與 256 筆事件。優先移除已送達紀錄，不丟棄待發事件；達上限暫緩公告。這是保護上限，不是免費方案容量保證。
- 私有維運狀態只含活躍、待發、最早待發時間與結果不明數量。出入場等待超過十分鐘或結果不明時，獨立監控依既有連續兩次規則提醒人工核對。
- Worker／DO 操作、帳目摘要與 outbox 都計入原額度，不提高或重設預算。BIG 理論上約占 1.2726% 回合，每千局平均增加約 12.7 則；實際短期次數會浮動。

出入場操作狀態不屬於七表帳本備份；全新 DO 災難恢復不重播舊出入場公告。舊 Webhook 模式仍保留十分鐘合併、限流與靜音行為，不能與 Bot 同時設定。

## 部署與驗收

使用 `deploy/casino-bot.env.example`，啟用前核對 Bot 安裝、私密 Token、群與頻道。公告頻道需要檢視頻道、傳送訊息、嵌入連結及附加檔案（52224）。已安裝的正式 Bot 如只具備舊的 19456 權限，發布黑金收據前須先在公告頻道補上「附加檔案」。沿用既有 Worker、DO、namespace、Secrets 與額度。

### Discord 測試服

- 在 [#工程師的專屬地](https://discord.com/channels/760012177326997544/1564243344857632818) 執行 `/推播預覽` 並選擇樣式。這是測試 App 專用的私人回覆，使用示例數據，可看入場、未下注離場、三種結算及三種大獎。註冊入口為 `node scripts/discord/register-casino-preview.js`。
- 驗證遊戲自動推播時，用同一個測試 App 的 Bot。伺服器管理員以 `bot` scope 將它安裝至小丑俱樂部，並在上述私人頻道授予四項公告權限。測試 App 擁有者在 Developer Portal 取得測試 Bot Token，存為 `jokers-circus-arcade-test` 的 `DISCORD_BOT_TOKEN` Worker Secret。
- 啟用前以測試 Token 驗證 Bot 身分是 `1567875182792544256` 且頻道確屬測試群。測試 Worker 的公告變數為 `DISCORD_CASINO_ENABLED=true`、`DISCORD_CASINO_GUILD_ID=760012177326997544`、`DISCORD_CASINO_CHANNEL_ID=1564243344857632818`。測試後依需要停用公告。正式頻道 `1565731918107115690` 不供演練。

出入場整合在 Cloudflare runtime，本機 Node／SQLite QA 不對真實頻道發送。以隔離資料驗證得獎、去重與恢復；正式環境唯讀檢查健康、指令與圖片。真人確認登入、入離場與手機提醒，不以正式下注製造測試大獎。部署現況見[客戶交付](customer-handoff.md)，測試見[驗收文件](testing.md)。

參考：[Discord 訊息](https://docs.discord.com/developers/resources/message#create-message)、[限流](https://docs.discord.com/developers/topics/rate-limits)。

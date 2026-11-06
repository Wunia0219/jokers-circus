# 大廳遊戲封面

使用者於 2026-11-03 確認採用對話中顯示的兩張已改為獨特字形的標題與外框圖片，直接整合為新大廳。本組由內建 `image_gen` 生成；完整提示詞、參考規格、選圖紀錄、檔案大小與 SHA-256 見 [generation.json](generation.json)。

| 遊戲 | 無損 WebP 原稿 | 執行時 WebP |
| --- | --- | --- |
| 老虎機 | [slot-cover-v2.webp](slot-cover-v2.webp) | [slot-cover-v2.webp](../../images/lobby/slot-cover-v2.webp) |
| 野球拳舊稿 | [yakyuken-cover-v2.webp](yakyuken-cover-v2.webp) | 已由 [v3 封面](../../images/lobby/yakyuken-cover-v3.webp) 取代，舊執行檔已移除 |

以下尺寸、雜湊與選圖說明是 v2 原始來源紀錄。現行野球拳封面的來源與指紋見 [cards-v3 manifest](../yakyuken/cards-v3/manifest.json)；舊母圖保留供追溯。

兩張皆為 1536×1024、3:2、不透明圖片，標題與外框已在圖內。WebP 僅轉換編碼，不裁切、不重畫、不改變尺寸；合計約 614 KiB。無損 WebP 原稿已逐像素核對與生成的 PNG 完全相同，方便日後修改；生成工具保存的原始 PNG 不受影響。

美術沿用 Joker’s Circus 的午夜藍、酒紅布幕、香檳金與紅寶石細節。老虎機封面包含轉輪、小丑帽、烏鴉與白兔；野球拳沿用命運荷官的服裝與髮色，搭配拳頭、布、剪刀三種牌面。兩者共用細金屬切角外框，左下保留完整中文字樣。

大廳以相同 3:2 比例縮放，桌機並排、窄版直向上下排列。圖片與原有 Pixi 按鈕共用點擊區；保留選擇遊戲的無障礙名稱、鍵盤焦點與滑鼠移開清除提示的行為。載入與釋放沿用場景資源生命週期。

修改來源：`src/games/yakyuken/lobby-art.js`、`pixi/game-cover.js`、`pixi/lobby.js` 與 `pixi/lobby-layout.js`。

老虎機採斜切金屬字形與紅色琺瑯切面；野球拳採帶紅金陰影的動態筆鋒。依使用者澄清，實際套用的是這兩張特色字定稿，並非初版一般字體。

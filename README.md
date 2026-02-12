## 簡介

Redirector 是一款瀏覽器擴充功能（支援 Firefox、Vivaldi、Chrome、Opera、Edge），可根據使用者自訂的正規表達式或萬用字元規則自動重新導向網址。

## 紀念

謹以此專案紀念 Einar Egilsson，他創造了 Redirector 並無私地維護了許多年。我們懷念你的善良與慷慨。

## 下載連結

* [Firefox](https://addons.mozilla.org/firefox/addon/redirector/)
* [Google Chrome / Vivaldi](https://chrome.google.com/webstore/detail/redirector/ocgpenflpmgnfapjedencafcfakcekcd)

## Manifest V3 遷移

**4.0.0 版**已將 Redirector 從 Manifest V2 遷移至 Manifest V3，以維持 Chrome 相容性。

### 主要變更

- **Chrome 88+ 必要**：Chrome/Edge 需要 88 以上版本
- **Service Worker**：背景頁面已遷移為 Service Worker（事件驅動）
- **自動遷移**：從 v3.5.4（MV2）升級時，會在遷移前自動建立備份
- **零資料損失**：所有重新導向規則、設定與組態皆完整保留
- **復原能力**：可從 v4.0.0 匯出並匯入 v3.5.4

### 瀏覽器支援

| 瀏覽器 | 版本 | Manifest |
|--------|------|----------|
| Chrome / Edge / Opera / Vivaldi | 4.0.0+（需 88+） | V3 |
| Firefox | 3.5.x | V2（獨立分支維護） |

### 功能保持不變

- 所有重新導向模式皆運作一致（正規表達式、萬用字元、擷取群組）
- URL 處理（decode、encode、base64）
- 匯入/匯出功能
- 瀏覽器按鈕圖示與徽章
- 桌面通知
- 主控台日誌
- HistoryState 重新導向（YouTube Shorts 等）

### 效能

| 指標 | 數值 |
|------|------|
| 暖啟動重新導向 | ~5-10ms（與 v3.5.4 相同） |
| 冷啟動 | ~50-100ms（Service Worker 喚醒後） |
| 記憶體使用量 | 較 v3.5.4 增加 ≤20% |

詳細技術資訊請參閱 [CHANGELOG.md](CHANGELOG.md) 與 [DECISIONS.md](DECISIONS.md)。

## 使用範例

### 去行動版（De-mobilizer）

將行動版網站重新導向至桌面版。

- 範例網址：`https://en.m.wikipedia.org/`
- 包含模式：`^(https?://)([a-z0-9-]*\.)m(?:obile)?\.(.*)`
- 重新導向至：`$1$2$3`
- 模式類型：正規表達式

### AMP 重新導向

繞過 Google/Bing 的 AMP 頁面，直接前往原始網站。

- 範例網址：`https://www.google.com/amp/www.example.com/amp/document`
- 包含模式：`^(?:https?://)www.(?:google|bing).com/amp/(?:s/)?(.*)`
- 重新導向至：`https://$1`
- 模式類型：正規表達式

### Doubleclick 追蹤移除

移除 Doubleclick 連結追蹤。

- 範例網址：`https://ad.doubleclick.net/ddm/trackclk/N135005.2681608PRIVATENETWORK/B20244?https://www.example.com`
- 包含模式：`^(?:https?://)ad.doubleclick.net/.*\?(http?s://.*)`
- 重新導向至：`$1`
- 模式類型：正規表達式

### YouTube Shorts 轉一般影片

將 YouTube Shorts 重新導向至標準播放頁面。

- 範例網址：`https://www.youtube.com/shorts/video-id`
- 包含模式：`^(?:https?://)(?:www.)?youtube.com/shorts/([a-zA-Z0-9_-]+)(.*)`
- 重新導向至：`https://www.youtube.com/watch?v=$1$2`
- 模式類型：正規表達式
- 進階選項：啟用 `historyState`

### !bangs 玩法

什麼是 bangs？請參閱 <https://duckduckgo.com/bangs>

#### 在 Google 上使用 DuckDuckGo !bangs

- 範例網址：`https://www.google.com/search?&q=asdfasdf%21+sadfas`
- 包含模式：`^(?:https?://)(?:www.)google\.(?:com|au|de|co\.uk)/search\?(?:.*)?(?:oq|q)=([^\&]*\+)?((?:%21|!)[^\&]*)`
- 重新導向至：`https://duckduckgo.com/?q=$1$2`
- 模式類型：正規表達式

#### 自訂 DuckDuckGo !bangs

**!example 基礎版**（僅有 bang 時重新導向至基礎網站）：

- 範例網址：`https://duckduckgo.com/?q=!example&get=other`
- 包含模式：`^(?:https?://)(?:.*\.)?duckduckgo.com/\?q=(?:%21|!)example(?=[^\+]|$)(?=\W|$)`
- 重新導向至：`https://example.com/`
- 模式類型：正規表達式

**!example 搜尋版**（附帶搜尋字詞時重新導向至自訂搜尋）：

- 範例網址：`https://duckduckgo.com/?q=searchterm+!example+searchterm2&get=other`
- 包含模式：`^(?:https?://)(?:.*\.)?duckduckgo.com/\?q=(.*\+)?(?:(?:%21|!)example)(?:\+([^\&\?\#]*))?(?:\W|$)`
- 重新導向至：`https://example.com/?query=$1$2`
- 模式類型：正規表達式

### 快速 DuckDuckGo !bangs

直接前往常用的 DuckDuckGo bang 目標，避免中間的網路請求。

**前後綴皆有搜尋字詞**：

- 範例網址：`https://duckduckgo.com/?q=foo+bar+%21google+test+bar`
- 包含模式：`^https://duckduckgo\.com/\?q=(.*)\+(?:%21|!)google\b\+(.*?)(?:&|$)`
- 重新導向至：`https://google.com/search?hl=en&q=$1+$2`
- 模式類型：正規表達式

**僅前綴或後綴有搜尋字詞**：

- 範例網址：`https://duckduckgo.com/?q=foo+bar+%21google`
- 包含模式：`^https://duckduckgo\.com/\?q=(.*?)\+?(?:%21|!)google\b\+?(.*?)(?:&|$)`
- 重新導向至：`https://google.com/search?hl=en&q=$1$2`
- 模式類型：正規表達式

## Firefox 深色主題

如果你使用 Firefox 深色主題，可以在 `userChrome.css` 中加入以下內容，讓 Redirector 的按鈕更清晰可見：

```css
/* Redirector 按鈕 - Firefox 深色主題適配 */
toolbarbutton#toggle-button--redirectoreinaregilssoncom-redirector[image*="active"] { filter: invert(1) brightness(6); }
toolbarbutton#toggle-button--redirectoreinaregilssoncom-redirector[image*="disabled"] { filter: invert(1) brightness(2.5); }
```

如果不了解 `userChrome.css` 的用法，請至 Firefox 相關論壇查詢。

## 專案結構

```
src/
  js/           # JavaScript 原始碼
  css/          # 樣式表
  images/       # 圖示（亮色/暗色主題）
  rules/        # declarativeNetRequest 規則
tests/          # 基準測試與跨瀏覽器測試
specs/          # 功能規格文件
```

## 授權條款

MIT License - Copyright (c) 2016 Einar Egilsson

詳見 [LICENSE](LICENSE)。

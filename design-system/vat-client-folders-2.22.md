# 案件與合約客戶分組 UI

2026-11-19 使用 Chromium 開啟這輪提供的網站與公開示例。UI UX Pro Max 的 `data dense workbench grouping` 產生的 Data-Dense Dashboard 用來檢查資料密度，行銷頁模板不適合此工作台。`accordion reduced motion` 的可減少動態與避免過量動效規則直接套用。保留本工具既有色彩與控制項。

| 參考 | 瀏覽觀察與採用方式 |
| --- | --- |
| [Beautiful UI](https://www.beautifului.dev/) | 看了 Thinking、Task Rows 與 Records Table 的呈現，採用單列呈現狀態、需要時再展開上下文。 |
| [beUI Animated Collapsible](https://beui.dev/components/motion/collapsible) | 操作公開示例並讀取展開狀態，採用箭頭轉向與內容進場同步。 |
| [Rare UI Folder](https://www.rareui.com/components/foldercomponent) | 進入 Folder 元件預覽。採用一個外層收納多筆記錄的層級，維持工作台原有的邊線和底色。 |
| [Transitions](https://transitions.dev/) | 查看公開動態庫、Card resize 與 Number pop-in 的入口，採用短距離、短時間的內容出現，數字保持靜態。 |
| [shadcn/ui Accordion](https://ui.shadcn.com/docs/components/accordion) | 用 Enter 與 Space 切換 Accordion 範例的展開狀態。客戶列採原生收合，單筆明細採帶有 `aria-expanded` 的按鈕。 |
| [oil-ui](https://github.com/oil-oil/oil-ui) · [案例畫廊](https://ui.oiloil.org/) | 看過 README 與案例畫廊。比較收合、單一客戶展開、窄螢幕的畫面，依實際截圖修正行高與按鈕位置。 |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 查看來源及本機技能查詢，採用對照欄位、清楚標籤、44px 操作區和減少動態。 |
| [Impeccable](https://github.com/pbakaus/impeccable) | 查看其 critique 和 audit 做法。移除重複客戶欄、空白備註格與固定預留的大區塊。 |
| [Awesome AI Tools for UI](https://github.com/maxbogo/awesome-ai-tools-for-ui) | 檢視合集，確認它是來源索引，實際元件判斷回到各示例頁。 |
| [Google Stitch](https://stitch.withgoogle.com/) · [官方示例文章](https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/) | 工具入口載入後未顯示可用編輯介面，改看官方示例與線框迭代流程。本輪用本機畫面驗證版面。 |
| [Uizard](https://uizard.io/) | 瀏覽公開產品頁，參考其原型中將主要內容與設定分層的做法。 |
| [Visily](https://www.visily.ai/) | 入口導向登入頁，未驗證編輯器或元件動態。 |
| [Figma Make](https://www.figma.com/make/) | 主站與說明站的瀏覽連線均受阻，改看 [Figma 官方 Code Connect 資料庫](https://github.com/figma/code-connect) 了解元件對應。未驗證 Make 操作。 |
| [墨刀 AI](https://modao.cc/) | 瀏覽公開原型與產研示意，參考中文操作標籤，實作採「明細」「狀態」「到期」等短標籤。 |

## 行為規格

客戶列為第一層，底下有聯絡資訊和記錄。記錄的名稱、狀態和日期可直接掃讀，明細顯示完整內容。未填項目不輸出。新增、編輯與續約共用同組表單尺寸，提醒區只在啟用時顯示欄位。

開啟時用 145ms、3px 位移與透明度過場，箭頭跟隨實際狀態。減少動態時直接切換。翻頁保留展開狀態，客戶內容在第一次展開時掛載，先顯示首批 12 筆。使用簡單的 HTML、CSS 和 JavaScript，參考站只作設計比較。

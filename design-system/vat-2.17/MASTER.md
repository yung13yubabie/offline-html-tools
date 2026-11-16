# VAT Workbench 2.17：全域工作台

範圍涵蓋今日待辦、日曆、客戶、本期工作、帳務、通知、列印、備份及設定，包含導覽、表單、狀態、對話框與明暗模式。非單純放大字級；其他三個工具不在本輪範圍。

## 實際使用的技能

[UI UX Pro Max SKILL.md](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/SKILL.md)，上游安裝版本 `6ae86f61f520d6ca229d2f40e070410638c908c5`，本機 `/workspace/.agents/skills/ui-ux-pro-max/SKILL.md`。本輪重新閱讀完整指引，執行：

```
python3 scripts/search.py 'accounting operations workspace' --design-system -p 'VAT Workbench v2.17' -f markdown
python3 scripts/search.py 'dragging movements alternatives' --domain ux
python3 scripts/search.py 'progressive disclosure forms' --domain ux
python3 scripts/search.py 'progressive disclosure' --domain ux
```

採用 Minimalism & Swiss Style 的網格、層級及企業工具方向，表單／回饋優先及拖曳必須提供按鈕、鍵盤替代的規則。搜尋回傳的 Hero + Features + CTA 屬展示網站，不用於此工作台；外部字體不引入。後兩次 UX 搜尋未命中漸進揭露，回傳標題平衡規則，未假稱其支持此處的資訊重組。

## 線框與資訊架構

[可離線操作的線框](wireframes.html)：全域架構、本期工作、列印編輯三個畫面；純示意資料，不接資料庫。線框確認結構，成品採下列視覺系統。

- 每日處理：今日待辦、日曆、本期工作、帳務。
- 資料與輸出：客戶庫、通知與模板、列印編輯。
- 管理：備份／匯入、設定。
- 頂部只保留期別、搜尋及畫面工具。主區使用一致的頁名與操作列。
- 本期工作為客戶清單＋客戶工作區；六個固定頁籤保持可用，儲存列標示目前客戶與期別。
- 設定改為分類工作區，切換分類保留原表單節點與未儲存輸入。
- 說明採可展開區塊；保留完整原文、欄位標籤、資料、驗證訊息及必要警告。

## 視覺規則

以 4px 為間距基礎，主要區域 16／20／24px；內容上限依工作種類調整，不用裝飾大卡片占滿視窗。側欄 `#172f38`，主背景 `#f2f4f5`，文字 `#1c3035`，次文字 `#52656b`，主操作 `#096b68` 搭白字。橙、紅只用於待處理及錯誤；不能只靠顏色表達狀態。深色有獨立表面、邊線及文字色。

本機 system-ui／Microsoft JhengHei，金額等寬數字；正文 14–16px，層級靠佈局、間距、字重，不把說明縮成註腳。觸控主要按鈕 44px；清楚的 focus-visible；切換最多 160ms，遵從減少動態偏好。所有九頁套用共同卡片、輸入、表格、頁籤、空白、提示、對話框系統。

## 紙張編輯

左側選輸出資料，中間為實際 A4 報表，右側為所選欄位工具。即時預覽草稿，縮放只作用於畫面，不改 A4 尺寸、實際列印邊界或資料。選取欄位／資料區塊後可排序、隱藏、對齊；拖曳表頭邊線改欄寬，另有縮窄／加寬、前移／後移、方向鍵操作。隱藏欄位可從清單恢復，每種類至少一項。復原／重做保留最近 30 次操作。

保存前禁止輸出草稿；儲存沿用原有交易及讀回核對。離開或切換另一種版面前保護草稿。原數值編輯移到進階區。列印另由原始報表產生，不包含編輯邊線、焦點或工具。

## 相容與驗證

獨立 HTML 內嵌所有 CSS／JS；無 CDN、外部字體或同目錄執行依賴。沿用 DB 3／備份 7／版面格式 1，不改稅務、FIFO、合併付款與備份規則。測試追蹤見 [TEST_REPORT.md](../../TEST_REPORT.md)。

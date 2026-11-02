# 四個離線工具：UI 修訂 ui.1／修改標註 1.1.0

本次維持四份獨立 HTML。未加入 CDN、外部字體、React 或同目錄執行依賴；會計、分類帳、PDF、營業稅的原有業務 JavaScript 逐段比對相同，資料格式與儲存 key 維持原本契約。UI 修訂版本記錄於各頁 `OFFLINE_REVIEW_CONFIG.appVersion`，不宣稱會計規則或 PDF 引擎有新版。

## 四頁檢查與修改

| 工具 | 檢查發現 | 本次調整 |
| --- | --- | --- |
| 營業稅 | 已有完整工作台與報表設計，鍵盤焦點與選取狀態仍可加強 | 保留操作結構；補上清楚的焦點外框、側欄選取提示、按下回饋與減少動態效果設定 |
| 分類帳 | 匯入提示較小，原生檔案按鈕與介面不一致 | 匯入提示字級、檔案按鈕、收合說明與標題層級微調 |
| PDF | 初始工作區只顯示產品名與選檔按鈕，首次操作缺少方向 | 加入開檔後的操作說明、本機處理提示；簡化品牌色，補上焦點與暗色主要按鈕文字對比 |
| 會計計算機 | 桌面按鍵鋪滿整行，批量計算需要向下找 | 1100px 以上改為左側單次計算、右側批量計算；強化結果字級與運算鍵分組，窄視窗維持單欄 |

四頁共用的修改標註加入滑鼠／觸控拖曳、方向鍵移動、Shift 加速、Home／歸位、各工具位置記憶與視窗邊界限制。入口收合時保留小佔位，展開後有完整移動／歸位操作；列印時隱藏標註 UI。

拖曳僅從把手開始，選單、輸入、文字選取與面板捲動仍可正常使用。觸控拖曳後的第一下點按另有測試，避免瀏覽器抑制相容 click 造成面板無法立即開啟；相容 click 不會重複切換模式。

## 設計參考與連線

以下網址已實際取得 HTTP 200 的頁面或公開 README；這表示本環境能取得資料，不代表完整互動站點已逐一操作驗收。

- [shadcn/ui](https://ui.shadcn.com)：清楚的元件層級、焦點與狀態語言；本次以原生 HTML／CSS 實作。
- [Beautiful UI](https://www.beautifului.dev/)、[BeUI](https://beui.dev)、[Rare UI](https://www.rareui.com/)：元件與狀態參考，保留工具頁的工作密度。
- [Transitions](https://transitions.dev)：短暫的操作回饋，並尊重 `prefers-reduced-motion`。
- [Oil UI](https://github.com/oil-oil/oil-ui) 與[展示站](https://ui.oiloil.org/)：依產品用途決定工作區，使用實際桌面／手機截圖檢查。
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)、[Impeccable](https://github.com/pbakaus/impeccable)：配色、字級、間距與視覺層級的參考。
- [Awesome AI Tools for UI](https://github.com/maxbogo/awesome-ai-tools-for-ui)：資源索引。本次未安裝其中的第三方技能或生成工具。

GitHub 連線及 clone 成功。這輪不需要另建 Stitch、Uizard、Visily、Figma 或墨刀專案。

## 驗證方式

本輪結果：**[GitHub CI 的 42 組 Chromium file:// 離線檢查全部通過](https://github.com/yung13yubabie/offline-html-tools/actions/runs/41373364685)**；本機 42 組 localhost HTTP 檢查（外網封鎖）也通過；所有既有純回歸套件與標註的 17 項合成檢查通過。桌面、手機及展開標註的實際截圖已人工檢視。

- 執行所有既有純回歸套件，以及 `feedback/test-static.cjs` 17 項合成檢查。
- 四頁桌面／390px 手機的載入、既有主流程、標註選區、儲存、編輯、刪除、JSON／TXT 匯出、重新載入與業務操作隔離。
- 新增四頁浮動面板拖曳、重載位置、鍵盤移動、縮小視窗、草稿保留、歸位不刪標註、列印隱藏與減少動態效果檢查。
- 使用 Chromium CDP 真實觸控事件驗證四頁拖曳後立即點開、填寫並儲存；屬觸控模擬，未宣稱實機手機或 Safari／Firefox 通過。
- 比對四頁業務 script 與原主線相同、內嵌標註與來源一致；重跑內嵌工具不改變檔案。
- 修正舊標記範圍內混有計算機方程式 script 的情況，避免重新內嵌標註時刪除該功能；原 script 內容保留。

目前環境的受管理 Chromium 以 `ERR_BLOCKED_BY_ADMINISTRATOR` 禁止 `file://`。未修改瀏覽器政策；改以明確允許的 localhost HTTP 預覽，攔截外部 HTTP／HTTPS，測試報告會記錄此模式。**本機 HTTP 測試不代替直接開檔驗證**；另外已在 GitHub CI 使用 file:// 完成 42 組檢查，實測程式提交為 [9214c62](https://github.com/yung13yubabie/offline-html-tools/commit/9214c62d12e51d0f7136f2259dad20e40d8c0652)。這是 Chromium 人工資料驗證，不代表所有瀏覽器與實際客戶資料均驗收。

開發環境可用以下方式重現 HTTP 模式（需事先啟動本機伺服器）；使用者下載 HTML 不需要這些套件或伺服器：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# 另一個終端機執行
OFFLINE_TEST_BASE_URL=http://127.0.0.1:8765/ \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
node tests/browser-smoke.cjs
```

測試的結構化結果與人工資料截圖由 `test-results/browser/` 產生；該資料夾不提交。候選版仍需使用者以備份副本核對日常工作，不等於正式驗收。

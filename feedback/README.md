# 離線區塊修改標註 1.0.0

這是「提出修改需求」模式，**不是所見即所得編輯器，也不是遠端 AI**。儲存標註不代表 HTML 已經依需求修改。每份成品仍為單一 HTML，無 CDN、套件、網路或 sibling JS 依賴。

## 整合到每份 HTML

1. 為每個 app 指定不同、固定的 `appId`，並在發佈修改版時更新 `appVersion`。
2. 在適合標註的靜態外層容器加上唯一識別及靜態名稱：

```html
<section data-review-id="order-entry" data-review-name="訂單輸入區塊">…</section>
```

   不得把客戶名稱、訂單編號、資料列內容或動態輸入放進這兩個屬性。ID 建議 `[a-z0-9-]+`，保持跨版本穩定；變更標題不必變更 ID。避免逐筆業務資料列標註。未提供明確區塊時，會使用語意容器與位置型 CSS selector，名稱僅為「區塊 N」；這類 fallback 在版面變更後可能失效。
3. 在 DOM 容器建立後、`</body>` 之前加入設定及 **JS 全文**：

```html
<script>window.OFFLINE_REVIEW_CONFIG = {appId:'your-unique-app-id', appVersion:'2026.10.30.1'};</script>
<script>
/* 將 offline-review.js 的完整原始碼貼在此處，不是 src 引用 */
</script>
```

4. 每頁僅放一次。若 app 有更早註冊的 `window` capture 階段破壞性事件處理，需把標註初始化安排在它們之前（DOM 已存在後），或對那些 app handlers 明確加入模式防護。瀏覽器已執行過的更早 capture handler 無法由後來 handler 回溯阻止。一般 inline/bubble click、form submit、鍵盤輸入已由本模組 capture 攔截。未測試跨來源 iframe、第三方 widget、Shadow DOM 業務 UI；此模組不保證攔截其自訂操作。
5. 最終驗收應直接開啟各成品 `file://`，確認一般模式維持原功能、啟用模式不會執行原刪除/儲存/提交、Escape 恢復操作、手機可捲動、下載 JSON/TXT。

## 行為與隱私

- 右下角「修改標註」開啟模式；點區塊或用選單選取。選擇內層已標記區塊時，以最接近點擊目標的區塊優先。
- 提供儲存、編輯、刪除（需確認）、JSON 與 TXT 匯出。匯出只是下載本機需求檔，沒有上傳，也沒有觸發程式修改。
- 可使用鍵盤選單、Tab、Escape。一般模式只顯示啟動按鈕，其餘覆層不攔截操作；編輯模式可捲動頁面。
- 不讀取頁面文字、業務 input value、顧客資料或截圖。只記錄靜態區塊 ID/名稱/selector、使用者輸入的需求、時間與版本。
- DOM 呈現全部使用 `textContent`，不將需求文字解讀為 HTML。
- 本機 key：`offline-review:1:<encodeURIComponent(appId)>`；只存取這個 key，不清除或修改其他業務 storage。
- 儲存不可用/資料損壞會顯示警告，仍能在記憶體記錄並匯出。瀏覽器 `file://` storage 行為可能因瀏覽器、檔案位置或隱私模式而異；**匯出是必要備份**。app 版本不加入 key，讓同 app 新版可讀到舊需求，且每則需求保留記錄版本。
- 最多 100 則標註，每則 4000 字；載入資料超過 600,000 字元會拒絕載入並顯示警告。
- 同 app 多視窗不是協作編輯，可能最後寫入者覆蓋。沒有跨視窗同步、匯入、雲端備份或需求自動套用。
- 未儲存的草稿離開模式前會確認是否捨棄；介面無攔截頁面關閉/重載的 handler。

## 交付檔案

- `offline-review.js`：可直接內嵌的 JS 與 Shadow DOM CSS。
- `demo.html`：完整離線、人工合成的測試頁，包含內嵌模組。
- `test-static.cjs`：Node 內建模組的合成 DOM / 安全靜態檢查。
- `test-review.cjs`：Playwright + Chromium 桌面、手機與 storage failure 測試；只測合成資料。
- `test-results.txt`：已執行的合成檢查證據。

## 驗證證據與限制

已通過 `node --check offline-review.js` 與 `node test-static.cjs` 的 **17 項**：新增資料結構與版本、文字安全/編輯、reload hydration、app 隔離、capture guard、Escape 恢復、刪除、storage failure 記憶體保留、fallback selector、不含網路/innerHTML/reload/prototype 修改與 DOM 文字抓取，以及未存草稿確認、介面快捷鍵隔離、大型 storage 拒絕、100 則上限、JSON 無 BOM，以及原生 modal 中標註入口移入／關閉後還原與限定區塊。

**尚未通過／未實際執行 UI 測試**：`node test-review.cjs` 在 Chromium 啟動階段被執行環境限制擋住，`socket() failed: Operation not permitted`。一次 `require_escalated` 啟動也在測試前因 `bwrap: Can't create file at /home/agent/.codex/sessions: Read-only file system` 失敗；未讀取該路徑、未重複嘗試。沒有產生或檢視 UI 截圖。不能將合成 DOM 測試當成瀏覽器或實際四個 app 的功能通過。

在具備 Playwright 與 Chromium 的允許環境執行：

```sh
node --check offline-review.js
node test-static.cjs
node test-review.cjs
```

瀏覽器測試預期檢查 12 個流程，成功才產生 `desktop-review.png` 與 `mobile-review.png`。測試依賴僅為開發驗收使用，成品 HTML 本身完全無依賴。

## 最終整合檢查

四頁所有標註 ID 唯一；14 個 script 區塊語法通過，內嵌模組與來源完全一致，重跑區塊注入不新增重複屬性。詳細靜態區塊清單在 `integration-audit.json`。計算器新增結果、按鍵、批量、稅務設定／憑證及保險欄位；PDF 新增側欄工具、輸出模式與參數；VAT 新增待辦、日曆、明細、通知與設定子區塊。

原生 `<dialog>` 啟用時只把本模組 host 移到 modal 內以避免被 inert；關閉後還原，不呼叫業務 dialog 開關 API。該行為通過合成 DOM 檢查，實際瀏覽器 top-layer/focus 可用性仍待 CI 驗收。`tools/embed-feedback.py` 的細部靜態名稱依賴建置時 `feedback/static-block-map.py`，成品 HTML 沒有這項執行期依賴。

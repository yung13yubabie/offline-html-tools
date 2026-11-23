"use strict";

const assert = require("node:assert/strict");

module.exports = async function intranetFinder(browser, appURL) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  try {
    const requested = [];
    const blocked = [];
    await context.route(/^https?:/i, route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(appURL).origin) return route.continue();
      if (url.origin !== "https://folder.test") {
        blocked.push(url.href);
        return route.abort();
      }
      requested.push(url.pathname);
      const index = {
        "/docs/": '<h1>Index of /docs/</h1><a href="../">Parent Directory</a><a href="sub/">sub</a><a href="https://elsewhere.test/">Other</a>',
        "/docs/sub/": '<h1>Index of /docs/sub/</h1><a href="../">Parent Directory</a><a href="Q4%20%23.xlsx">Q4 #.xlsx</a>'
      }[url.pathname];
      return route.fulfill({
        status: index ? 200 : 404,
        contentType: "text/html",
        headers: { "access-control-allow-origin": "*" },
        body: index || ""
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const file = name => ({ kind: "file", name });
      const folder = (name, children = []) => ({
        kind: "directory", name, async *values() { yield* children; }
      });
      window.showDirectoryPicker = async () => folder("範例資料", [
        file("首頁.txt"),
        folder("財務", [folder("2026", [file("十一月 # 帳簿.xlsx")])]),
        folder("空資料夾")
      ]);
      window.showOpenFilePicker = async options => {
        document.body.dataset.openedIn = options.startIn.name;
        throw new DOMException("Closed test picker", "AbortError");
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { async writeText(path) { document.body.dataset.copied = path; } }
      });
    });
    await page.goto(appURL);
    assert.equal(await page.title(), "內網資料檢索器");
    assert.equal(new URL(page.url()).protocol, new URL(appURL).protocol);
    const base = String.raw`\\fileserver\share\範例資料`;
    const source = page.getByLabel("資料夾路徑或網址");
    const rows = page.getByRole("listitem");
    const search = page.getByRole("textbox", { name: "搜尋檔名或路徑" });

    await source.fill(base);
    await page.getByRole("button", { name: "讀取", exact: true }).click();
    await page.getByText("4 個資料夾 · 2 個檔案", { exact: true }).waitFor();
    assert.equal(await rows.count(), 2);
    await page.getByRole("button", { name: "空資料夾", exact: true }).waitFor();
    await page.getByRole("button", { name: "全收合", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "2026", exact: true }).count(), 0);
    await page.getByRole("button", { name: "全展開", exact: true }).click();
    await page.getByRole("button", { name: "2026", exact: true }).waitFor();

    await page.keyboard.press("Control+F5");
    assert.equal(await search.evaluate(input => input === document.activeElement), true);
    await search.fill("財務 XLSX");
    await page.getByText("1 筆結果 · 4 個資料夾 · 2 個檔案", { exact: true }).waitFor();
    const book = page.getByRole("button", { name: "複製路徑 十一月 # 帳簿.xlsx" });
    await book.click();
    await page.getByText("已複製路徑", { exact: true }).waitFor();
    assert.equal(await page.locator("body").getAttribute("data-copied"), base + String.raw`\財務\2026\十一月 # 帳簿.xlsx`);
    await page.getByRole("button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).click();
    assert.equal(await page.locator("body").getAttribute("data-opened-in"), "2026");
    await page.getByRole("button", { name: "清除搜尋" }).click();

    await page.setViewportSize({ width: 390, height: 820 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.getByRole("button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).isVisible());

    await source.fill("https://folder.test/docs");
    await page.getByRole("button", { name: "讀取", exact: true }).click();
    const webFile = page.getByRole("button", { name: "複製路徑 Q4 #.xlsx" });
    await webFile.click();
    assert.equal(await page.locator("body").getAttribute("data-copied"), "https://folder.test/docs/sub/Q4%20%23.xlsx");
    assert.deepEqual(requested, ["/docs/", "/docs/sub/"]);
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
};

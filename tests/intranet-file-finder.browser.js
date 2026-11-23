"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

module.exports = async function intranetFinder(browser, appURL) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const fixture = mkdtempSync(join(tmpdir(), "intranet-finder-"));
  try {
    const fixtureRoot = join(fixture, "範例資料");
    const fixtureFolder = join(fixtureRoot, "財務", "2026");
    mkdirSync(fixtureFolder, { recursive: true });
    writeFileSync(join(fixtureFolder, "目錄測試.txt"), "Synthetic browser test");
    const requested = [];
    const blocked = [];
    const requestsWithSensitiveHeaders = [];
    await context.route(/^https?:/i, async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(appURL).origin) return route.continue();
      if (url.origin !== "https://folder.test") {
        blocked.push(url.href);
        return route.abort();
      }
      requested.push(url.pathname);
      const headers = await route.request().allHeaders();
      if (headers.cookie || headers.referer || headers.authorization) requestsWithSensitiveHeaders.push(url.pathname);
      const index = {
        "/docs/": '<h1>Index of /docs/</h1><a href="../">Parent Directory</a><a href="sub/">sub</a><a href="https://elsewhere.test/">Other</a><img src="https://elsewhere.test/pixel"><script>document.body.dataset.leaked = "yes"</script>',
        "/docs/sub/": '<h1>Index of /docs/sub/</h1><a href="../">Parent Directory</a><a href="Q4%20%23.xlsx">Q4 #.xlsx</a>'
      }[url.pathname];
      return route.fulfill({
        status: index ? 200 : 404,
        contentType: "text/html",
        headers: { "access-control-allow-origin": "*" },
        body: index ? '<link rel="icon" href="data:,">' + index : ""
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const file = name => ({
        kind: "file", name, getFile() { throw new Error("Directory scans must not open file contents"); }
      });
      window.directoryRequests = [];
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (url, options) => {
        const { credentials, referrerPolicy, cache, redirect } = options;
        window.directoryRequests.push({ credentials, referrerPolicy, cache, redirect });
        return nativeFetch(url, options);
      };
      const folder = (name, children = []) => ({
        kind: "directory", name, async *values() { yield* children; }
      });
      window.showDirectoryPicker = async () => folder("範例資料", [
        file("首頁.txt"),
        folder("財務", [folder("2026", [
          file("十一月 # 帳簿.xlsx"),
          file("Report-2.xlsx"), file("Report-10.pdf"), file("Report #.txt"), file("Report 舊 版本.csv")
        ])]),
        folder("行政", [file("Report-1.pdf")]),
        folder("空資料夾")
      ]);
      window.showOpenFilePicker = async () => { throw new Error("Opening a folder must never invoke a picker"); };
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
    const listNames = () => rows.locator(".file-label").allTextContents();
    const search = page.getByRole("textbox", { name: "搜尋檔名或路徑" });
    const sortKey = page.getByRole("combobox", { name: "排序依據" });
    const fromFile = new URL(appURL).protocol === "file:";

    await source.fill(base);
    await page.getByRole("button", { name: "讀取", exact: true }).click();
    await page.getByText("5 個資料夾 · 7 個檔案", { exact: true }).waitFor();
    assert.equal(await rows.count(), 7);
    await page.getByRole("button", { name: "空資料夾", exact: true }).waitFor();
    await page.getByRole("button", { name: "全收合", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "2026", exact: true }).count(), 0);
    await page.getByRole("button", { name: "全展開", exact: true }).click();
    await page.getByRole("button", { name: "2026", exact: true }).waitFor();

    await page.keyboard.press("Control+F5");
    assert.equal(await search.evaluate(input => input === document.activeElement), true);
    await search.fill("財務 帳簿");
    await page.getByText("1 筆結果 · 5 個資料夾 · 7 個檔案", { exact: true }).waitFor();
    const book = page.getByRole("button", { name: "複製路徑 十一月 # 帳簿.xlsx" });
    await book.click();
    await page.getByText("已複製路徑", { exact: true }).waitFor();
    assert.equal(await page.locator("body").getAttribute("data-copied"), base + String.raw`\財務\2026\十一月 # 帳簿.xlsx`);
    if (fromFile) {
      const location = page.getByRole("link", { name: "開啟位置 十一月 # 帳簿.xlsx" });
      assert.equal(await location.getAttribute("href"), "file://fileserver/share/%E7%AF%84%E4%BE%8B%E8%B3%87%E6%96%99/%E8%B2%A1%E5%8B%99/2026/");
      assert.equal(await location.getAttribute("target"), "_blank");
    }
    await page.getByRole("button", { name: "清除搜尋" }).click();

    await search.fill('Report -# -"舊 版本"');
    await page.getByText("3 筆結果 · 5 個資料夾 · 7 個檔案", { exact: true }).waitFor();
    assert.deepEqual(await listNames(), ["Report-1.pdf", "Report-2.xlsx", "Report-10.pdf"]);
    await sortKey.selectOption("type");
    assert.deepEqual(await listNames(), ["Report-1.pdf", "Report-10.pdf", "Report-2.xlsx"]);
    await page.getByRole("button", { name: "升冪" }).click();
    assert.deepEqual(await listNames(), ["Report-2.xlsx", "Report-10.pdf", "Report-1.pdf"]);
    await page.getByRole("button", { name: "降冪" }).click();
    await sortKey.selectOption("folder");
    assert.deepEqual(await listNames(), ["Report-1.pdf", "Report-2.xlsx", "Report-10.pdf"]);
    await search.fill("−.pdf");
    await page.getByText("5 筆結果 · 5 個資料夾 · 7 個檔案", { exact: true }).waitFor();
    assert((await listNames()).every(name => !name.endsWith(".pdf")));
    await page.getByRole("button", { name: "清除搜尋" }).click();

    assert.equal(await page.locator("time.created-label").count(), 0);
    const importDates = async (root, files) => {
      await page.locator("#dateFile").setInputFiles({
        name: "dates.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ version: 1, root, files }))
      });
    };
    await page.getByRole("button", { name: "匯入日期" }).click();
    const dateDialog = page.getByRole("dialog", { name: "匯入建立日期" });
    await dateDialog.getByText("Windows 產生日期清單").click();
    const command = await dateDialog.getByRole("textbox", { name: "Windows PowerShell 指令" }).inputValue();
    assert.match(command, /\.CreationTime\.ToString/);
    assert(!command.includes(base), "The copied command must not embed the private path");
    await dateDialog.getByRole("button", { name: "複製指令" }).click();
    await dateDialog.getByText("已複製指令。").waitFor();
    await importDates("其他資料", [{ path: "首頁.txt", created: "2026-04-04" }]);
    await dateDialog.getByText("日期清單應對應「範例資料」。").waitFor();
    await importDates("範例資料", [{ path: "首頁.txt", created: "2026-02-30" }]);
    await dateDialog.getByText("日期清單含有無效日期、路徑或重複的檔案。").waitFor();
    await importDates("範例資料", [
      { path: "首頁.txt", created: "2026-04-04" },
      { path: "財務/2026/Report-2.xlsx", created: "2026-04-07" },
      { path: "財務/2026/Report-10.pdf", created: "2026-04-10" },
      { path: "舊檔.txt", created: "2026-04-02" }
    ]);
    await page.getByText("3 筆有日期", { exact: true }).waitFor();
    assert.equal(await page.locator("time.created-label").count(), 3);
    const from = page.getByLabel("建立日期起日");
    const to = page.getByLabel("建立日期迄日");
    await from.fill("2026-04-07");
    await to.fill("2026-04-10");
    assert.deepEqual(await listNames(), ["Report-2.xlsx", "Report-10.pdf"]);
    await search.fill("Report -.pdf");
    await page.getByText("1 筆結果 · 5 個資料夾 · 7 個檔案", { exact: true }).waitFor();
    assert.deepEqual(await listNames(), ["Report-2.xlsx"]);
    await page.getByRole("button", { name: "清除搜尋" }).click();
    await to.fill("2026-04-07");
    assert.deepEqual(await listNames(), ["Report-2.xlsx"]);
    await to.fill("2026-04-06");
    await page.getByText("起日須早於或等於迄日").waitFor();
    assert.equal(await rows.count(), 7);
    await page.getByRole("button", { name: "清除日期" }).click();
    assert.deepEqual(requested, []);
    assert.deepEqual(blocked, []);

    await page.setViewportSize({ width: 390, height: 820 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.getByRole(fromFile ? "link" : "button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).isVisible());

    await page.getByRole("button", { name: "選擇資料夾", exact: true }).click();
    await page.getByText("填入完整路徑後即可直接開啟位置。", { exact: true }).waitFor();
    assert.equal(await page.locator("time.created-label").count(), 0);
    await page.getByRole("button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).click();
    const locationDialog = page.getByRole("dialog", { name: "資料夾完整路徑" });
    const locationInput = locationDialog.getByRole("textbox", { name: "完整路徑" });
    const confirmLocation = locationDialog.getByRole("button", { name: "開啟位置" });
    await locationInput.fill(join(fixture, "別的資料夾"));
    await confirmLocation.click();
    await locationDialog.getByText("路徑應指向「範例資料」。").waitFor();
    await locationInput.fill(fixtureRoot);
    if (fromFile) {
      const expectedUrl = pathToFileURL(fixtureFolder + "/").href;
      async function checkDirectory(tab) {
        await tab.waitForURL(expectedUrl);
        // The headless shell returns Chromium's directory data without its visual listing template.
        assert.match(await tab.content(), /目錄測試\.txt/);
      }
      const [tab] = await Promise.all([context.waitForEvent("page"), confirmLocation.click()]);
      await checkDirectory(tab);
      await tab.close();
      const [directTab] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("link", { name: "開啟位置 十一月 # 帳簿.xlsx" }).click()
      ]);
      await checkDirectory(directTab);
      await directTab.close();
    } else {
      await confirmLocation.click();
      const manual = page.getByRole("dialog", { name: "資料夾位置" });
      assert.equal(await manual.getByRole("textbox").inputValue(), fixtureFolder);
      await manual.getByRole("button", { name: "關閉" }).click();
    }
    assert.equal(await source.inputValue(), fixtureRoot);
    await page.getByRole("button", { name: "複製路徑 十一月 # 帳簿.xlsx" }).click();
    assert.equal(await page.locator("body").getAttribute("data-copied"), join(fixtureFolder, "十一月 # 帳簿.xlsx"));

    await source.fill("https://folder.test/docs");
    await page.getByRole("button", { name: "讀取", exact: true }).click();
    const webFile = page.getByRole("button", { name: "複製路徑 Q4 #.xlsx" });
    await webFile.click();
    assert.equal(await page.locator("body").getAttribute("data-copied"), "https://folder.test/docs/sub/Q4%20%23.xlsx");
    const [webTab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "開啟位置 Q4 #.xlsx" }).click()
    ]);
    await webTab.getByText("Index of /docs/sub/").waitFor();
    assert.equal(webTab.url(), "https://folder.test/docs/sub/");
    assert.deepEqual(requested, ["/docs/", "/docs/sub/", "/docs/sub/"]);
    assert.deepEqual(requestsWithSensitiveHeaders, []);
    const fetchOptions = { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "error" };
    assert.deepEqual(await page.evaluate(() => window.directoryRequests), [fetchOptions, fetchOptions]);
    assert.equal(await page.locator("body").getAttribute("data-leaked"), null);
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    rmSync(fixture, { recursive: true, force: true });
  }
};

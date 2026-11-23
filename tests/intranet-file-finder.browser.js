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
        body: index ? '<link rel="icon" href="data:,">' + index : ""
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", entry => console.log("APP CONSOLE", entry.type(), entry.text()));
    context.on("page", popup => {
      popup.on("framenavigated", frame => console.log("TAB NAVIGATION", frame.url()));
      popup.on("console", entry => console.log("TAB CONSOLE", entry.type(), entry.text()));
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      const file = name => ({ kind: "file", name });
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

    await page.setViewportSize({ width: 390, height: 820 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.getByRole(fromFile ? "link" : "button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).isVisible());

    await page.getByRole("button", { name: "選擇資料夾", exact: true }).click();
    await page.getByText("填入完整路徑後即可直接開啟位置。", { exact: true }).waitFor();
    await page.getByRole("button", { name: "開啟位置 十一月 # 帳簿.xlsx" }).click();
    const locationDialog = page.getByRole("dialog", { name: "資料夾完整路徑" });
    const locationInput = locationDialog.getByRole("textbox", { name: "完整路徑" });
    const confirmLocation = locationDialog.getByRole("button", { name: "開啟位置" });
    await locationInput.fill(join(fixture, "別的資料夾"));
    await confirmLocation.click();
    await locationDialog.getByText("路徑應指向「範例資料」。").waitFor();
    await locationInput.fill(fixtureRoot);
    if (fromFile) {
      const [tab] = await Promise.all([context.waitForEvent("page"), confirmLocation.click()]);
      await tab.waitForLoadState().catch(error => console.log(error));
      console.log("FIRST TAB", tab.url(), await tab.title(), (await tab.content()).slice(-2500));
      await tab.getByText("目錄測試.txt", { exact: true }).waitFor({ timeout: 1000 }).catch(error => console.log(error.message));
      console.log("EXPECTED URL",pathToFileURL(fixtureFolder + "/").href);
      await tab.close();
      const [directTab] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("link", { name: "開啟位置 十一月 # 帳簿.xlsx" }).click()
      ]);
      await directTab.waitForLoadState().catch(error => console.log(error));
      console.log("DIRECT TAB", directTab.url(), await directTab.title(), (await directTab.content()).slice(-2500));
      await directTab.getByText("目錄測試.txt", { exact: true }).waitFor({ timeout: 1000 }).catch(error => console.log(error.message));
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
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    rmSync(fixture, { recursive: true, force: true });
  }
};

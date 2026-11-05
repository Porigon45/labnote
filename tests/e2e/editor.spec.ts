import { test, expect } from "@playwright/test";
import { entryFixture } from "./fixtures";

test("全ブロックを追加し順序を保存、主要キーボード操作と再表示", async ({ page, request }) => {
  const entry = entryFixture();
  await page.goto(`/entries/${entry.id}`);
  const editor = page.locator(".bn-editor[contenteditable=true]");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.insertText("観察：良好");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("次の操作");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  for (const type of ["heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "codeBlock", "math", "table", "image", "file", "divider", "pageLink", "timestamp"]) {
    await page.getByLabel("追加するブロック").selectOption(type);
    await page.getByRole("button", { name: "追加", exact: true }).click();
  }
  await page.getByRole("button", { name: "複製", exact: true }).click();
  await page.getByRole("button", { name: "上へ", exact: true }).click();
  await expect(page.getByLabel("本文の保存状態")).toHaveText("保存済み", { timeout: 20000 });
  const saved = await (await request.get(`/api/records/${entry.id}`)).json();
  expect(saved.body.map((b: { type: string }) => b.type)).toEqual(expect.arrayContaining(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "codeBlock", "math", "table", "image", "file", "divider", "pageLink", "timestamp"]));
  await page.reload();
  await expect(editor).toContainText("観察：良好");
  const restored = await (await request.get(`/api/records/${entry.id}`)).json();
  expect(restored.body).toEqual(saved.body);
});

test("保存失敗後も下書きを復元して再送し、古い更新番号は409になる", async ({ page, request }) => {
  const entry = entryFixture();
  await page.route(`**/api/records/${entry.id}`, route => route.request().method() === "PATCH" ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue());
  await page.goto(`/entries/${entry.id}`);
  await page.locator(".bn-editor[contenteditable=true]").click();
  await page.keyboard.insertText("ネットワーク断の観察");
  await expect(page.getByLabel("本文の保存状態")).toHaveText("再送待ち");
  await page.reload();
  await expect(page.locator(".bn-editor")).toContainText("ネットワーク断の観察");
  await page.unroute(`**/api/records/${entry.id}`);
  await expect(page.getByLabel("本文の保存状態")).toHaveText("保存済み", { timeout: 15000 });
  const stale = await request.patch(`/api/records/${entry.id}`, { data: { revision: 1, body: [] } });
  expect(stale.status()).toBe(409);
  const record = await (await request.get(`/api/records/${entry.id}`)).json();
  expect(JSON.stringify(record.body)).toContain("ネットワーク断の観察");
});

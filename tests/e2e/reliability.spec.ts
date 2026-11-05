import { test, expect } from "@playwright/test";
import { entryFixture, fixture } from "./fixtures";
test("保存容量と日次バックアップを表示する", async ({ page }) => {
  await page.goto("/storage");
  await expect(page.getByRole("heading", { name: "保存とバックアップ", exact: true })).toBeVisible();
  await expect(page.getByText("本日のバックアップがあります。", { exact: true })).toBeVisible();
  await expect(page.getByLabel("添付の使用容量")).toBeVisible();
});
test("壊れた下書きを自動破棄せず、元データの保存と確認付き復旧を案内する", async ({ page }) => {
  const entry = entryFixture();
  await page.addInitScript(id => localStorage.setItem(`labnote-draft:${id}`, "{broken-draft"), entry.id);
  await page.goto(`/entries/${entry.id}`);
  await expect(page.getByRole("button", { name: "下書きの元データを保存" })).toBeVisible();
  expect(await page.evaluate(id => localStorage.getItem(`labnote-draft:${id}`), entry.id)).toBe("{broken-draft");
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "保存済みの記録を開く" }).click();
  await expect(page.locator(".bn-editor")).toBeVisible();
});
test("予期しないエディタ障害をエラー境界で表示する", async ({ page, request }) => {
  const entry = entryFixture();
  fixture(repo => repo.update(entry.id, 1, { body: [{ id: "broken", type: "unsupported-legacy-block" }] }));
  await page.goto(`/entries/${entry.id}`);
  await expect(page.getByRole("heading", { name: "記録を表示できませんでした" })).toBeVisible();
  await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();
  const response = await request.patch(`/api/records/${entry.id}`, { data: { revision: 2, body: [{ id: "invalid", type: "unsupported" }] } });
  expect(response.status()).toBe(400);
});

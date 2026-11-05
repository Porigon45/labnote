import { test, expect } from "@playwright/test";

test("簡潔なホーム画面を表示できる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "実験ノート", exact: true })).toBeVisible();
  await expect(page.getByText("ノート機能を準備中", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByText("開発ロードマップ")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "実験ノート", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("サーバーからSQLiteへ接続でき、内部パスを公開しない", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  expect(response.headers()["cache-control"]).toBe("no-store");
});

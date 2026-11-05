import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { getStorageConfig } from "../../src/server/config";
import { openDatabase } from "../../src/server/db";
import { createRepository } from "../../src/server/db/repository";

async function create(page: Page, title: string, date?: string) {
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  if (date) await page.getByLabel("日付", { exact: true }).fill(date);
  await page.getByRole("button", { name: "作成する", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  return page.url();
}

test("階層の作成・編集・日付順・再読み込み・直接URL・パンくず遷移", async ({ page }) => {
  const suffix = randomUUID();
  const project = `酵母の研究 ${suffix}`;
  const series = `培養条件 ${suffix}`;
  const entry = `初日の観察 ${suffix}`;
  const edited = `観察結果 ${suffix}`;
  await page.goto("/projects");
  const projectUrl = await create(page, project);
  const seriesUrl = await create(page, series);
  const entryUrl = await create(page, entry, "2026-11-04");
  await page.getByLabel("タイトル", { exact: true }).fill(edited);
  await page.getByLabel("日付", { exact: true }).fill("2026-11-03");
  await page.getByRole("combobox", { name: "状態", exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("status")).toHaveText("保存しました。");
  // Save a second time to verify that the form receives the new revision.
  await page.getByLabel("日付", { exact: true }).fill("2026-11-02");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("complementary", { name: "記録の情報" }).getByText("2026-11-02", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(edited);
  await expect(page.getByLabel("日付", { exact: true })).toHaveValue("2026-11-02");
  await expect(page.getByRole("combobox", { name: "状態", exact: true })).toHaveValue("completed");
  const crumbs = page.getByRole("navigation", { name: "パンくず" });
  await crumbs.getByRole("link", { name: series, exact: true }).click();
  await expect(page).toHaveURL(seriesUrl);
  const newer = `翌日の観察 ${suffix}`;
  await create(page, newer, "2026-11-05");
  await page.goto(seriesUrl);
  await expect(page.locator(".record-list li").first()).toContainText(newer);
  await page.getByRole("navigation", { name: "パンくず" }).getByRole("link", { name: project, exact: true }).click();
  await expect(page).toHaveURL(projectUrl);
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(series) })).toBeVisible();
  await page.goto("/series");
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(series) })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(edited) })).toBeVisible();
  await page.goto(entryUrl);
  await expect(page.getByRole("heading", { name: edited, exact: true })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate(el => el.clientWidth));
  await page.screenshot({ path: "test-results/m2-entry.png", fullPage: true });
});

test("不正入力と競合を表示し、入力を保持する", async ({ page, context }) => {
  await page.goto("/projects");
  await page.getByLabel("タイトル", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "作成する" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("タイトルを入力してください。");
  await create(page, `競合研究 ${randomUUID()}`);
  await create(page, "比較実験");
  const url = await create(page, "編集前", "2026-11-05");
  const other = await context.newPage();
  await other.goto(url);
  await page.getByLabel("タイトル", { exact: true }).fill("先に保存した内容");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await other.getByLabel("タイトル", { exact: true }).fill("古い画面の入力");
  await other.getByRole("button", { name: "変更を保存" }).click();
  await expect(other.getByRole("main").getByRole("alert")).toContainText("別の編集が保存されています");
  await expect(other.getByLabel("タイトル", { exact: true })).toHaveValue("古い画面の入力");
  await page.reload();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue("先に保存した内容");
});

test("アーカイブした親配下の記録を一覧・最近の記録・直接URLから除外する", async ({ page }) => {
  const connection = openDatabase(getStorageConfig({ LABNOTE_DATA_DIR: resolve("test-results/storage/data"), LABNOTE_ATTACHMENTS_DIR: resolve("test-results/storage/attachments"), LABNOTE_BACKUP_DIR: resolve("test-results/storage/backups") }));
  const repo = createRepository(connection);
  const title = `非表示 ${randomUUID()}`;
  let entryId: string;
  try {
    const project = repo.create({ kind: "project", title });
    const series = repo.create({ kind: "series", parentId: project.id, title });
    entryId = repo.create({ kind: "entry", parentId: series.id, title, date: "2026-11-05" }).id;
    repo.setArchived(project.id, project.revision, true);
  } finally { connection.close(); }
  for (const url of ["/", "/projects", "/series"]) {
    await page.goto(url);
    await expect(page.getByText(title)).toHaveCount(0);
  }
  await page.goto(`/entries/${entryId}`);
  await expect(page.getByRole("heading", { name: "記録が見つかりません" })).toBeVisible();
  await page.goto(`/projects/${entryId}`);
  await expect(page.getByRole("heading", { name: "記録が見つかりません" })).toBeVisible();
});

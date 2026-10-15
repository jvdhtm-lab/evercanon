import { expect, test, type Page } from "@playwright/test";

/**
 * The primary reader journey, run against a database that global setup has
 * reset to the seed story. Covers reading, proposing from the root timeline,
 * voting on a branch, exploring alternatives, and opening a shared timeline.
 */

async function rootTimelineUrl(page: Page): Promise<string> {
  await page.goto("/stories/the-beginning");
  const href = await page
    .getByRole("link", { name: "Seed", exact: true })
    .first()
    .getAttribute("href");
  if (!href) throw new Error("could not find the root timeline link");
  return new URL(href, page.url()).toString();
}

async function proposeFrom(page: Page, parentUrl: string, text: string) {
  await page.goto(parentUrl);
  await page
    .locator("summary")
    .filter({ hasText: "Propose an alternative" })
    .first()
    .click();

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  await textarea.fill(text);

  const submit = page.getByRole("button", { name: "Submit proposal" }).first();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page).toHaveURL(/\/stories\/the-beginning\/t\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("story-text")).toContainText(text);
}

test("read, propose, vote, and explore alternatives", async ({ page }) => {
  const stamp = Date.now();
  const altA = `Playwright branch A ${stamp}`;
  const altB = `Playwright branch B ${stamp}`;

  // 1. Reading: the homepage redirects to the preferred version (the seed).
  await page.goto("/");
  await expect(page).toHaveURL(/\/stories\/the-beginning$/);
  await expect(page.getByTestId("story-text")).toContainText("irrational number");

  // 2. Propose two sibling branches from the root timeline.
  const rootUrl = await rootTimelineUrl(page);
  await proposeFrom(page, rootUrl, altA);
  await proposeFrom(page, rootUrl, altB);

  // 3. With no votes, the preferred version is the earliest branch (A).
  await page.goto("/stories/the-beginning");
  await expect(page.getByTestId("story-text")).toContainText(altA);

  await page.getByTestId("alternatives-toggle").first().click();
  const panel = page.getByTestId("alternatives-panel").first();
  await expect(panel).toBeVisible();

  const rowB = panel.locator("li").filter({ hasText: altB });
  await expect(rowB).toBeVisible();

  // 4. Upvote B and see the score update in place.
  await rowB.getByRole("button", { name: "Upvote this version" }).click();
  await expect(rowB.getByTestId("net-score")).toHaveText("1");

  // 5. Open the alternative timeline by its stable URL.
  await rowB.getByRole("link", { name: altB }).click();
  await expect(page).toHaveURL(/\/stories\/the-beginning\/t\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("story-text")).toContainText(altB);

  // 6. The vote makes B the preferred version.
  await page.goto("/stories/the-beginning");
  await expect(page.getByTestId("story-text")).toContainText(altB);
});

test("alternative panel is keyboard operable and closes on Escape", async ({
  page,
}) => {
  await page.goto("/stories/the-beginning");

  const toggle = page.getByTestId("alternatives-toggle").first();
  if ((await toggle.count()) === 0) {
    test.skip(true, "no branch alternatives in this database state");
  }

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("alternatives-panel").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("alternatives-panel").first()).toBeHidden();
});

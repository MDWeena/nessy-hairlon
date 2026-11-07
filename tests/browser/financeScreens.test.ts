// @vitest-environment node
// Finances screens in a real browser. Always: nothing overflows at 360px. With SCREENSHOTS_DIR
// set, also captures every screen at 360/390/414px and desktop, light and dark.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { mockBackend, startApp, type App, type OverflowProblem } from "./harness.js";

const DIR = process.env.SCREENSHOTS_DIR;
let app: App;
let browser: Browser;

beforeAll(async () => {
  app = await startApp();
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
});

/** Nothing wider than the viewport, and no element sticking out of the page. */
async function overflow(page: Page): Promise<OverflowProblem[]> {
  return page.evaluate(() => {
    const out: { where: string; detail: string }[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth) out.push({ where: "page", detail: `${document.documentElement.scrollWidth} > ${window.innerWidth}` });
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main td, main span"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > 0 && r.right > window.innerWidth + 0.5) out.push({ where: el.tagName, detail: `"${(el.textContent ?? "").trim().slice(0, 30)}" right ${Math.round(r.right)} > ${window.innerWidth}` });
    }
    return out;
  });
}

async function openAdmin(width: number, theme: "light" | "dark") {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: "block" });
  await mockBackend(context, { signedIn: true, allowFonts: !!DIR });
  const page = await context.newPage();
  await page.goto(`${app.url}/admin`);
  await page.getByText("This month so far").waitFor();
  return { context, page };
}

async function goToFinances(page: Page) {
  // The sidebar is an off-canvas drawer on phones — dispatch the click directly.
  await page.getByRole("button", { name: "Finances" }).first().dispatchEvent("click");
  await page.getByTestId("finance-overview").waitFor();
}

async function tall(page: Page, width: number, path: string) {
  await page.setViewportSize({ width, height: 3600 });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
  await page.setViewportSize({ width, height: 900 });
}

describe("Finances screens at 360px", () => {
  it("overview, a month report, expenses and business costs fit without overflow", async () => {
    const { context, page } = await openAdmin(360, "light");
    try {
      expect(await overflow(page), "dashboard").toEqual([]);
      await goToFinances(page);
      expect(await overflow(page), "overview").toEqual([]);
      await page.locator("[data-testid^=month-card-]").first().click();
      await page.getByTestId("month-report").waitFor();
      expect(await overflow(page), "month report").toEqual([]);
      await page.getByRole("button", { name: "All months" }).click();
      await page.getByRole("tab", { name: "Expenses" }).click();
      await page.getByTestId("expenses-panel").waitFor();
      expect(await overflow(page), "expenses").toEqual([]);
      await page.getByRole("button", { name: "Settings" }).first().dispatchEvent("click");
      await page.getByTestId("business-costs").waitFor();
      expect(await overflow(page), "business costs").toEqual([]);
    } finally {
      await context.close();
    }
  }, 120_000);
});

describe.skipIf(!DIR)("Finances screenshots", () => {
  const report: Record<string, OverflowProblem[]> = {};
  afterAll(() => { if (DIR) writeFileSync(join(DIR, "finance-overflow-report.json"), JSON.stringify(report, null, 2)); });

  for (const width of [360, 390, 414, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      it(`${width}px ${theme}`, async () => {
        mkdirSync(DIR!, { recursive: true });
        const shot = (name: string) => join(DIR!, `${width}-${theme}-${name}.png`);
        const { context, page } = await openAdmin(width, theme);
        try {
          await page.waitForTimeout(500);
          report[`${width}-${theme}-dashboard`] = await overflow(page);
          await page.screenshot({ path: shot("1-dashboard") });
          await goToFinances(page);
          report[`${width}-${theme}-overview`] = await overflow(page);
          await tall(page, width, shot("2-overview"));
          await page.locator("[data-testid^=month-card-]").last().click();
          await page.getByTestId("month-report").waitFor();
          report[`${width}-${theme}-report-launch`] = await overflow(page);
          await tall(page, width, shot("3-month-report-launch"));
          await page.getByRole("button", { name: "All months" }).click();
          await page.locator("[data-testid^=month-card-]").first().click();
          await page.getByTestId("month-report").waitFor();
          await tall(page, width, shot("4-month-report-current"));
          await page.getByRole("button", { name: "All months" }).click();
          await page.getByRole("tab", { name: "Expenses" }).click();
          await page.getByRole("button", { name: /Add expense/ }).click();
          report[`${width}-${theme}-expenses`] = await overflow(page);
          await tall(page, width, shot("5-expenses"));
          await page.getByRole("button", { name: "Settings" }).first().dispatchEvent("click");
          await page.getByTestId("business-costs").waitFor();
          await page.getByTestId("business-costs").scrollIntoViewIfNeeded();
          report[`${width}-${theme}-business-costs`] = await overflow(page);
          await page.getByTestId("business-costs").screenshot({ path: shot("6-business-costs") });
        } finally {
          await context.close();
        }
        expect(Object.entries(report).filter(([k, v]) => k.startsWith(`${width}-${theme}`) && v.length)).toEqual([]);
      }, 120_000);
    }
  }
});

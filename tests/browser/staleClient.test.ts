// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mockBackend, startApp, type App } from "./harness.js";

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

/** Exactly what staging returns for the pre-16 Oct frontend's direct insert once 023 is applied. */
const STALE_RLS = { code: "42501", details: null, hint: null, message: 'new row violates row-level security policy for table "bookings"' };

async function newClient(): Promise<{ context: BrowserContext; page: Page; createCalls: () => number }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await mockBackend(context, { signedIn: false });
  let calls = 0;
  await context.route(/\/rest\/v1\/rpc\/create_booking/, route => { calls++; return route.fulfill({ status: 401, json: STALE_RLS }); });
  const page = await context.newPage();
  return { context, page, createCalls: () => calls };
}

/** Walks the booking form up to (not including) submit. */
async function fillBooking(page: Page, { navigate = true } = {}) {
  if (navigate) await page.goto(`${app.url}/book`);
  await page.getByRole("button", { name: /Skip, book something new/ }).click();
  await page.getByRole("button", { name: /[1-9]\d* slots? available/ }).first().click();
  await page.getByRole("button", { name: /^\d{1,2}:00 (AM|PM)$/ }).first().click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByText("Knotless Braids").first().click();
  await page.getByRole("button", { name: /Review Booking/ }).click();
  await page.getByPlaceholder("Your name").fill("Ada Obi");
  await page.getByPlaceholder("080...", { exact: true }).fill("0816 127 1343");
  await page.getByPlaceholder("you@example.com").fill("ada@example.com");
}

describe("a stale backend refusal on submit", () => {
  it("shows only the friendly refresh prompt — never the raw database error", async () => {
    const { context, page, createCalls } = await newClient();
    try {
      await fillBooking(page);
      await page.getByRole("button", { name: /Submit Booking Request/ }).click();
      const prompt = page.getByTestId("refresh-prompt");
      await prompt.waitFor();
      expect(createCalls()).toBe(1);
      expect(await prompt.innerText()).toContain("This page needs a quick refresh to finish your booking. Your details are saved.");
      const body = await page.locator("body").innerText();
      for (const leak of ["row-level", "violates", "42501", "policy"]) expect(body).not.toContain(leak);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("'Refresh and continue' reloads and brings the whole form back", async () => {
    const { context, page } = await newClient();
    try {
      await fillBooking(page);
      const chosenTime = await page.locator("text=/\\d{1,2}:00 (AM|PM)/").first().innerText();
      await page.getByRole("button", { name: /Submit Booking Request/ }).click();
      await page.getByTestId("refresh-prompt").waitFor();
      await Promise.all([
        page.waitForEvent("load"),
        page.getByRole("button", { name: "Refresh and continue" }).click(),
      ]);
      // Back on the review step with everything as it was — nothing to retype.
      await page.getByPlaceholder("Your name").waitFor();
      expect(await page.getByPlaceholder("Your name").inputValue()).toBe("Ada Obi");
      expect(await page.getByPlaceholder("080...", { exact: true }).inputValue()).toBe("0816 127 1343");
      expect(await page.getByPlaceholder("you@example.com").inputValue()).toBe("ada@example.com");
      const body = await page.locator("body").innerText();
      expect(body).toContain("Knotless Braids");
      expect(body).toContain(chosenTime.trim());
      expect(await page.getByTestId("refresh-prompt").count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);
});

describe("a newer build deployed while the page was open", () => {
  it("prompts before submitting instead of sending the booking from the old copy", async () => {
    const { context, page, createCalls } = await newClient();
    let versionHits = 0;
    await context.route(/\/version\.json/, route => { versionHits++; return route.fulfill({ json: { buildId: "newer-build-000" }, headers: { "cache-control": "no-store" } }); });
    try {
      // Arriving with nothing filled in, the page first reloads onto the newer build by itself
      // (the version.json here never matches, so the copy stays "old" after it) — then the
      // client starts typing, and the check right before submitting catches it.
      await Promise.all([page.waitForEvent("load"), page.goto(`${app.url}/book`)]);
      await page.waitForEvent("load");
      await fillBooking(page, { navigate: false });
      await page.getByRole("button", { name: /Submit Booking Request/ }).click();
      await page.getByTestId("refresh-prompt").waitFor();
      expect(createCalls()).toBe(0);
      expect(versionHits).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("reloads by itself when nobody is mid-form — once, never in a loop", async () => {
    const { context, page } = await newClient();
    await context.route(/\/version\.json/, route => route.fulfill({ json: { buildId: "newer-build-000" } }));
    let loads = 0;
    page.on("load", () => { loads++; });
    try {
      await page.goto(`${app.url}/`);
      await page.waitForTimeout(3000);
      // The first load sees a newer build and reloads; the reload doesn't reload again.
      expect(loads).toBe(2);
    } finally {
      await context.close();
    }
  }, 90_000);

  it("leaves the page alone when the deployed build matches", async () => {
    const { context, page } = await newClient();
    let loads = 0;
    page.on("load", () => { loads++; });
    try {
      await page.goto(`${app.url}/`);
      await page.waitForTimeout(2500);
      expect(loads).toBe(1);
    } finally {
      await context.close();
    }
  }, 90_000);
});

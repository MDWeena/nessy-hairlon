// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { BOOKINGS, findOverflow, mockBackend, startApp, type App } from "./harness.js";

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

async function openBookings(width: number) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  await mockBackend(context, { signedIn: true });
  const page = await context.newPage();
  // ?booking= deep-links straight to the Bookings page, unfiltered.
  await page.goto(`${app.url}/admin?booking=${BOOKINGS[0].id}`);
  await page.getByTestId("booking-card").nth(BOOKINGS.length - 1).waitFor();
  return { context, page };
}

describe("admin Bookings list on a phone", () => {
  it("fits every card and action row at 360px — nothing clipped, no sideways scroll", async () => {
    const { context, page } = await openBookings(360);
    try {
      expect(await page.getByTestId("booking-card").count()).toBe(BOOKINGS.length);
      const problems = await page.evaluate(findOverflow, ['[data-testid="booking-card"]', '[data-testid="booking-actions"]']);
      expect(problems).toEqual([]);
    } finally {
      await context.close();
    }
  }, 60_000);

  it("gives every action button a 44px tap target below the tablet breakpoint", async () => {
    const { context, page } = await openBookings(360);
    try {
      const heights = await page.locator('[data-testid="booking-actions"] button').evaluateAll(
        buttons => buttons.map(b => ({ text: b.textContent?.trim(), height: b.getBoundingClientRect().height })),
      );
      expect(heights.length).toBeGreaterThan(0);
      for (const { text, height } of heights) expect(height, text).toBeGreaterThanOrEqual(44);
    } finally {
      await context.close();
    }
  }, 60_000);

  it("shows 'Custom style' instead of a dash, and no bare price placeholder", async () => {
    const { context, page } = await openBookings(360);
    try {
      const custom = page.getByTestId("booking-card").filter({ hasText: "Oluwadamilola" });
      await expect(custom.innerText()).resolves.toContain("Custom style");
      // Needs Review has no price yet: the old bare "—" placeholder is gone from every card.
      for (const text of await page.getByTestId("booking-card").allInnerTexts()) {
        expect(text).not.toMatch(/^—$/m);
      }
    } finally {
      await context.close();
    }
  }, 60_000);

  it("keeps the single-row layout on tablet and desktop", async () => {
    const { context, page } = await openBookings(1024);
    try {
      // On md+ the action area sits beside the client details, so the card is one row tall-ish:
      // the actions' top edge is level with the client block, not below it.
      const layout = await page.getByTestId("booking-card").nth(1).evaluate(card => {
        const [details, actions] = Array.from(card.children) as HTMLElement[];
        return { detailsTop: details.getBoundingClientRect().top, actionsTop: actions.getBoundingClientRect().top, actionsLeft: actions.getBoundingClientRect().left, detailsRight: details.getBoundingClientRect().right };
      });
      expect(layout.actionsLeft).toBeGreaterThan(layout.detailsRight);
      expect(Math.abs(layout.actionsTop - layout.detailsTop)).toBeLessThan(40);
    } finally {
      await context.close();
    }
  }, 60_000);
});

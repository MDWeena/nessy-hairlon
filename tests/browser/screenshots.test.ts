// @vitest-environment node
// Opt-in visual sweep: SCREENSHOTS_DIR=/some/dir npx vitest run tests/browser/screenshots.test.ts
// Captures the admin Bookings list, the admin reschedule panel, and the Track Booking page's
// reschedule/cancel UI at common phone widths in light and dark mode, and records any
// horizontal overflow it finds in overflow-report.json alongside the images.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { BOOKINGS, findOverflow, mockBackend, startApp, type App, type OverflowProblem } from "./harness.js";

const DIR = process.env.SCREENSHOTS_DIR;
const WIDTHS = [360, 375, 390, 414];
const THEMES = ["light", "dark"] as const;

let app: App;
let browser: Browser;
const report: Record<string, OverflowProblem[]> = {};

/** Nothing on the page may extend past the viewport, and no card/action row may overflow. */
async function check(page: Page, name: string) {
  const problems = await page.evaluate(findOverflow, ['[data-testid="booking-card"]', '[data-testid="booking-actions"]']);
  const offscreen = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("button, a, input, textarea"))
    // Ignore anything parked entirely off-screen on purpose (the closed admin sidebar drawer).
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5); })
    .map(el => ({ where: "viewport", detail: `"${(el.textContent ?? el.getAttribute("placeholder") ?? "").trim().slice(0, 30)}" right edge ${el.getBoundingClientRect().right.toFixed(0)} > ${window.innerWidth}` })));
  report[name] = [...problems, ...offscreen];
}

describe.skipIf(!DIR)("mobile layout screenshots", () => {
  beforeAll(async () => {
    mkdirSync(DIR!, { recursive: true });
    app = await startApp();
    browser = await chromium.launch();
  }, 120_000);

  afterAll(async () => {
    writeFileSync(join(DIR!, "overflow-report.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    await app?.close();
  });

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      it(`${width}px ${theme}`, async () => {
        const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: join(DIR!, `${width}-${theme}-${name}.png`), fullPage });

        // Admin: the full Bookings list, then the reschedule panel open on a confirmed booking.
        const admin = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: theme, serviceWorkers: "block" });
        await mockBackend(admin, { signedIn: true, allowFonts: true });
        const page = await admin.newPage();
        await page.goto(`${app.url}/admin?booking=${BOOKINGS[0].id}`);
        await page.getByTestId("booking-card").nth(BOOKINGS.length - 1).waitFor();
        await page.waitForLoadState("networkidle");
        await check(page, `${width}-${theme}-admin-bookings`);
        // The admin content scrolls inside its own container, so a full-page capture would only
        // show one screenful — make the viewport tall enough to hold the whole list instead.
        await page.setViewportSize({ width, height: 4200 });
        await page.waitForTimeout(200);
        await shot(page, "1-admin-bookings", false);
        await page.setViewportSize({ width, height: 800 });

        await page.getByTestId("booking-card").filter({ hasText: "Temitope" }).getByRole("button", { name: /Reschedule/ }).click();
        const firstDay = page.getByRole("button", { name: /slots? available/ }).first();
        await firstDay.waitFor();
        await firstDay.click();
        await page.waitForTimeout(300);
        await check(page, `${width}-${theme}-admin-reschedule`);
        await page.getByText(/Reschedule Temitope/).scrollIntoViewIfNeeded();
        await shot(page, "2-admin-reschedule-panel", false);
        await admin.close();

        // Track Booking: the result cards, the client reschedule picker, and the cancel panel.
        const client = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: theme, serviceWorkers: "block" });
        await mockBackend(client, { signedIn: false, allowFonts: true });
        const track = await client.newPage();
        await track.goto(`${app.url}/track`);
        await track.getByPlaceholder(/BK-/).fill("BK-AAAAAAA5");
        await track.getByRole("button", { name: /search|track|find/i }).first().click();
        await track.getByText("BK-AAAAAAA5").first().waitFor();
        await track.waitForLoadState("networkidle");
        await check(track, `${width}-${theme}-track-results`);
        await shot(track, "3-track-results");

        const confirmedCard = track.locator("div", { hasText: "BK-AAAAAAA5" }).filter({ has: track.getByRole("button", { name: "Reschedule", exact: true }) }).last();
        await confirmedCard.getByRole("button", { name: "Reschedule", exact: true }).click();
        await track.getByPlaceholder("080... or you@example.com").fill("08161271343");
        await track.getByRole("button", { name: /See available times/ }).click();
        const clientDay = track.getByRole("button", { name: /slots? available/ }).first();
        await clientDay.waitFor();
        await clientDay.click();
        await track.waitForTimeout(300);
        await check(track, `${width}-${theme}-track-reschedule`);
        await track.getByText("Reschedule appointment").scrollIntoViewIfNeeded();
        await shot(track, "4-track-reschedule-picker", false);

        await track.getByRole("button", { name: "Cancel", exact: true }).first().click();
        await track.getByRole("button", { name: /Yes, cancel/ }).waitFor();
        await check(track, `${width}-${theme}-track-cancel`);
        await track.getByText("Cancel appointment").scrollIntoViewIfNeeded();
        await shot(track, "5-track-cancel-panel", false);
        await client.close();

        expect(Object.entries(report).filter(([k, v]) => k.startsWith(`${width}-${theme}`) && v.length > 0)).toEqual([]);
      }, 120_000);
    }
  }
});

// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { BOOKINGS, day, findOverflow, mockBackend, startApp, type App } from "./harness.js";

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

async function withBookings(width: number, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  await mockBackend(context, { signedIn: true });
  const page = await context.newPage();
  try {
    await page.goto(`${app.url}/admin?booking=${BOOKINGS[0].id}`);
    await page.getByTestId("booking-card").nth(BOOKINGS.length - 1).waitFor();
    // ?booking= smooth-scrolls to that card; let it settle (menus close on scroll, by design).
    await page.waitForTimeout(1500);
    await fn(page);
  } finally {
    await context.close();
  }
}

const cardFor = (page: Page, name: string) => page.locator("[data-testid=booking-card]").filter({ hasText: name });
const tabCount = async (page: Page, label: string) => {
  const text = await page.getByRole("button", { name: new RegExp(`^${label}\\s*\\(\\d+\\)$`) }).innerText();
  return Number(text.match(/\((\d+)\)/)![1]);
};

describe("admin Bookings list", () => {
  it("has a tab per status, and the tab counts add up to All", async () => {
    await withBookings(1024, async (page) => {
      const labels = ["Needs Review", "Quoted", "Payment Verification", "Confirmed", "Completed", "Cancelled"];
      const counts = await Promise.all(labels.map(l => tabCount(page, l)));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(await tabCount(page, "All"));
      expect(await tabCount(page, "All")).toBe(BOOKINGS.length);
      expect(await tabCount(page, "Completed")).toBe(BOOKINGS.filter(b => b.status === "completed").length);
      expect(await tabCount(page, "Cancelled")).toBe(BOOKINGS.filter(b => b.status === "cancelled").length);
    });
  }, 60_000);

  it("lists upcoming soonest-first, then a Past divider, then past most-recent-first", async () => {
    await withBookings(1024, async (page) => {
      const dates = await page.locator("[data-testid=booking-card]").evaluateAll(cards =>
        cards.map(c => (c.textContent ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ""));
      const today = day(0);
      const firstPast = dates.findIndex(d => d < today);
      expect(firstPast).toBeGreaterThan(0);
      const upcoming = dates.slice(0, firstPast), past = dates.slice(firstPast);
      expect(upcoming).toEqual([...upcoming].sort());
      expect(past).toEqual([...past].sort().reverse());
      expect(past.every(d => d < today)).toBe(true);
      // The divider sits exactly between the two groups.
      const dividerBeforeFirstPast = await page.evaluate((i) => {
        const cards = Array.from(document.querySelectorAll("[data-testid=booking-card]"));
        const divider = document.querySelector("[data-testid=past-divider]");
        return !!divider && !!(divider.compareDocumentPosition(cards[i]) & Node.DOCUMENT_POSITION_FOLLOWING)
          && !!(divider.compareDocumentPosition(cards[i - 1]) & Node.DOCUMENT_POSITION_PRECEDING);
      }, firstPast);
      expect(dividerBeforeFirstPast).toBe(true);
    });
  }, 60_000);

  it("lists Completed most recent first", async () => {
    await withBookings(1024, async (page) => {
      await page.getByRole("button", { name: /^Completed\s*\(/ }).click();
      await page.locator("[data-testid=booking-card]").first().waitFor();
      await page.waitForTimeout(300);
      const dates = await page.locator("[data-testid=booking-card]").evaluateAll(cards => cards.map(c => (c.textContent ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ""));
      expect(dates.length).toBe(BOOKINGS.filter(b => b.status === "completed").length);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(await page.locator("[data-testid=past-divider]").count()).toBe(0);
    });
  }, 60_000);

  it("marks today's bookings", async () => {
    await withBookings(390, async (page) => {
      await expect(cardFor(page, "Kemi Balogun").getByTestId("today-marker").innerText()).resolves.toMatch(/today/i);
      expect(await page.getByTestId("today-marker").count()).toBe(BOOKINGS.filter(b => b.booking_date === day(0)).length);
    });
  }, 60_000);

  it("shows at most one primary button per card, matching the status", async () => {
    await withBookings(390, async (page) => {
      const primaries = await page.locator("[data-testid=booking-card]").evaluateAll(cards => cards.map(c => {
        const name = c.querySelector(".text-sm.font-semibold")?.textContent ?? "";
        const buttons = Array.from(c.querySelectorAll("[data-testid=booking-actions] button"))
          .map(b => b.textContent?.trim() ?? "")
          .filter(t => ["Set Price", "Verify Payment", "Mark Completed"].includes(t));
        return [name, buttons];
      }));
      for (const [, buttons] of primaries) expect((buttons as string[]).length).toBeLessThanOrEqual(1);
      const byName = Object.fromEntries(primaries.map(([n, b]) => [n, (b as string[])[0] ?? null]));
      expect(byName["Ada Obi"]).toBe("Set Price");
      expect(byName["Bisi Adeyemi"]).toBe("Verify Payment");
      expect(byName["Kemi Balogun"]).toBe("Mark Completed");
      expect(byName["Yetunde Olatunji"]).toBe("Mark Completed");
      expect(byName["Chiamaka Nwosu"]).toBeNull();
      expect(byName["Temitope Fashola-Williams"]).toBeNull();
      expect(byName["Ngozi Eze"]).toBeNull();
      expect(byName["Funke Akindele"]).toBeNull();
    });
  }, 60_000);

  it("puts Reschedule, history and Move back to Confirmed in the More menu", async () => {
    await withBookings(390, async (page) => {
      const menuFor = async (name: string) => {
        await page.getByRole("button", { name: `More actions for ${name}` }).click();
        await page.getByRole("menu").waitFor();
        const items = await page.getByRole("menuitem").allInnerTexts();
        await page.keyboard.press("Escape");
        await page.getByRole("menu").waitFor({ state: "detached" });
        return items;
      };
      expect(await menuFor("Temitope Fashola-Williams")).toEqual(["Reschedule", "Reschedule history"]);
      expect(await menuFor("Yetunde Olatunji")).toEqual(["Reschedule (missed appointment)"]);
      expect(await menuFor("Chiamaka Nwosu")).toEqual(["Reschedule", "Confirm without deposit", "Reschedule history"]);
      expect(await menuFor("Ngozi Eze")).toEqual(["Move back to Confirmed"]);
      expect(await page.getByRole("button", { name: "More actions for Funke Akindele" }).count()).toBe(0);
    });
  }, 60_000);

  it("Mark Completed opens an in-page confirmation with the balance warning and email option", async () => {
    await withBookings(390, async (page) => {
      await cardFor(page, "Kemi Balogun").getByRole("button", { name: "Mark Completed" }).click();
      const panel = page.getByTestId("mark-completed-panel");
      await expect(panel.innerText()).resolves.toContain("Balance not marked as paid. Mark completed anyway?");
      expect(await panel.getByRole("checkbox").isChecked()).toBe(true);
      expect(await page.evaluate(findOverflow, ["[data-testid=booking-card]", "[data-testid=mark-completed-panel]"])).toEqual([]);
    });
  }, 60_000);

  it("Reschedule opens in a sheet instead of pushing the cards below it down", async () => {
    await withBookings(390, async (page) => {
      const next = cardFor(page, "Yetunde Olatunji");
      // Position within the list (not the viewport, which scrolls to reach the button).
      const offsetInList = () => next.evaluate(el => {
        const list = el.closest(".rounded-xl") as HTMLElement;
        return el.getBoundingClientRect().top - list.getBoundingClientRect().top;
      });
      const before = await offsetInList();
      await page.getByRole("button", { name: "More actions for Temitope Fashola-Williams" }).click();
      await page.getByRole("menuitem", { name: "Reschedule", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Reschedule Temitope Fashola-Williams" });
      await dialog.waitFor();
      expect(await offsetInList()).toBe(before);
      const sheet = await dialog.boundingBox();
      expect(sheet!.x).toBe(0);
      expect(Math.round(sheet!.y + sheet!.height)).toBe(900);
      await page.keyboard.press("Escape");
      expect(await page.getByRole("dialog").count()).toBe(0);
    });
  }, 60_000);
});

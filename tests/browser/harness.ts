import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { build, preview, type PreviewServer } from "vite";
import type { BrowserContext, Route } from "playwright";

/**
 * Real-browser layout tests: the production build, served by `vite preview`, with every
 * Supabase request answered from in-memory fixtures — no network, no real project. jsdom has no
 * layout engine (scrollWidth is always 0), so overflow can only be checked in a real browser.
 */

const SUPABASE_URL = "https://test.supabase.co";
const AUTH_STORAGE_KEY = "sb-test-auth-token";

export interface App {
  url: string;
  close: () => Promise<void>;
}

export async function startApp(): Promise<App> {
  const outDir = mkdtempSync(join(tmpdir(), "nessy-browser-test-"));
  // Already-set env vars win over .env files in Vite, so the build can never point at a real project.
  process.env.VITE_SUPABASE_URL = SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
  await build({ logLevel: "error", build: { outDir, emptyOutDir: true } });
  const server: PreviewServer = await preview({ logLevel: "error", build: { outDir }, preview: { port: 0, host: "127.0.0.1" } });
  const { port } = server.httpServer.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>(resolve => server.httpServer.close(() => resolve()));
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}

/** YYYY-MM-DD, `days` from today in Africa/Lagos (UTC+1, no DST) — the app's business timezone. */
export function day(days: number): string {
  return new Date(Date.now() + 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type Row = Record<string, unknown>;

const SERVICE_BRAIDS = "11111111-1111-4111-8111-111111111111";
const SERVICE_WIG = "22222222-2222-4222-8222-222222222222";

function booking(id: string, overrides: Row): Row {
  const now = new Date().toISOString();
  return {
    id, client_name: "Ada Obi", client_phone: "08161271343", client_email: "ada@example.com",
    booking_date: day(5), booking_time: "10:00 AM", service_ids: [SERVICE_BRAIDS],
    custom_style_url: null, custom_style_description: null, status: "pending_review", quoted_price: null,
    notes: null, deposit_confirmed_at: null, payment_proof_url: null, created_at: now, updated_at: now,
    attachment_preference: null, attachment_items: [], accessory_items: [], hair_service_cost: null,
    balance_paid_at: null, balance_reminder_sent_at: null, style_reference_urls: [], client_notes: null,
    custom_style_category: null, reference_code: id.replace(/-/g, "").slice(0, 8).toUpperCase(),
    client_reschedule_count: 0, last_rescheduled_at: null,
    ...overrides,
  };
}

const recently = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

/** One card per variant the layout has to cope with. */
export const BOOKINGS: Row[] = [
  booking("aaaaaaa1-0000-4000-8000-000000000001", {
    client_name: "Oluwadamilola Adebayo-Ogunleye Chukwuemeka", client_email: null, service_ids: [],
    custom_style_description: "Knotless braids, waist length, honey blonde tips",
  }),
  booking("aaaaaaa2-0000-4000-8000-000000000002", {
    service_ids: [SERVICE_BRAIDS, SERVICE_WIG], attachment_preference: "nessy_buys", booking_date: day(6),
  }),
  booking("aaaaaaa3-0000-4000-8000-000000000003", {
    client_name: "Chiamaka Nwosu", status: "quoted", quoted_price: 185000, client_email: null,
    last_rescheduled_at: recently, client_reschedule_count: 1, booking_date: day(7),
  }),
  booking("aaaaaaa4-0000-4000-8000-000000000004", {
    client_name: "Bisi Adeyemi", status: "deposit_paid", quoted_price: 60000, booking_date: day(8),
  }),
  booking("aaaaaaa5-0000-4000-8000-000000000005", {
    client_name: "Temitope Fashola-Williams", status: "confirmed", quoted_price: 1250000,
    deposit_confirmed_at: recently, last_rescheduled_at: recently, client_email: null, booking_date: day(9),
    custom_style_category: "Braids", style_reference_urls: ["https://www.instagram.com/p/abc123/"],
  }),
  booking("aaaaaaa6-0000-4000-8000-000000000006", {
    client_name: "Ngozi Eze", status: "completed", quoted_price: 90000, deposit_confirmed_at: recently,
    client_email: null, booking_date: day(-3),
  }),
  booking("aaaaaaa7-0000-4000-8000-000000000007", {
    client_name: "Funke Akindele", status: "cancelled", quoted_price: 45000, booking_date: day(4),
  }),
  // Today, late enough that it hasn't started: "Today" marker + Mark Completed.
  booking("aaaaaaa8-0000-4000-8000-000000000008", {
    client_name: "Kemi Balogun", status: "confirmed", quoted_price: 70000, deposit_confirmed_at: recently,
    booking_date: day(0), booking_time: "11:59 PM",
  }),
  // A confirmed booking whose day has gone by — a no-show to rebook.
  booking("aaaaaaa9-0000-4000-8000-000000000009", {
    client_name: "Yetunde Olatunji", status: "confirmed", quoted_price: 50000, deposit_confirmed_at: recently,
    booking_date: day(-2), booking_time: "12:00 PM",
  }),
  booking("aaaaaa10-0000-4000-8000-000000000010", {
    client_name: "Halima Bello", status: "completed", quoted_price: 80000, deposit_confirmed_at: recently,
    balance_paid_at: recently, booking_date: day(-6),
  }),
];

const FIXTURES: Record<string, Row[]> = {
  bookings: BOOKINGS,
  services: [
    // Same shape as the seed data in 001_initial_schema.sql: price is text (or null with a range).
    { id: SERVICE_BRAIDS, category: "Styling", name: "Knotless Braids", description: "", duration: "4-6 hrs", price: null, price_range_min: 15000, price_range_max: 45000, icon_name: "Sparkles", sort_order: 1, image_url: null, created_at: "2026-01-01T00:00:00Z" },
    { id: SERVICE_WIG, category: "Wigs", name: "Wig Install", description: "", duration: "2 hrs", price: "₦30,000", price_range_min: null, price_range_max: null, icon_name: "Sparkles", sort_order: 2, image_url: null, created_at: "2026-01-01T00:00:00Z" },
  ],
  settings: [
    ["business_name", "Nessy Hairlon"], ["phone", "08000000000"], ["deposit_percentage", 50],
    ["min_booking_notice_hours", 24], ["bank_name", "Test Bank"], ["account_number", "0123456789"], ["account_name", "Nessy"],
    ["location_url", "https://maps.app.goo.gl/nessy"],
  ].map(([key, value], i) => ({ id: `s${i}`, key, value })),
  schedule_defaults: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day_key, i) => ({
    id: `d${i}`, day_key, is_open: true, start_hour: 10, end_hour: 16, max_slots_per_day: 3, min_gap_hours: 3,
  })),
  blocked_slots: [],
  booking_reschedules: [],
  testimonials: [],
  gallery: [],
};

/** Minimal PostgREST: eq/neq/in filters, count headers, single-object responses. */
function answerRest(route: Route, table: string) {
  const request = route.request();
  if (!["GET", "HEAD"].includes(request.method())) return route.fulfill({ status: 204, body: "" });
  let rows = FIXTURES[table] ?? [];
  if (table === "public_booking_slots") {
    rows = BOOKINGS.filter(b => b.status !== "cancelled").map(b => ({ booking_date: b.booking_date, booking_time: b.booking_time, status: b.status }));
  }
  const params = new URL(request.url()).searchParams;
  for (const [key, raw] of params) {
    const m = raw.match(/^(eq|neq|in|gte|lte|gt|lt)\.(.*)$/);
    if (!m || ["select", "order", "limit", "offset", "or", "and"].includes(key)) continue;
    const [, op, value] = m;
    const v = (r: Row) => String(r[key]);
    if (op === "eq") rows = rows.filter(r => v(r) === value);
    if (op === "neq") rows = rows.filter(r => v(r) !== value);
    if (op === "gte") rows = rows.filter(r => v(r) >= value);
    if (op === "lte") rows = rows.filter(r => v(r) <= value);
    if (op === "gt") rows = rows.filter(r => v(r) > value);
    if (op === "lt") rows = rows.filter(r => v(r) < value);
    if (op === "in") {
      const values = value.replace(/^\(|\)$/g, "").split(",").map(x => x.replace(/^"|"$/g, ""));
      rows = rows.filter(r => values.includes(v(r)));
    }
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map(part => { const [col, dir] = part.split("."); return { col, desc: dir === "desc" }; });
    rows = [...rows].sort((a, b) => {
      for (const { col, desc } of keys) {
        const c = String(a[col]).localeCompare(String(b[col]));
        if (c !== 0) return desc ? -c : c;
      }
      return 0;
    });
  }
  const total = rows.length;
  const offset = Number(params.get("offset") ?? 0);
  const limit = params.get("limit");
  if (offset > 0 && offset >= total) {
    return route.fulfill({ status: 416, headers: { "content-type": "application/json", "content-range": `*/${total}` }, body: JSON.stringify({ code: "PGRST103", message: "Requested range not satisfiable" }) });
  }
  rows = rows.slice(offset, limit != null ? offset + Number(limit) : undefined);
  const headers = { "content-type": "application/json", "content-range": `${offset}-${Math.max(offset + rows.length - 1, offset)}/${total}`, "access-control-expose-headers": "content-range" };
  if ((request.headers().accept ?? "").includes("vnd.pgrst.object")) {
    if (rows.length === 0) return route.fulfill({ status: 406, headers, body: JSON.stringify({ code: "PGRST116", message: "no rows" }) });
    return route.fulfill({ status: 200, headers, body: JSON.stringify(rows[0]) });
  }
  return route.fulfill({ status: 200, headers, body: request.method() === "HEAD" ? "" : JSON.stringify(rows) });
}

const USER = { id: "00000000-0000-4000-8000-0000000000ad", aud: "authenticated", role: "authenticated", email: "admin@example.com", app_metadata: { provider: "email" }, user_metadata: {} };

/** Answers every Supabase call from fixtures and (optionally) starts signed in as the admin.
 * Everything else off-host is blocked unless `allowFonts`, so layout doesn't depend on the network. */
export async function mockBackend(context: BrowserContext, opts: { signedIn: boolean; allowFonts?: boolean }) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => {
    const url = new URL(route.request().url());
    if (url.origin === SUPABASE_URL) {
      if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ json: USER });
      if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ json: {} });
      if (url.pathname === "/rest/v1/rpc/lookup_bookings") {
        return route.fulfill({ json: BOOKINGS.map(b => ({ ...b, created_at: b.created_at })) });
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill({ json: [] });
      if (url.pathname.startsWith("/rest/v1/")) return answerRest(route, url.pathname.slice("/rest/v1/".length));
    }
    if (opts.allowFonts && /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.continue();
    return route.abort();
  });
  // The serverless routes don't exist under `vite preview`; the reschedule panel's eligibility
  // check is the only one these pages call before a user acts.
  await context.route(/\/api\/reschedule-client$/, route => route.fulfill({
    json: {
      ok: true, noticeHours: 24, eligibility: { eligible: true, reason: null, remaining: 2 },
      booking: { reference: "BK-AAAAAAA5", date: day(9), time: "10:00 AM", status: "confirmed" },
    },
  }));
  if (opts.signedIn) {
    const session = {
      access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER,
    };
    await context.addInitScript(([key, value]) => {
      window.localStorage.setItem(key, value);
    }, [AUTH_STORAGE_KEY, JSON.stringify(session)] as const);
  }
}

/** Every [data-testid] container, and every control inside a card, must fit horizontally. */
export interface OverflowProblem {
  where: string;
  detail: string;
}

export function findOverflow(selectors: string[]): OverflowProblem[] {
  const problems: OverflowProblem[] = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth) problems.push({ where: "page", detail: `scrollWidth ${doc.scrollWidth} > viewport ${window.innerWidth}` });
  for (const selector of selectors) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el, i) => {
      const where = `${selector}[${i}]`;
      if (el.scrollWidth > el.clientWidth) problems.push({ where, detail: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}` });
      const box = el.getBoundingClientRect();
      el.querySelectorAll<HTMLElement>("button, a, span, div, input").forEach(child => {
        const r = child.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.right > box.right + 0.5 || r.left < box.left - 0.5) {
          problems.push({ where, detail: `"${(child.textContent ?? "").trim().slice(0, 30)}" spans ${r.left.toFixed(0)}–${r.right.toFixed(0)}, container ${box.left.toFixed(0)}–${box.right.toFixed(0)}` });
        }
      });
    });
  }
  return problems;
}

import { vi } from "vitest";

/**
 * Minimal chainable mock for the Supabase query builder, for tests that need to
 * stub `supabase.from(table)...` without hitting a real project. Every chain
 * method (select/eq/in/order/etc.) returns the same thenable object, so any
 * chain shape resolves to `result` — call `mockSupabaseFrom({ data, error })`
 * per test and pass the returned object as `supabase.from`'s mock implementation,
 * e.g.:
 *
 *   vi.mock("../../lib/supabase", () => ({ supabase: { from: vi.fn() } }));
 *   import { supabase } from "../../lib/supabase";
 *   (supabase.from as Mock).mockReturnValue(mockSupabaseFrom({ data: [...], error: null }));
 */
export function mockSupabaseFrom(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "gte", "lt", "lte", "in", "not", "is",
    "order", "limit", "single", "maybeSingle",
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

/** Mock Supabase Auth session shape, for tests exercising authenticated/unauthenticated UI. */
export function mockSession(overrides: Partial<{ access_token: string; user: { id: string; email: string } }> = {}) {
  return {
    access_token: "test-access-token",
    user: { id: "test-user-id", email: "admin@test.com" },
    ...overrides,
  };
}

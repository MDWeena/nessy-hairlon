import { describe, expect, it } from "vitest";
import { buildQuotedPriceUpdate } from "./useBookings";

describe("buildQuotedPriceUpdate", () => {
  it("sets quoted_price and status without a category for a standard-service booking", () => {
    const update = buildQuotedPriceUpdate(20000);
    expect(update.quoted_price).toBe(20000);
    expect(update.status).toBe("quoted");
    expect(update.custom_style_category).toBeUndefined();
  });

  it("saves the custom style category on the booking item", () => {
    const update = buildQuotedPriceUpdate(15000, undefined, "Braiding");
    expect(update.custom_style_category).toBe("Braiding");
    expect(update.quoted_price).toBe(15000);
  });

  it("still carries materials through alongside a custom style category", () => {
    const update = buildQuotedPriceUpdate(
      30000,
      { hairServiceCost: 20000, attachmentItems: [{ type: "Braiding hair", quantity: 2, unitCost: 5000 }], accessoryItems: [] },
      "Locs",
    );
    expect(update.custom_style_category).toBe("Locs");
    expect(update.hair_service_cost).toBe(20000);
    expect(update.attachment_items).toEqual([{ type: "Braiding hair", quantity: 2, unit_cost: 5000 }]);
  });

  it("omits custom_style_category entirely when not provided", () => {
    const update = buildQuotedPriceUpdate(10000, { hairServiceCost: 5000, attachmentItems: [], accessoryItems: [] });
    expect("custom_style_category" in update).toBe(false);
  });
});

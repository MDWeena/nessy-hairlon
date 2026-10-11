import { describe, expect, it } from "vitest";
import { minPriceForCategory, minPriceForService, parsePriceText, validateCustomStyleQuote } from "./servicePricing";

describe("parsePriceText", () => {
  it("strips the naira sign and thousands separators", () => {
    expect(parsePriceText("₦8,000")).toBe(8000);
  });

  it("returns null for null/empty input", () => {
    expect(parsePriceText(null)).toBeNull();
    expect(parsePriceText("")).toBeNull();
  });

  it("returns null when there are no digits to parse", () => {
    expect(parsePriceText("TBD")).toBeNull();
  });
});

describe("minPriceForService", () => {
  it("prefers the range minimum when the service has one", () => {
    expect(minPriceForService({ price: null, priceRangeMin: 15000 })).toBe(15000);
  });

  it("falls back to the parsed fixed price when there's no range", () => {
    expect(minPriceForService({ price: "₦8,000", priceRangeMin: null })).toBe(8000);
  });

  it("returns null when neither is set/parseable", () => {
    expect(minPriceForService({ price: null, priceRangeMin: null })).toBeNull();
  });
});

describe("minPriceForCategory", () => {
  it("returns the lowest price across a mix of fixed and ranged services", () => {
    const items = [
      { price: "₦8,000", priceRangeMin: null },
      { price: null, priceRangeMin: 15000 },
      { price: "₦5,000", priceRangeMin: null },
    ];
    expect(minPriceForCategory(items)).toBe(5000);
  });

  it("returns null for an empty category", () => {
    expect(minPriceForCategory([])).toBeNull();
  });

  it("ignores services with no parseable price", () => {
    const items = [{ price: "TBD", priceRangeMin: null }, { price: "₦12,000", priceRangeMin: null }];
    expect(minPriceForCategory(items)).toBe(12000);
  });
});

describe("validateCustomStyleQuote", () => {
  it("requires a category before a price can be set", () => {
    expect(validateCustomStyleQuote({ category: null, price: 20000, minimumPrice: 10000 }))
      .toBe("Select a category for this custom style");
  });

  it("rejects a price below the category minimum", () => {
    const error = validateCustomStyleQuote({ category: "Braiding", price: 8000, minimumPrice: 10000 });
    expect(error).toBe("Price cannot be below the minimum of ₦10,000 for Braiding");
  });

  it("accepts a price exactly at the minimum", () => {
    expect(validateCustomStyleQuote({ category: "Braiding", price: 10000, minimumPrice: 10000 })).toBeNull();
  });

  it("accepts a price above the minimum", () => {
    expect(validateCustomStyleQuote({ category: "Braiding", price: 25000, minimumPrice: 10000 })).toBeNull();
  });

  it("accepts any positive price when the category has no known minimum", () => {
    expect(validateCustomStyleQuote({ category: "Braiding", price: 5000, minimumPrice: null })).toBeNull();
  });

  it("rejects a zero or negative price even with a category selected", () => {
    expect(validateCustomStyleQuote({ category: "Braiding", price: 0, minimumPrice: null }))
      .toBe("Enter a valid price");
  });
});

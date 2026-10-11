/** Fixed-price services store `price` as admin-typed free text (e.g. "₦8,000"), not a
 * number — this extracts the digits so it can be compared against a numeric quote. */
export function parsePriceText(price: string | null | undefined): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d]/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}

export interface ServicePriceLike {
  price: string | null;
  priceRangeMin: number | null;
}

/** A service's effective minimum: the range's own min_price when it has one, otherwise the
 * parsed fixed price. */
export function minPriceForService(item: ServicePriceLike): number | null {
  if (item.priceRangeMin != null) return item.priceRangeMin;
  return parsePriceText(item.price);
}

/** The lowest price among a category's services — the floor a custom-style quote classified
 * under that category shouldn't undercut. */
export function minPriceForCategory(items: ServicePriceLike[]): number | null {
  const prices = items.map(minPriceForService).filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export interface CustomStyleQuoteValidationInput {
  category: string | null;
  price: number;
  minimumPrice: number | null;
}

/** Validates a custom-style booking's quote before it can be saved — admin must classify it
 * under a service category, and the price can't undercut the cheapest service in that
 * category (keeps custom-style quotes roughly in line with the published menu). */
export function validateCustomStyleQuote({ category, price, minimumPrice }: CustomStyleQuoteValidationInput): string | null {
  if (!category) return "Select a category for this custom style";
  if (!price || price <= 0) return "Enter a valid price";
  if (minimumPrice != null && price < minimumPrice) {
    return `Price cannot be below the minimum of ₦${minimumPrice.toLocaleString()} for ${category}`;
  }
  return null;
}

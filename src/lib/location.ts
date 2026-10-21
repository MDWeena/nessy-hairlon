/** Shown when there's no usable map link — plain text, never a link. */
export const LOCATION_TEXT = "Lagos, Nigeria";
export const MAPS_LINK_TEXT = "Find us on Google Maps";
export const MAPS_LINK_ARIA_LABEL = "Open Nessy Hairlon's location in Google Maps";

/** The admin's "Location URL" setting if it's a usable https link, else null (so callers render
 * plain "Lagos, Nigeria" instead of a dead or unsafe link). */
export function mapsUrlFrom(setting: string | null | undefined): string | null {
  const url = (setting ?? "").trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) return null;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

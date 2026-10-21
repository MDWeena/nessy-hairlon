import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

const settings = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock("../../hooks/useSettings", () => ({ useSettings: () => ({ settings: settings.value }) }));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ t: { gold: "#C49A6C" }, isDark: true }) }));
vi.mock("./WeenaCredit", () => ({ WeenaCredit: () => null }));

const renderFooter = () => render(<Footer navigate={vi.fn()} onManageClick={vi.fn()} />);
const ALL_SET = { phone: "0816 127 1343", instagram: "@nessy_hairlon", location_url: "https://maps.app.goo.gl/nessy" };

beforeEach(() => { settings.value = { ...ALL_SET }; });

describe("Footer 'Get in touch' rows", () => {
  const rows = [
    { label: "Chat with Nessy on WhatsApp", text: "0816 127 1343", href: /^https:\/\/wa\.me\/2348161271343\?text=/ },
    { label: "Open @nessy_hairlon on Instagram", text: "@nessy_hairlon", href: /^https:\/\/www\.instagram\.com\/nessy_hairlon\/$/ },
    { label: "Open Nessy Hairlon's location in Google Maps", text: "Find us on Google Maps", href: /^https:\/\/maps\.app\.goo\.gl\/nessy$/ },
  ];

  it.each(rows)("$text links out in a new tab with a descriptive label and the shared style", ({ label, text, href }) => {
    renderFooter();
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("href")).toMatch(href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent(text);
    expect(link.querySelectorAll("svg")).toHaveLength(2); // leading icon + trailing arrow
    expect(link.className).toContain("text-gold");
    expect(link.className).not.toMatch(/(^|\s)hover:underline/);
  });

  it("all three rows share exactly the same classes", () => {
    renderFooter();
    const classes = rows.map(r => screen.getByRole("link", { name: r.label }).className);
    expect(new Set(classes).size).toBe(1);
  });

  it("the arrow only moves when motion is allowed", () => {
    renderFooter();
    const arrow = screen.getByRole("link", { name: rows[0].label }).querySelectorAll("svg")[1];
    const cls = arrow.getAttribute("class") ?? "";
    expect(cls).toContain("motion-safe:group-hover:translate-x-0.5");
    expect(cls).not.toMatch(/(^|\s)group-hover:translate/);
  });

  it.each([[undefined], [""], ["  "], ["javascript:alert(1)"], ["http://insecure.example.com"]])(
    "maps URL %j → plain 'Lagos, Nigeria', no link, no arrow",
    (url) => {
      if (url === undefined) delete settings.value.location_url; else settings.value.location_url = url;
      renderFooter();
      const plain = screen.getByTestId("footer-maps-link-text");
      expect(plain).toHaveTextContent("Lagos, Nigeria");
      expect(plain.querySelectorAll("svg")).toHaveLength(1); // the map pin only
      expect(screen.queryByRole("link", { name: /Google Maps/ })).toBeNull();
    },
  );

  it("no phone setting → plain number, no link, no arrow", () => {
    delete settings.value.phone;
    renderFooter();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    const plain = screen.getByTestId("footer-whatsapp-link-text");
    expect(plain).toHaveTextContent("0816 127 1343");
    expect(plain.querySelectorAll("svg")).toHaveLength(1);
  });

  it.each([[undefined], [""], ["not a handle!"]])("instagram setting %j → plain handle, no link, no arrow", (handle) => {
    if (handle === undefined) delete settings.value.instagram; else settings.value.instagram = handle;
    renderFooter();
    expect(screen.queryByRole("link", { name: /Instagram/ })).toBeNull();
    const plain = screen.getByTestId("footer-instagram-link-text");
    expect(plain).toHaveTextContent("@nessy_hairlon");
    expect(plain.querySelectorAll("svg")).toHaveLength(1);
  });
});

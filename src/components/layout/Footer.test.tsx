import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

const settings = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock("../../hooks/useSettings", () => ({ useSettings: () => ({ settings: settings.value }) }));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ t: { gold: "#C49A6C" }, isDark: true }) }));
vi.mock("./WeenaCredit", () => ({ WeenaCredit: () => null }));

const renderFooter = () => render(<Footer navigate={vi.fn()} onManageClick={vi.fn()} />);

beforeEach(() => { settings.value = { phone: "08161271343" }; });

describe("Footer location", () => {
  it("links to the map with clear wording when a maps URL is set", () => {
    settings.value.location_url = "https://maps.app.goo.gl/nessy";
    renderFooter();
    const link = screen.getByRole("link", { name: "Open Nessy Hairlon's location in Google Maps" });
    expect(link).toHaveAttribute("href", "https://maps.app.goo.gl/nessy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("Find us on Google Maps");
    expect(link.querySelectorAll("svg")).toHaveLength(2); // map pin + external-link arrow
    expect(screen.queryByText("Lagos, Nigeria")).toBeNull();
  });

  it.each([[undefined], [""], ["  "], ["javascript:alert(1)"], ["http://insecure.example.com"]])(
    "shows plain 'Lagos, Nigeria' with no link when the URL is %j",
    (url) => {
      if (url !== undefined) settings.value.location_url = url;
      renderFooter();
      expect(screen.getByTestId("footer-location-text")).toHaveTextContent("Lagos, Nigeria");
      expect(screen.queryByRole("link", { name: /Google Maps/ })).toBeNull();
      expect(screen.queryByText("Find us on Google Maps")).toBeNull();
    },
  );
});

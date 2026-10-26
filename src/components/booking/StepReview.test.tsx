import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StepReview } from "./StepReview";
import { createBooking } from "../../hooks/useBookings";
import type { BookingDay } from "../../types";

vi.mock("../ui/FadeIn", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../hooks/useBookings", () => ({
  createBooking: vi.fn(),
}));

const versionCheck = vi.hoisted(() => ({ newer: false }));
vi.mock("../../lib/appVersion", () => ({ isNewVersionAvailable: async () => versionCheck.newer }));

vi.mock("../../hooks/useSettings", () => ({
  useSettings: () => ({ settings: { phone: "08161271343" } }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    t: {
      gold: "#C49A6C", text: "#F0E8DC", textSoft: "#B8A994", textMuted: "#7A6E5E",
      surface: "#1E1914", border: "#2E271E", black: "#0A0A0A",
    },
    isDark: true,
  }),
}));

const mockCreateBooking = createBooking as unknown as ReturnType<typeof vi.fn>;

const SELECTED_DAY: BookingDay = {
  key: "2026-10-15", label: "Thu, Oct 15", date: "2026-10-15", slots: ["10:00 AM"], slotCount: 1,
};

const BASE_PROPS = {
  allServices: [],
  selectedDay: SELECTED_DAY,
  selectedTime: "10:00 AM",
  selectedServices: ["Knotless Braids"],
  customStyleUrl: null,
  customStyleDescription: "",
  styleReferenceUrls: [],
  attachmentPreference: null,
  onBack: vi.fn(),
  navigate: vi.fn(),
};

function fillNameAndPhone() {
  fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByPlaceholderText("080..."), { target: { value: "08161271343" } });
}

function clickSubmit() {
  fireEvent.click(screen.getByRole("button", { name: /submit booking request/i }));
}

describe("StepReview — email requirement", () => {
  beforeEach(() => {
    mockCreateBooking.mockReset();
    mockCreateBooking.mockResolvedValue("2f013cd8-44d3-4317-a9cc-9904fbe3b9f8");
  });

  it("blocks submission without email and shows the required error (no opt-out link yet)", () => {
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();

    expect(screen.queryByText("I don't have an email address")).not.toBeInTheDocument();

    clickSubmit();

    expect(mockCreateBooking).not.toHaveBeenCalled();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("I don't have an email address")).toBeInTheDocument();
  });

  it("rejects an invalid email format without offering the opt-out link", () => {
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "not-an-email" } });

    clickSubmit();

    expect(mockCreateBooking).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    expect(screen.queryByText("I don't have an email address")).not.toBeInTheDocument();
  });

  it("submits normally when a valid email is provided", async () => {
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "ada@example.com" } });

    clickSubmit();

    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: "ada@example.com" }),
    ));
    expect(await screen.findByText("Booking Request Submitted!")).toBeInTheDocument();
  });

  it("allows submission without email after confirming the 'I don't have an email' flow", async () => {
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    clickSubmit();

    fireEvent.click(screen.getByText("I don't have an email address"));
    expect(screen.getByText("Are you sure you don't have an email?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Continue without email"));

    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
    expect(screen.getByText("Proceeding without email")).toBeInTheDocument();
    expect(mockCreateBooking).not.toHaveBeenCalled();

    clickSubmit();

    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: null }),
    ));
    expect(await screen.findByText("Booking Request Submitted!")).toBeInTheDocument();
  });

  it("lets the user back out and add an email instead of opting out", () => {
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    clickSubmit();
    fireEvent.click(screen.getByText("I don't have an email address"));

    fireEvent.click(screen.getByText("I have an email — let me add it"));

    expect(screen.queryByText("Are you sure you don't have an email?")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toHaveFocus();
  });

  it("prompts for a refresh (and doesn't submit) when a newer build is deployed", async () => {
    versionCheck.newer = true;
    try {
      render(<StepReview {...BASE_PROPS} />);
      fillNameAndPhone();
      fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "ada@example.com" } });
      clickSubmit();
      expect(await screen.findByText("This page needs a quick refresh to finish your booking. Your details are saved.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh and continue" })).toBeInTheDocument();
      expect(mockCreateBooking).not.toHaveBeenCalled();
    } finally {
      versionCheck.newer = false;
    }
  });

  it("shows the refresh prompt — never the database text — when the backend refuses an old path", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateBooking.mockRejectedValueOnce({ code: "42501", details: null, hint: null, message: 'new row violates row-level security policy for table "bookings"' });
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "ada@example.com" } });
    clickSubmit();
    expect(await screen.findByTestId("refresh-prompt")).toHaveTextContent("Your details are saved.");
    expect(document.body.textContent).not.toMatch(/row-level|violates|42501|policy/);
  });

  it("shows a generic message for an unknown failure, not the raw error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateBooking.mockRejectedValueOnce({ code: "XX000", message: "internal error: could not open relation 1663/5/16384" });
    render(<StepReview {...BASE_PROPS} />);
    fillNameAndPhone();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "ada@example.com" } });
    clickSubmit();
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("relation");
  });
});

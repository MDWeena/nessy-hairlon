import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkCompletedPanel } from "./MarkCompletedPanel";

const base = { clientName: "Ada", busy: false, onCancel: vi.fn() };

describe("MarkCompletedPanel", () => {
  it("warns when the balance isn't marked as paid", () => {
    render(<MarkCompletedPanel {...base} hasEmail balancePaid={false} onConfirm={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Balance not marked as paid. Mark completed anyway?");
  });

  it("shows no warning once the balance is paid", () => {
    render(<MarkCompletedPanel {...base} hasEmail balancePaid onConfirm={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends the thank-you email by default", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail balancePaid onConfirm={onConfirm} />);
    expect(screen.getByRole("checkbox", { name: /Send thank-you email/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(true, null);
  });

  it("lets the admin untick it", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail balancePaid={false} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Send thank-you email/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false, null);
  });

  it("offers no email for a client without one, and never asks to send it", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail={false} balancePaid onConfirm={onConfirm} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/No email on file/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false, null);
  });

  it("Cancel closes without confirming", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<MarkCompletedPanel {...base} onCancel={onCancel} hasEmail balancePaid onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("prefills the product cost (the quote's, else the category's typical) and passes the adjusted value", () => {
    const onConfirm = vi.fn();
    const { unmount } = render(<MarkCompletedPanel {...base} hasEmail balancePaid productCost={null} typicalProductCost={4000} category="Styling" onConfirm={onConfirm} />);
    const field = screen.getByLabelText(/Products used \(private\)/);
    expect(field).toHaveValue("4,000");
    expect(screen.getByText(/private — not shown to client/)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(true, 3500);
    unmount();
    render(<MarkCompletedPanel {...base} hasEmail balancePaid productCost={2500} typicalProductCost={4000} onConfirm={onConfirm} />);
    expect(screen.getByLabelText(/Products used \(private\)/)).toHaveValue("2,500");
  });
});

describe("MarkCompletedPanel on a past quoted / deposit-paid booking", () => {
  const unconfirmed = { status: "quoted" as const, fullPrice: 20000 };

  it("'Client paid in full on the day' is ticked by default and records the payment", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail balancePaid={false} unconfirmed={unconfirmed} onConfirm={onConfirm} />);
    const box = screen.getByRole("checkbox", { name: /Client paid in full on the day \(₦20,000\)/ });
    expect(box).toBeChecked();
    expect(screen.getByTestId("paid-in-full-hint")).toHaveTextContent("Records ₦20,000 as received today");
    expect(screen.queryByRole("alert")).toBeNull(); // no "balance not paid" warning in this mode
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(true, null, true);
  });

  it("unticked: completes with the balance still owed", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail={false} balancePaid={false} unconfirmed={unconfirmed} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Client paid in full/ }));
    expect(screen.getByTestId("paid-in-full-hint")).toHaveTextContent("₦20,000 still owed");
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false, null, false);
  });

  it("with no price there's nothing to record", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail={false} balancePaid={false} unconfirmed={{ status: "quoted", fullPrice: null }} onConfirm={onConfirm} />);
    const box = screen.getByRole("checkbox", { name: /Client paid in full/ });
    expect(box).not.toBeChecked();
    expect(box).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false, null, false);
  });

  it("deposit paid: warns to verify the deposit first so it isn't counted twice", () => {
    render(<MarkCompletedPanel {...base} hasEmail balancePaid={false} unconfirmed={{ status: "deposit_paid", fullPrice: 20000 }} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Verify deposit payment first/)).toBeInTheDocument();
  });
});

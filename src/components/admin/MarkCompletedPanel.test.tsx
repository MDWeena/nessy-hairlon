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

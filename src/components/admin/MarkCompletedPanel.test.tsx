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
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("lets the admin untick it", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail balancePaid={false} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Send thank-you email/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("offers no email for a client without one, and never asks to send it", () => {
    const onConfirm = vi.fn();
    render(<MarkCompletedPanel {...base} hasEmail={false} balancePaid onConfirm={onConfirm} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/No email on file/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("Cancel closes without confirming", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<MarkCompletedPanel {...base} onCancel={onCancel} hasEmail balancePaid onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

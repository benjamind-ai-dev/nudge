import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker, type DateRange } from "./date-range-picker";

const EMPTY: DateRange = { start: null, end: null };

describe("DateRangePicker", () => {
  it("shows the placeholder when empty and a formatted label when set", () => {
    const { rerender } = render(
      <DateRangePicker value={EMPTY} onChange={vi.fn()} placeholder="Due date" />,
    );
    expect(screen.getByText("Due date")).toBeTruthy();

    rerender(
      <DateRangePicker
        value={{ start: "2023-10-01", end: "2023-10-31" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Oct 1 – Oct 31, 2023")).toBeTruthy();
  });

  it("selects a range and applies it via onChange", () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={EMPTY} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Due date/ }));
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as DateRange;
    expect(arg.start?.endsWith("-10")).toBe(true);
    expect(arg.end?.endsWith("-20")).toBe(true);
    expect(arg.start?.slice(0, 7)).toBe(arg.end?.slice(0, 7)); // same month
  });

  it("orders endpoints regardless of click order", () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={EMPTY} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Due date/ }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const arg = onChange.mock.calls[0][0] as DateRange;
    expect(arg.start?.endsWith("-10")).toBe(true);
    expect(arg.end?.endsWith("-20")).toBe(true);
  });

  it("clears the selection from the trigger", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ start: "2023-10-01", end: "2023-10-31" }}
        onChange={onChange}
      />,
    );
    // The × clear control sits inside the trigger.
    const trigger = screen.getByRole("button", { name: /Oct 1/ });
    const clearIcon = trigger.querySelector("svg:last-child");
    fireEvent.click(clearIcon as Element);
    expect(onChange).toHaveBeenCalledWith({ start: null, end: null });
  });
});

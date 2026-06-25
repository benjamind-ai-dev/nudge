import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "./theme.store";

describe("useThemeStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useThemeStore.setState({ mode: "system" });
  });

  it("defaults to system mode", () => {
    expect(useThemeStore.getState().mode).toBe("system");
  });

  it("setMode updates to light", () => {
    useThemeStore.getState().setMode("light");
    expect(useThemeStore.getState().mode).toBe("light");
  });

  it("setMode updates to dark", () => {
    useThemeStore.getState().setMode("dark");
    expect(useThemeStore.getState().mode).toBe("dark");
  });

  it("setMode updates back to system", () => {
    useThemeStore.getState().setMode("dark");
    useThemeStore.getState().setMode("system");
    expect(useThemeStore.getState().mode).toBe("system");
  });
});

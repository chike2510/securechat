// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

afterEach(() => {
  cleanup();
  localStorage.removeItem("theme");
  document.documentElement.classList.remove("dark");
});

describe("ThemeProvider", () => {
  it("switches to dark mode and persists the chosen mode", () => {
    render(<ThemeProvider defaultTheme="light" switchable><ThemeProbe /></ThemeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "light" }));

    expect(screen.getByRole("button", { name: "dark" })).toBeTruthy();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});

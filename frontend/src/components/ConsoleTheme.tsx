"use client";

import { generateThemeStylesheet, type Theme } from "@cloudscape-design/components/theming";

// The AWS console overrides one part of Cloudscape's default theme: primary
// buttons are orange ("amber") with dark text instead of blue with white text.
// Values taken from the console's own design tokens (amber-400 / amber-500).
const CONSOLE_THEME: Theme = {
  tokens: {
    colorBackgroundButtonPrimaryDefault: "#ff9900",
    colorBackgroundButtonPrimaryHover: "#fa6f00",
    colorBackgroundButtonPrimaryActive: "#fa6f00",
    colorTextButtonPrimaryDefault: "#0f141a",
    colorTextButtonPrimaryHover: "#0f141a",
    colorTextButtonPrimaryActive: "#0f141a",
  },
};

// Generated once. Rendered as a <style> tag during server rendering, so the first
// HTML already has orange buttons (applyTheme() would only run after hydration,
// briefly showing blue ones).
const CONSOLE_THEME_CSS = generateThemeStylesheet({ theme: CONSOLE_THEME });

export default function ConsoleTheme() {
  return <style href="console-theme" precedence="default">{CONSOLE_THEME_CSS}</style>;
}

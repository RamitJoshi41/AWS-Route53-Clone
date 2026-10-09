"use client";

import { generateThemeStylesheet, type Theme } from "@cloudscape-design/components/theming";

// The AWS console overrides one part of Cloudscape's default theme: primary
// buttons are orange ("amber") with dark text instead of blue with white text.
// Values taken from the console's own design tokens (amber-400 / amber-500).
const PRIMARY_BUTTON_TOKENS = {
  colorBackgroundButtonPrimaryDefault: "#ff9900",
  colorBackgroundButtonPrimaryHover: "#fa6f00",
  colorBackgroundButtonPrimaryActive: "#fa6f00",
  colorTextButtonPrimaryDefault: "#0f141a",
  colorTextButtonPrimaryHover: "#0f141a",
  colorTextButtonPrimaryActive: "#0f141a",
};

// The dark top bar is a Cloudscape "visual context" with its own token values (blue
// primary buttons); the console's account menu there has an orange Sign out button
// too (screenshot AccountDropdown). The theme generator skips a context value that
// is the same string as the global one (assuming the context inherits it, which this
// context doesn't), so the context gets the same colours written in uppercase.
const TOP_NAVIGATION_TOKENS = Object.fromEntries(
  Object.entries(PRIMARY_BUTTON_TOKENS).map(([token, value]) => [token, value.toUpperCase()]),
);

const CONSOLE_THEME: Theme = {
  tokens: PRIMARY_BUTTON_TOKENS,
  contexts: { "top-navigation": { tokens: TOP_NAVIGATION_TOKENS } },
};

// Generated once. Rendered as a <style> tag during server rendering, so the first
// HTML already has orange buttons (applyTheme() would only run after hydration,
// briefly showing blue ones).
const CONSOLE_THEME_CSS = generateThemeStylesheet({ theme: CONSOLE_THEME });

export default function ConsoleTheme() {
  return <style href="console-theme" precedence="default">{CONSOLE_THEME_CSS}</style>;
}

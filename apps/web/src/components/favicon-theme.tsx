"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const LIGHT = "/brand/favicon-light.png";
const DARK = "/brand/favicon-dark.png";

/**
 * Swaps the tab favicon when the in-app theme (next-themes class) changes.
 * Browsers do not react to `html.dark` by themselves; only `prefers-color-scheme`
 * works via <link media>. This covers the ThemeProvider toggle.
 */
export function FaviconTheme() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const href = resolvedTheme === "light" ? LIGHT : DARK;
    let link = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"][data-efilicit-theme]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.dataset.efilicitTheme = "1";
      document.head.appendChild(link);
    }
    link.href = `${href}?v=2`;
  }, [resolvedTheme]);

  return null;
}

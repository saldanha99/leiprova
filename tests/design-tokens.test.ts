import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Sistema visual ELS (redesenho de 23/11/2026): cor vem dos tokens OKLCH
 * (src/app/els-tokens.css, utilitários els-*), para o app e o /admin funcionarem
 * nos temas claro e escuro. Este teste impede cor fixa nova nas telas.
 *
 * Exceções intencionais: variantes print: (impressão em cores fixas), sombras
 * pretas, imagens geradas com ImageResponse e a aparência do Stripe Elements
 * (iframe que não lê variáveis CSS).
 */
const SRC = path.join(process.cwd(), "src");
const PALETTE =
  "(?:white|black|slate|gray|zinc|neutral|stone|amber|emerald|yellow|green|rose|red|sky|blue|teal|cyan|orange|lime|indigo|violet|purple|pink|fuchsia)";
const UTILITY =
  "(?:bg|text|border|ring|ring-offset|from|to|via|fill|stroke|outline|decoration|divide|shadow|placeholder|accent|caret)";
const FIXED_CLASS = new RegExp(
  `(?<![\\w-])((?:[a-z-]+:)*)${UTILITY}-(?:\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\\()[^\\]]*\\]|${PALETTE}(?:-\\d+)?)(?:/[\\w.\\[\\]]+)?(?![\\w-])`,
  "g",
);
const STRIPE_APPEARANCE_FILE = path.join("src", "components", "checkout", "checkout-client.tsx");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

function allowed(match: string, prefix: string) {
  if (prefix.includes("print:")) return true;
  if (/(?:^|:)shadow-black\/\d+$/.test(match)) return true;
  if (/shadow-\[/.test(match) && !/(?:rgba?\((?!\s*0[ ,_]+0[ ,_]+0)|#(?!0))/.test(match.split("shadow-")[1])) return true;
  return false;
}

describe("sistema visual ELS", () => {
  it("as telas usam tokens els-* em vez de cores fixas", () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      const relative = path.relative(process.cwd(), file);
      const source = readFileSync(file, "utf8");
      if (source.includes("ImageResponse") || relative === STRIPE_APPEARANCE_FILE) continue;
      for (const match of source.matchAll(FIXED_CLASS)) {
        if (!allowed(match[0], match[1] ?? "")) offenders.push(`${relative}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("os dois temas definem os mesmos tokens", () => {
    const css = readFileSync(path.join(SRC, "app", "els-tokens.css"), "utf8");
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf("}", start));
    };
    const names = (text: string) => [...text.matchAll(/(--els-[\w-]+):/g)].map((m) => m[1]).sort();
    expect(names(block('[data-theme="light"] {'))).toEqual(names(block(':root,\n[data-theme="dark"] {')));
  });
});

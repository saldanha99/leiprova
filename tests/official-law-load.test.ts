import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OFFICIAL_LEGAL_SOURCES } from "@/lib/official-sources/legal-registry";

import { parseLawLoadArgs } from "../scripts/load-official-laws";

const script = readFileSync(new URL("../scripts/load-official-laws.ts", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

describe("carga de leis do registro oficial", () => {
  it("aceita só leis do registro, sem repetição, e roda em prévia por padrão", () => {
    expect(parseLawLoadArgs(["--", "lei=lei-drogas-2006", "lei=lei-tortura-1997"])).toEqual({
      apply: false,
      slugs: ["lei-drogas-2006", "lei-tortura-1997"],
    });
    expect(parseLawLoadArgs(["--apply", "lei=lei-drogas-2006"]).apply).toBe(true);
    expect(() => parseLawLoadArgs(["lei=lei-inventada-2030"])).toThrow(/fora do registro/u);
    expect(() => parseLawLoadArgs(["lei=lei-drogas-2006", "lei=lei-drogas-2006"])).toThrow(/mais de uma vez/u);
    expect(() => parseLawLoadArgs(["drogas"])).toThrow(/Argumento inválido/u);
    expect(() => parseLawLoadArgs([])).toThrow(/ao menos uma/u);
  });

  it("registra cada lei com norma do Senado, URN federal e página do Planalto", () => {
    for (const source of OFFICIAL_LEGAL_SOURCES) {
      expect(source.monitorUrl).toMatch(/^https:\/\/legis\.senado\.leg\.br\/norma\/\d+$/u);
      expect(source.officialUrl).toMatch(/^https:\/\/www\.planalto\.gov\.br\/ccivil_03\//u);
      expect(source.lexmlUrn).toMatch(/^urn:lex:br:federal:(?:lei|lei\.complementar|decreto\.lei|constituicao):\d{4}-\d{2}-\d{2};\d+$/u);
    }
    const slugs = OFFICIAL_LEGAL_SOURCES.map((source) => source.slug);
    const monitors = OFFICIAL_LEGAL_SOURCES.map((source) => source.monitorUrl);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(monitors).size).toBe(monitors.length);
    expect(slugs).toContain("lei-drogas-2006");
    expect(slugs).not.toContain("lei-geral-protecao-dados-2018");
  });

  it("confere os artigos, aprova com a base da autorização e só grava com --apply", () => {
    expect(script).toContain("articles.length !== captured.articleCount || !articles.length");
    expect(script).toContain('approvalMode: "owner_authorization"');
    expect(script).toContain('"editorial.legal_source.approved"');
    expect(script).toContain('"editorial.legal_text.approved"');
    expect(script).toContain('editorialStatus: "reviewed" as const');
    expect(script).toContain('sourceRights: "official_text" as const');
    // Rejeição anterior no painel não é atropelada pela carga.
    expect(script).toContain("exige nova revisão no painel");
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).toContain('isolationLevel: "serializable"');
    expect(script).not.toMatch(/\.(?:update|insert)\((?:questions|contestProductQuestionBindings|contestStoreProducts)\)/u);
    expect(packageJson).toContain('"legal:laws:load": "tsx --env-file-if-exists=.env scripts/load-official-laws.ts"');
  });
});

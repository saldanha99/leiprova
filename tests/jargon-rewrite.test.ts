import { describe, expect, it } from "vitest";

import { rewriteJargon } from "@/lib/editorial/jargon-rewrite";

const ok = (text: string, expected: string) => {
  const out = rewriteJargon(text);
  expect(out.resolved, text).toBe(true);
  expect(out.text).toBe(expected);
};
const untouched = (text: string) => {
  const out = rewriteJargon(text);
  expect(out.text, text).toBe(text);
};

describe("correção determinística do jargão do motor", () => {
  it("troca as formas nominais preservando a gramática", () => {
    ok("Considerando o art. 5º da CF, conforme o texto recebido, assinale a correta.", "Considerando o art. 5º da CF, conforme o texto legal, assinale a correta.");
    ok("O texto fornecido não prevê exceção.", "O texto legal não prevê exceção.");
    ok("O critério dos textos fornecidos é etário.", "O critério dos textos legais é etário.");
    ok("Segundo o art. 702 da CLT, na redação do pacote, qual é o órgão?", "Segundo o art. 702 da CLT, na redação vigente, qual é o órgão?");
    ok("O dispositivo recebido atribui a homologação ao STJ.", "O dispositivo legal atribui a homologação ao STJ.");
    ok("Incorreta: o art. 5º fornecido não menciona estelionato.", "Incorreta: o art. 5º não menciona estelionato.");
    ok("Correta. Reproduz o § 9º do art. 12 do pacote.", "Correta. Reproduz o § 9º do art. 12.");
    ok("Segundo o §2º do art. 71 do Código Eleitoral, tal como consta do pacote, assinale.", "Segundo o §2º do art. 71 do Código Eleitoral, na redação vigente, assinale.");
  });

  it("remove ids e marcas internas sem deixar resíduo", () => {
    ok("Texto literal do inciso IV do art. 146-B da LEP (artigo 7601 do pacote).", "Texto literal do inciso IV do art. 146-B da LEP.");
    ok("Fundamento: CF art. 129, IX (texto versionado no pacote, versionId 65). A função…", "Fundamento: CF art. 129, IX (texto legal). A função…");
    ok("Fonte: Constituição Federal, art. 1º, IV, artigo 5830, versão 65, URL oficial indicada no pacote.", "Fonte: Constituição Federal, art. 1º, IV.");
    ok("Fonte: art. 294, caput, do CPC (texto legal, versão 61). O caput…", "Fonte: art. 294, caput, do CPC (texto legal). O caput…");
  });

  it("não mexe em conteúdo: negação + pacote/corpus fica intacto", () => {
    untouched("Depende de lei municipal, que não consta do pacote.");
    untouched("Remete a outros casos do Código, que não estão no pacote.");
    untouched("Dependem de diplomas não contidos no pacote.");
    untouched("Depende do art. 970, não incluído no corpus.");
    untouched("Não têm disciplina no corpus recebido.");
    untouched("Fonte: pacote, articleId 6044.");
  });

  it("nunca toca habeas corpus nem pacote anticrime, e texto limpo sai igual", () => {
    untouched("Cabe habeas corpus sempre que alguém sofrer coação ilegal.");
    untouched("O Pacote Anticrime alterou o art. 28-A do CPP.");
    untouched("A lei foi recebida pela Constituição de 1988.");
    expect(rewriteJargon("O art. 5º assegura a ampla defesa.").rules).toEqual([]);
  });
});

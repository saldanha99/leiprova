import { describe, expect, it } from "vitest";

import { articleLabel, cleanStudentFacingText, findInternalReference } from "@/lib/editorial/student-facing-text";

const label = { articleRef: "Art. 166", actTitle: "Constituição Federal" };
void articleLabel;

describe("texto para o aluno sem referência interna do motor", () => {
  it("troca 'artigo <id>, versão <n>, do corpus …' pelo rótulo legível", () => {
    expect(cleanStudentFacingText("A intenção não elimina a incompatibilidade. Fonte: Constituição Federal, artigo 6008, versão 65.", label))
      .toBe("A intenção não elimina a incompatibilidade. Fonte: Constituição Federal, art. 166.");
    expect(cleanStudentFacingText("Fundamento: artigo 5834, versão 65 do corpus oficial.", label))
      .toBe("Fundamento: art. 166 da Constituição Federal.");
    expect(cleanStudentFacingText("Fonte: Constituição Federal, artigo 5834, versão 65, do corpus recebido.", label))
      .toBe("Fonte: Constituição Federal, art. 166.");
  });

  it("não repete o artigo quando ele já está escrito antes", () => {
    expect(cleanStudentFacingText("Fonte: Constituição Federal, art. 166, artigo 6008, versão 65, do corpus fornecido.", label))
      .toBe("Fonte: Constituição Federal, art. 166.");
  });

  it("remove o parêntese com id do pacote", () => {
    expect(cleanStudentFacingText("Segundo o art. 321 do CPP (artigo 1600 do pacote): a ausência dos requisitos impõe a liberdade.", label))
      .toBe("Segundo o art. 321 do CPP: a ausência dos requisitos impõe a liberdade.");
    expect(findInternalReference("art. 927 (artigo 2995 do pacote)")).not.toBeNull();
  });

  it("sem vínculo, remove a referência em vez de inventar", () => {
    expect(cleanStudentFacingText("Texto do comentário. Fundamento: artigo 5834, versão 65 do corpus oficial.", null))
      .toBe("Texto do comentário.");
  });

  it("não mexe em artigos legítimos nem em texto limpo", () => {
    const ok = "Segundo o art. 1.021, § 1º, do CPC e o artigo 5º, LXIX, da CF, a petição deve impugnar especificadamente.";
    expect(cleanStudentFacingText(ok, label)).toBe(ok);
    expect(findInternalReference(ok)).toBeNull();
  });

  it("a trava do motor detecta o formato proibido", () => {
    expect(findInternalReference("Fonte: CF, artigo 6008, versão 65.")).toBe("artigo 6008, versão 65");
    expect(findInternalReference("conforme a versão 12 do corpus fornecido")).not.toBeNull();
    expect(findInternalReference("segundo o texto do corpus fornecido")).not.toBeNull();
    expect(findInternalReference("artigo id 4471")).not.toBeNull();
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("revisão das inéditas por concurso", () => {
  it("filtra a fila pelo edital e mostra só o que falta revisar", () => {
    const admin = read("src/lib/db/editorial-admin.ts");
    expect(admin).toContain("export async function listEditorialContests()");
    expect(admin).toContain('inArray(questions.editorialStatus, ["draft", "pending_review"])');
    expect(admin).toContain("where opportunity.slug = ${opportunitySlug}");
    // As alternativas acompanham o mesmo recorte da fila.
    expect(admin.match(/\.where\(queueWhere\)/gu)).toHaveLength(2);
  });

  it("aceita só concurso existente e leva o filtro ao envio em lote", () => {
    const page = read("src/app/admin/fabrica-autoral/page.tsx");
    expect(page).toContain("contests.find((contest) => contest.slug === query.concurso) ?? null");
    expect(page).toContain("opportunitySlug={selectedContest?.slug}");
    const controls = read("src/components/admin/batch-editorial-controls.tsx");
    expect(controls).toContain('<input type="hidden" name="opportunitySlug" value={opportunitySlug} />');
    const actions = read("src/app/admin/fabrica-autoral/actions.ts");
    expect(actions).toContain('if (contestSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(contestSlug))');
    expect(actions).toContain("where opportunity.slug = ${contestSlug}");
    // A declaração do revisor continua obrigatória no lote.
    expect(actions).toContain('formData.get("cleanRoomAttestation") === "on"');
  });
});

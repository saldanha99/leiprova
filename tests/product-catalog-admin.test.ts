import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTEST_CATALOG } from "../src/lib/commerce/catalog";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSuperAdmin: mocks.authorize }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ select: () => ({ from: mocks.from }) }) }));
import ProductCatalogAdminPage from "../src/app/admin/catalogo-produtos/page";

describe("progresso editorial no catálogo administrativo", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockResolvedValue({}); });
  it("mostra mínimo real por produto e não vende rascunhos como conteúdo pronto", async () => {
    mocks.from.mockResolvedValue([67, 68].map((count, i) => ({
      product: { slug: CONTEST_CATALOG[i].slug, status: "draft", stripeMode: "test" }, validQuestionCount: count,
    })));
    const html = renderToStaticMarkup(await ProductCatalogAdminPage());
    expect(mocks.authorize).toHaveBeenCalledWith("/admin/catalogo-produtos");
    expect(html).toContain("1 de 75 cursos com pelo menos 68 questões válidas");
    expect(html).toContain("67 / 68");
    expect(html).toContain("faltam 1 para o mínimo");
    expect(html).toContain("68 / 68");
    expect(html).toContain("demais liberações ainda necessárias");
    expect(html).toContain("0 / 68");
    expect(html).toContain("Rascunhos, propostas pendentes e vínculos desatualizados não entram");
    expect(html).toContain("Preços mensal / anual");
    expect(html).not.toContain("· único");
    expect(html).toContain("CADERNO DE PRODUÇÃO · 75 CURSOS");
    expect(html).toContain("5.100");
    expect(html).toContain("não representa questões geradas nem agentes executando");
    expect(html.match(/Preparação editorial ·/g)).toHaveLength(75);
    expect(html).toContain("Fontes e pistas oficiais");
    expect(html).toContain("Leitura e localização do programa pendentes");
    expect(html).toContain("/admin/motor-editais");
    expect(html).toContain("/admin/fabrica-autoral");
    expect(html).toContain("rel=\"noopener noreferrer\"");
  });
  it("confere administrador antes de consultar contagens", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("Sem autorização"));
    await expect(ProductCatalogAdminPage()).rejects.toThrow("Sem autorização");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

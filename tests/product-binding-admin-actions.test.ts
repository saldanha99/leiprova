import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), headers: vi.fn(), db: vi.fn(), review: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSuperAdmin: mocks.auth }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/lib/commerce/product-binding-review-service", () => ({ reviewProductQuestionBindings: mocks.review }));
import { reviewBindingAction } from "../src/app/admin/catalogo-produtos/[slug]/vinculos/actions";
import { CONTEST_CATALOG } from "../src/lib/commerce/catalog";
const actor = { publicId: "10000000-0000-4000-8000-000000000009", role: "admin" };
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ mode: "apply", productSlug: CONTEST_CATALOG[0].slug, bindingId: "a".repeat(64),
    opportunityPublicId: "10000000-0000-4000-8000-000000000001", examEditionPublicId: "10000000-0000-4000-8000-000000000002",
    notes: "Nota explícita apenas para o teste isolado.", decision: "reject", fingerprint: "b".repeat(64),
    edition: "on", program: "on", adherence: "on", actorPublicId: "forged-actor" })) data.set(key, value);
  return data;
}
describe("ação de curadoria — autenticação antes de banco", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_URL", "https://admin.invalid"); mocks.auth.mockResolvedValue(actor);
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://admin.invalid" })); mocks.db.mockReturnValue({});
    mocks.review.mockResolvedValue({ mode: "apply", approved: 0, rejected: 1 }); });
  afterEach(() => vi.unstubAllEnvs());
  it("não autenticado não consulta nem altera banco", async () => {
    mocks.auth.mockRejectedValue(new Error("login required"));
    await expect(reviewBindingAction({ status: "idle", message: "" }, form())).rejects.toThrow("login");
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each(["student", "editor"])("nega papel %s mesmo se ação for chamada diretamente", async (role) => {
    mocks.auth.mockResolvedValue({ ...actor, role });
    expect((await reviewBindingAction({ status: "idle", message: "" }, form())).status).toBe("error");
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it.each([null, "https://evil.invalid"])("nega origem %s", async (origin) => {
    mocks.headers.mockResolvedValue(new Headers(origin ? { origin } : {}));
    expect((await reviewBindingAction({ status: "idle", message: "" }, form())).status).toBe("error");
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("deriva ator da sessão, envia ID exato e preserva fingerprint e nota", async () => {
    const data = form();
    expect((await reviewBindingAction({ status: "idle", message: "" }, data)).status).toBe("success");
    const request = mocks.review.mock.calls[0][1];
    expect(request.actorPublicId).toBe(actor.publicId); expect(request.input.bindingIds).toEqual(["a".repeat(64)]);
    expect(request.expectedFingerprint).toBe("b".repeat(64)); expect(request.input.notes).toBe(data.get("notes"));
    expect(request.input).not.toHaveProperty("actorPublicId");
  });
  it("nota curta e produto fora do catálogo não chegam ao serviço", async () => {
    for (const [key, value] of [["notes", "curta"], ["productSlug", "outside-catalog"]]) {
      const data = form(); data.set(key, value);
      expect((await reviewBindingAction({ status: "idle", message: "" }, data)).status).toBe("error");
    }
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("erro de privilégio não expõe SQL, segredo ou fallback", async () => {
    mocks.review.mockRejectedValue(new Error("SELECT secret_password FROM users at postgres://private"));
    const result = await reviewBindingAction({ status: "idle", message: "" }, form());
    expect(result.status).toBe("error"); expect(result.message).not.toMatch(/SELECT|secret_password|postgres:/u);
    expect(mocks.db).toHaveBeenCalledOnce(); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

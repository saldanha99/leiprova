import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../src/lib/db/schema";

const auth = vi.hoisted(() => ({ userId: 0 }));
const url = process.env.LEIPROVA_QA_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55439" ||
    parsed.pathname !== "/leiprova_qa" ||
    parsed.username !== "leiprova_qa_app"
  )
    throw new Error(
      "Teste aceita somente o papel restrito do banco local leiprova_qa.",
    );
}
const sql = url ? postgres(url, { max: 1 }) : null;
const database = sql ? drizzle(sql, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => database }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => (auth.userId ? { id: auth.userId } : null),
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimits: async () => null,
  getRequestIp: () => null,
  rateLimitJsonResponse: vi.fn(),
}));
import { getStudyEntitlement } from "../src/lib/study/entitlement";
import { canStudyQuestion } from "../src/lib/study/access-policy";
import { GET } from "../src/app/api/study/session/route";
import { POST } from "../src/app/api/study/attempts/route";

describe.skipIf(!url)(
  "três perfis persistentes — banco sintético com papel restrito",
  () => {
    let masterId = 0;
    let contestId = 0;
    beforeAll(async () => {
      const rows = await sql!`select id,email,role from users order by id`;
      expect(rows).toHaveLength(3);
      expect(
        rows.find((row) => row.email === "qa-admin@example.invalid")?.role,
      ).toBe("admin");
      const master = rows.find(
        (row) => row.email === "qa-master@example.invalid",
      )!;
      const contest = rows.find(
        (row) => row.email === "qa-avulso@example.invalid",
      )!;
      expect(master.role).toBe("student");
      expect(contest.role).toBe("student");
      masterId = Number(master.id);
      contestId = Number(contest.id);
    });
    afterAll(async () => {
      await sql?.end();
    });
    it("Master acessa os dois cursos; individual apenas Alfa", async () => {
      const master = await getStudyEntitlement(masterId);
      const contest = await getStudyEntitlement(contestId);
      expect(master.hasFullAccess).toBe(true);
      expect(contest.hasFullAccess).toBe(false);
      expect(contest.questionPublicIds?.sort()).toEqual(
        [1, 2, 3, 4].map((id) => `qa-persistente-alfa-${id}`),
      );
      expect(canStudyQuestion(master, "qa-persistente-beta-1")).toBe(true);
      expect(canStudyQuestion(contest, "qa-persistente-beta-1")).toBe(false);
    });
    it("a API entrega Alfa e não vaza Beta para o individual", async () => {
      auth.userId = contestId;
      const alfa = await (
        await GET(
          new NextRequest(
            "http://127.0.0.1/api/study/session?lei=qa-regra-alfa",
          ),
        )
      ).json();
      const beta = await (
        await GET(
          new NextRequest(
            "http://127.0.0.1/api/study/session?lei=qa-regra-beta",
          ),
        )
      ).json();
      expect(alfa.questions).toHaveLength(4);
      expect(beta.questions).toHaveLength(0);
      auth.userId = masterId;
      const masterBeta = await (
        await GET(
          new NextRequest(
            "http://127.0.0.1/api/study/session?lei=qa-regra-beta",
          ),
        )
      ).json();
      expect(masterBeta.questions).toHaveLength(4);
    });
    it("forçar uma resposta de outro curso retorna 404 e não registra tentativa", async () => {
      auth.userId = contestId;
      const [before] =
        await sql!`select count(*)::int as total from user_attempts`;
      const response = await POST(
        new Request("http://127.0.0.1/api/study/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "qa-persistente-beta-1",
            optionId: "A",
            confidence: "sure",
            durationMs: 1000,
          }),
        }),
      );
      expect(response.status).toBe(404);
      const [after] =
        await sql!`select count(*)::int as total from user_attempts`;
      expect(after.total).toBe(before.total);
    });
    it("perfis de homologação não ficam liberados para sempre", async () => {
      const future = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
      expect((await getStudyEntitlement(masterId, future)).hasFullAccess).toBe(
        false,
      );
      expect(
        (await getStudyEntitlement(contestId, future)).questionPublicIds,
      ).toEqual([]);
    });
    it("nenhuma referência de cliente, assinatura ou pagamento Stripe foi forjada", async () => {
      const [row] =
        await sql!`select (select count(*) from users where stripe_customer_id is not null)::int as customers,
      (select count(*) from subscriptions where provider <> 'synthetic_test' or provider_subscription_id is not null)::int as subscriptions,
      (select count(*) from contest_orders where stripe_mode <> 'test' or stripe_session_id is not null or stripe_payment_intent_id is not null)::int as payments`;
      expect(row).toEqual({ customers: 0, subscriptions: 0, payments: 0 });
    });
  },
);

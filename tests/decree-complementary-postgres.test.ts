import { createHash, randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DECREE_COMPLEMENTARY_PARSER, DECREE_COMPLEMENTARY_POLICY, DECREE_METADATA_RAW_SHA, DECREE_METADATA_URL, DECREE_SOURCE_KEYS } from "@/lib/official-sources/decree-complementary";
import { PROCUREMENT_2026_AMOUNTS, PROCUREMENT_CONTEXT_SOURCE } from "@/lib/official-sources/procurement-context";
import { OFFICIAL_LAW_STANDING_REFERENCE } from "@/lib/official-sources/standing-law-review";

function requireSyntheticQaUrl(value: string) {
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    || parsed.pathname !== "/leiprova_automation_test" || decodeURIComponent(parsed.username) !== "leiprova_owner") {
    throw new Error("Somente cluster sintético em loopback, banco leiprova_automation_test e proprietário de QA.");
  }
  return value;
}
const url = process.env.LEIPROVA_TEST_DATABASE_URL;
const client = url ? postgres(requireSyntheticQaUrl(url), { max: 2, prepare: false }) : null;
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const syntheticBody = "Evidência inteiramente sintética para testar constraints e RLS; sem conteúdo jurídico publicado. ".repeat(3);
const facts = { policy: DECREE_COMPLEMENTARY_POLICY, amounts: PROCUREMENT_2026_AMOUNTS, syntheticFixture: true };
const observation = { metadataUrl: DECREE_METADATA_URL, metadataRawSha256: DECREE_METADATA_RAW_SHA, observedAt: "2026-10-12T06:00:00.000Z", expressRevocationReported: false, syntheticFixture: true };

type FixtureOptions = { status?: string; verificationSkewSeconds?: number; missingAudit?: boolean; humanReview?: boolean; stringifyFacts?: boolean; stringifyObservation?: boolean; normalizedSha?: string };
async function fixture(options: FixtureOptions = {}) {
  return client!.begin(async (tx) => {
    const tag = randomUUID();
    const [actor] = await tx<{ id: string }[]>`insert into users(public_id,name,email,password_hash,role)
      values(${randomUUID()},'QA complementar sintética',${`${tag}@example.invalid`},'not-a-password','editor') returning id::text`;
    const [act] = await tx<{ id: string }[]>`insert into legal_acts(slug,title,short_title,act_type,official_url)
      values(${`qa-complementary-${tag}`},'Dependência fictícia 0053','Dependência fictícia','lei','https://example.invalid/synthetic') returning id::text`;
    const [audit] = await tx<{ id: string }[]>`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values(${actor.id},'qa.synthetic.complementary_source','qa_fixture',${tag},${tx.json({ syntheticFixture: true, humanReview: false })}) returning id::text`;
    const publicId = randomUUID();
    const [source] = await tx<{ id: string; publicId: string }[]>`insert into legal_complementary_sources(public_id,legal_act_id,source_key,source_kind,source_url,
      source_act_type,source_act_number,source_act_year,parser_version,raw_checksum_sha256,normalized_checksum_sha256,normalized_body,evidence_fingerprint,
      facts,source_validity_observation,normative_effective_from,normative_valid_until,editorial_coverage_from,editorial_coverage_through,status,
      approval_audit_id,approval_reference,approval_mode,human_review,reviewed_by_user_id,reviewed_at,last_verified_at,fetched_at)
      values(${publicId},${act.id},${DECREE_SOURCE_KEYS[0]},'annual_decree_body',${PROCUREMENT_CONTEXT_SOURCE.decree.url},'decreto','12.807',2025,
        ${DECREE_COMPLEMENTARY_PARSER},${sha(`raw-${tag}`)},${options.normalizedSha ?? sha(syntheticBody)},${syntheticBody},${sha(`evidence-${tag}`)},
        ${tx.json(options.stringifyFacts ? JSON.stringify(facts) : facts)},${tx.json(options.stringifyObservation ? JSON.stringify(observation) : observation)},
        '2026-01-01',null,'2026-01-01','2026-12-31',${options.status ?? "approved"},${options.missingAudit ? null : audit.id},
        ${OFFICIAL_LAW_STANDING_REFERENCE},'owner_standing_authorization',${options.humanReview ?? false},${actor.id},now(),
        now()+make_interval(secs=>${options.verificationSkewSeconds ?? 0}),now()) returning id::text,public_id as "publicId"`;
    return { ...source, actorId: actor.id, auditId: audit.id };
  });
}
async function appRead(ids: readonly string[]) {
  return client!.begin(async (tx) => {
    await tx`set local role leiprova_app`;
    return tx<{ id: string; publicId: string }[]>`select id::text,public_id as "publicId" from legal_complementary_sources where id=any(${tx.array([...ids], 20)}) order by id`;
  });
}
async function appAttempt(run: (tx: postgres.TransactionSql) => Promise<unknown>) {
  return client!.begin(async (tx) => { await tx`set local role leiprova_app`; return run(tx); });
}

describe("guardas do banco sintético de fontes complementares", () => {
  it("recusa host remoto, banco real ou outro papel antes de criar conexão", () => {
    expect(requireSyntheticQaUrl("postgres://leiprova_owner:synthetic@127.0.0.1/leiprova_automation_test")).toContain("automation_test");
    for (const candidate of ["postgres://leiprova_owner:synthetic@production.invalid/leiprova_automation_test", "postgres://leiprova_owner:synthetic@127.0.0.1/leiprova", "postgres://leiprova_app:synthetic@127.0.0.1/leiprova_automation_test"]) expect(() => requireSyntheticQaUrl(candidate)).toThrow();
  });
});

describe.skipIf(!client)("fontes complementares 0053 — PostgreSQL sintético real", () => {
  beforeAll(async () => {
    const [identity] = await client!<{ db: string; role: string }[]>`select current_database() as db,current_user as role`;
    expect(identity).toEqual({ db: "leiprova_automation_test", role: "leiprova_owner" });
    const [guard] = await client!<{ rls: boolean; appSelect: boolean; appInsert: boolean; appUpdate: boolean; appDelete: boolean }[]>`
      select relrowsecurity as rls,has_table_privilege('leiprova_app',oid,'SELECT') as "appSelect",has_table_privilege('leiprova_app',oid,'INSERT') as "appInsert",
      has_table_privilege('leiprova_app',oid,'UPDATE') as "appUpdate",has_table_privilege('leiprova_app',oid,'DELETE') as "appDelete" from pg_class where oid='public.legal_complementary_sources'::regclass`;
    expect(guard).toEqual({ rls: true, appSelect: true, appInsert: false, appUpdate: false, appDelete: false });
  });
  afterAll(async () => { await client?.end(); });

  it("RLS mostra somente approved recente, incluindo tolerância de relógio, e esconde pending/suspended/expirado/futuro", async () => {
    const pending = await fixture({ status: "pending_review" });
    const fresh = await fixture({ verificationSkewSeconds: -21_500 });
    const tolerated = await fixture({ verificationSkewSeconds: 20 });
    const expired = await fixture({ verificationSkewSeconds: -21_660 });
    const future = await fixture({ verificationSkewSeconds: 60 });
    const suspended = await fixture({ status: "suspended" });
    const rows = await appRead([pending.id, fresh.id, tolerated.id, expired.id, future.id, suspended.id]);
    expect(rows.map((row) => row.publicId).sort()).toEqual([fresh.publicId, tolerated.publicId].sort());
  });

  it.each(["insert", "update", "delete"] as const)("papel APP não pode %s, nem mudar status para escapar da política", async (operation) => {
    const source = await fixture();
    await expect(appAttempt(async (tx) => {
      if (operation === "insert") return tx`insert into legal_complementary_sources(public_id) values(${randomUUID()})`;
      if (operation === "update") return tx`update legal_complementary_sources set status='suspended' where id=${source.id}`;
      return tx`delete from legal_complementary_sources where id=${source.id}`;
    })).rejects.toMatchObject({ code: "42501" });
    const [unchanged] = await client!<{ status: string }[]>`select status from legal_complementary_sources where id=${source.id}`;
    expect(unchanged.status).toBe("approved");
  });

  it("JSONB preserva objeto/array/boolean e corpo recebe hash correspondente, sem string pré-serializada", async () => {
    const source = await fixture();
    const [types] = await client!<{ factsType: string; amountsType: string; observationType: string; revocationType: string; humanReview: boolean }[]>`
      select jsonb_typeof(facts) as "factsType",jsonb_typeof(facts->'amounts') as "amountsType",jsonb_typeof(source_validity_observation) as "observationType",
      jsonb_typeof(source_validity_observation->'expressRevocationReported') as "revocationType",human_review as "humanReview" from legal_complementary_sources where id=${source.id}`;
    expect(types).toEqual({ factsType: "object", amountsType: "array", observationType: "object", revocationType: "boolean", humanReview: false });
    for (const options of [{ stringifyFacts: true }, { stringifyObservation: true }, { normalizedSha: "a".repeat(64) }, { missingAudit: true }, { humanReview: true }]) {
      await expect(fixture(options)).rejects.toMatchObject({ code: "23514" });
    }
  });

  it("evidência e recibo decididos não podem ser reescritos, mesmo pelo proprietário", async () => {
    const source = await fixture();
    const changedBody = `${syntheticBody}Alteração fictícia.`;
    await expect(client!`update legal_complementary_sources set normalized_body=${changedBody},normalized_checksum_sha256=${sha(changedBody)} where id=${source.id}`)
      .rejects.toMatchObject({ code: "P0001" });
    await expect(client!`update legal_complementary_sources set approval_reference='changed-synthetic-receipt' where id=${source.id}`)
      .rejects.toMatchObject({ code: "P0001" });
    const [unchanged] = await client!<{ body: string; reference: string }[]>`select normalized_body as body,approval_reference as reference from legal_complementary_sources where id=${source.id}`;
    expect(unchanged).toEqual({ body: syntheticBody, reference: OFFICIAL_LAW_STANDING_REFERENCE });
  });

  it("verificação pode renovar frescor sem reabrir decisão ou mudar cobertura/vigência", async () => {
    const source = await fixture({ verificationSkewSeconds: -21_660 });
    expect(await appRead([source.id])).toHaveLength(0);
    const [before] = await client!`select evidence_fingerprint,approval_audit_id,reviewed_at,normative_valid_until,editorial_coverage_through from legal_complementary_sources where id=${source.id}`;
    await client!`update legal_complementary_sources set last_verified_at=now(),updated_at=now() where id=${source.id}`;
    expect(await appRead([source.id])).toHaveLength(1);
    const [after] = await client!`select evidence_fingerprint,approval_audit_id,reviewed_at,normative_valid_until,editorial_coverage_through from legal_complementary_sources where id=${source.id}`;
    expect(after).toEqual(before);
  });

  it.each(["suspended", "rejected", "superseded"])("decisão %s não é restaurada pelo monitor ou por renovação de timestamp", async (status) => {
    const source = await fixture({ status });
    await expect(client!`update legal_complementary_sources set status='approved',last_verified_at=now(),updated_at=now() where id=${source.id}`)
      .rejects.toMatchObject({ code: "P0001" });
    expect(await appRead([source.id])).toHaveLength(0);
  });

  it("aprovação de pending exige recibo; após aprovação, suspensão preserva recibo e some da APP", async () => {
    const source = await fixture({ status: "pending_review" });
    expect(await appRead([source.id])).toHaveLength(0);
    await client!`update legal_complementary_sources set status='approved',updated_at=now() where id=${source.id}`;
    expect(await appRead([source.id])).toHaveLength(1);
    await client!`update legal_complementary_sources set status='suspended',updated_at=now() where id=${source.id}`;
    expect(await appRead([source.id])).toHaveLength(0);
    const [receipt] = await client!<{ auditId: string; reference: string; humanReview: boolean }[]>`select approval_audit_id::text as "auditId",approval_reference as reference,human_review as "humanReview" from legal_complementary_sources where id=${source.id}`;
    expect(receipt).toEqual({ auditId: source.auditId, reference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false });
  });
});

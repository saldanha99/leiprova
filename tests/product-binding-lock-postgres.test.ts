import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Cluster temporário EXCLUSIVO. Nunca usa .env, DATABASE_URL, 5432 ou uma VPS.
const url = process.env.LEIPROVA_BINDING_LOCK_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55447" || parsed.pathname !== "/leiprova_binding_lock_test" ||
      parsed.username !== "leiprova_binding_lock_owner" || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Somente sandbox exclusivo do lock de vínculos.");
  }
}
const owner = url ? postgres(url, { max: 3, prepare: false }) : null;
const app = url ? postgres(url.replace("leiprova_binding_lock_owner@", "leiprova_binding_lock_app@"), { max: 1, prepare: false }) : null;
const denied = url ? postgres(url.replace("leiprova_binding_lock_owner@", "leiprova_binding_lock_denied@"), { max: 1, prepare: false }) : null;

describe.skipIf(!url)("lock do produto — PostgreSQL real com papel sem UPDATE no catálogo", () => {
  beforeAll(async () => {
    const [identity] = await owner!`select current_database() as db, session_user as owner, inet_server_port() as port`;
    expect(identity).toEqual({ db: "leiprova_binding_lock_test", owner: "leiprova_binding_lock_owner", port: 55447 });
    await owner!`create table public.contest_store_products (slug text primary key, marker text not null)`;
    await owner!`insert into public.contest_store_products values ('qa-produto-a','inalterado'),('qa-produto-b','inalterado')`;
    await owner!.unsafe(readFileSync(new URL("../drizzle/0036_product_binding_review_lock.sql", import.meta.url), "utf8"));
    await owner!`create role leiprova_binding_lock_app login nosuperuser nocreatedb nocreaterole noinherit`;
    await owner!`create role leiprova_binding_lock_denied login nosuperuser nocreatedb nocreaterole noinherit`;
    await owner!`grant usage on schema public to leiprova_binding_lock_app,leiprova_binding_lock_denied`;
    await owner!`grant select on public.contest_store_products to leiprova_binding_lock_app`;
    await owner!`grant execute on function public.lock_product_binding_review_product(text) to leiprova_binding_lock_app`;
  });
  afterAll(async () => { await app?.end(); await denied?.end(); await owner?.end(); });
  it("permite o lock exato sem permitir UPDATE/DELETE/INSERT nem alterar dados", async () => {
    await app!`select public.lock_product_binding_review_product('qa-produto-a')`;
    await expect(app!`update public.contest_store_products set marker='indevido' where slug='qa-produto-a'`).rejects.toMatchObject({ code: "42501" });
    await expect(app!`delete from public.contest_store_products where slug='qa-produto-a'`).rejects.toMatchObject({ code: "42501" });
    await expect(app!`insert into public.contest_store_products values('qa-invasao','indevido')`).rejects.toMatchObject({ code: "42501" });
    expect(await owner!`select marker from public.contest_store_products order by slug`).toEqual([{ marker: "inalterado" }, { marker: "inalterado" }]);
  });
  it("execução pública é revogada", async () => {
    await expect(denied!`select public.lock_product_binding_review_product('qa-produto-a')`).rejects.toMatchObject({ code: "42501" });
  });
  it.each([null, "", "qa", "%", "qa-produto-a,qa-produto-b", "qa-produto-a'; delete from users;--", "a".repeat(161)])(
    "nega escopo malformado %s", async (value) => {
      await expect(app!`select public.lock_product_binding_review_product(${value})`).rejects.toMatchObject({ code: "22023" });
    },
  );
  it("produto inexistente não é sucesso silencioso", async () => {
    await expect(app!`select public.lock_product_binding_review_product('qa-nao-existe')`).rejects.toMatchObject({ code: "P0002" });
  });
  it("mantém contexto seguro e sem SQL dinâmico ou DML", async () => {
    const [definition] = await owner!`select prosecdef,proconfig,prosrc from pg_catalog.pg_proc where oid='public.lock_product_binding_review_product(text)'::regprocedure`;
    expect(definition.prosecdef).toBe(true);
    expect(definition.proconfig).toContain("search_path=pg_catalog, pg_temp");
    expect(definition.proconfig).toContain("lock_timeout=5s");
    expect(definition.prosrc).toContain("public.contest_store_products");
    expect(definition.prosrc).not.toMatch(/\b(execute|insert|delete|truncate|grant)\b/iu);
    expect(definition.prosrc).not.toMatch(/\bupdate\s+public\b/iu);
  });
  it("impede alteração concorrente só do produto selecionado enquanto mantém o lock", async () => {
    await app!.begin(async (locked) => {
      await locked`select public.lock_product_binding_review_product('qa-produto-a')`;
      await owner!.begin(async (unrelated) => {
        await unrelated`set local lock_timeout='250ms'`;
        await unrelated`update public.contest_store_products set marker=marker where slug='qa-produto-b'`;
      });
      await expect(owner!.begin(async (concurrent) => {
        await concurrent`set local lock_timeout='250ms'`;
        await concurrent`update public.contest_store_products set marker='alterado' where slug='qa-produto-a'`;
      })).rejects.toMatchObject({ code: "55P03" });
    });
    expect((await owner!`select marker from public.contest_store_products where slug='qa-produto-a'`)[0].marker).toBe("inalterado");
  });
});

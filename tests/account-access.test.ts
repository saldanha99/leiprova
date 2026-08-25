import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  accountAccessTokenSchema,
  accountPasswordSchema,
  digestAccountAccessToken,
  generateAccountAccessToken,
} from "@/lib/account-access-core";
import { buildAccountAccessEmail } from "@/lib/account-access-email";
import {
  getTransactionalEmailConfig,
  sendTransactionalEmail,
  TransactionalEmailError,
} from "@/lib/transactional-email";

const ENV_KEYS = [
  "TRANSACTIONAL_EMAIL_ENABLED",
  "RESEND_API_KEY",
  "TRANSACTIONAL_EMAIL_FROM",
] as const;

describe("account access tokens", () => {
  it("gera um token forte e persiste apenas um digest SHA-256", () => {
    const generated = generateAccountAccessToken();

    expect(accountAccessTokenSchema.safeParse(generated.token).success).toBe(true);
    expect(generated.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(generated.digest).toBe(digestAccountAccessToken(generated.token));
    expect(generated.digest).not.toContain(generated.token);
  });

  it("exige uma senha longa com letra e número", () => {
    expect(accountPasswordSchema.safeParse("somenteletras").success).toBe(false);
    expect(accountPasswordSchema.safeParse("1234567890").success).toBe(false);
    expect(accountPasswordSchema.safeParse("LeiProva2026").success).toBe(true);
  });
});

describe("account access email", () => {
  it("escapa nome e URL no HTML e inclui alternativa em texto", () => {
    const email = buildAccountAccessEmail({
      name: "<Ana>",
      accessUrl: "https://leiprova.example/ativar?token=a&next=b",
      purchase: true,
    });

    expect(email.subject).toContain("liberado");
    expect(email.html).toContain("&lt;Ana&gt;");
    expect(email.html).toContain("token=a&amp;next=b");
    expect(email.html).not.toContain("<Ana>");
    expect(email.text).toContain("https://leiprova.example/ativar?token=a&next=b");
    expect(email.text).toContain("expira em 24 horas");
  });
});

describe("Resend transactional email", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("permanece fechado sem flag e segredos completos", () => {
    process.env.RESEND_API_KEY = "secret";
    process.env.TRANSACTIONAL_EMAIL_FROM = "acesso@example.com";
    expect(getTransactionalEmailConfig()).toBeNull();
  });

  it("envia HTML e texto pela API REST sem expor o token no endereço", async () => {
    process.env.TRANSACTIONAL_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "secret-token";
    process.env.TRANSACTIONAL_EMAIL_FROM = "acesso@example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "msg-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Acesso",
      html: "<p>Olá</p>",
      text: "Olá",
      idempotencyKey: "account-access/test-token",
    });

    expect(result).toEqual({ messageId: "msg-1", status: "queued" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "Idempotency-Key": "account-access/test-token",
      "User-Agent": "leiprova/0.1.0",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: "student@example.com",
      from: "acesso@example.com",
      html: "<p>Olá</p>",
      text: "Olá",
    });
  });

  it("não repete uma falha permanente do provedor", async () => {
    process.env.TRANSACTIONAL_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "secret-token";
    process.env.TRANSACTIONAL_EMAIL_FROM = "acesso@example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ name: "validation_error", message: "invalid" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = sendTransactionalEmail({
      to: "student@example.com",
      subject: "Acesso",
      html: "<p>Olá</p>",
      text: "Olá",
      idempotencyKey: "account-access/test-token",
    });

    const error = await request.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TransactionalEmailError);
    expect((error as TransactionalEmailError).code).toBe("resend_validation_error");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("não repete quando a cota gratuita foi esgotada", async () => {
    process.env.TRANSACTIONAL_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "secret-token";
    process.env.TRANSACTIONAL_EMAIL_FROM = "acesso@example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ name: "daily_quota_exceeded", message: "quota exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Acesso",
      html: "<p>Olá</p>",
      text: "Olá",
      idempotencyKey: "account-access/test-token",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TransactionalEmailError);
    expect((error as TransactionalEmailError).code).toBe("resend_daily_quota_exceeded");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("repete uma limitação temporária com a mesma chave idempotente", async () => {
    process.env.TRANSACTIONAL_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "secret-token";
    process.env.TRANSACTIONAL_EMAIL_FROM = "acesso@example.com";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ name: "rate_limit_exceeded", message: "try again" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "retry-after": "0" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "msg-after-retry" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      to: "student@example.com",
      subject: "Acesso",
      html: "<p>Olá</p>",
      text: "Olá",
      idempotencyKey: "account-access/test-token",
    });

    expect(result).toEqual({ messageId: "msg-after-retry", status: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(init.headers).toMatchObject({ "Idempotency-Key": "account-access/test-token" });
    }
  });
});

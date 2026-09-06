import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPrivacyEmailConfig, sendPrivacyRequestConfirmation } from "@/lib/privacy-email";
import {
  formatPrivacyRequestProtocol,
  privacyRequestLabel,
} from "@/lib/privacy-request-core";

const ENV_KEYS = [
  "TRANSACTIONAL_EMAIL_ENABLED",
  "RESEND_API_KEY",
  "TRANSACTIONAL_EMAIL_FROM",
  "RESEND_LGPD_TEMPLATE_ID",
  "LGPD_EMAIL_FROM",
] as const;

describe("privacy request protocol", () => {
  it("gera um protocolo curto, datado e sem dados pessoais", () => {
    expect(formatPrivacyRequestProtocol(new Date("2026-08-25T15:00:00Z"), "a1b2c3d4")).toBe(
      "LP-LGPD-20260825-A1B2C3D4",
    );
  });

  it("traduz o tipo interno para uma descrição pública", () => {
    expect(privacyRequestLabel("deletion_anonymization")).toBe("Eliminação ou anonimização");
  });
});

describe("privacy request email", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("permanece indisponível sem remetente e modelo próprios", () => {
    expect(getPrivacyEmailConfig()).toBeNull();
  });

  it("envia o modelo LGPD publicado com as variáveis corretas", async () => {
    process.env.TRANSACTIONAL_EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "secret-token";
    process.env.TRANSACTIONAL_EMAIL_FROM = "LeiProva <acesso@example.com>";
    process.env.RESEND_LGPD_TEMPLATE_ID = "template-lgpd";
    process.env.LGPD_EMAIL_FROM = "LeiProva Privacidade <lgpd@example.com>";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-lgpd-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPrivacyRequestConfirmation({
      email: "titular@example.com",
      firstName: "Ana",
      protocol: "LP-LGPD-20260825-A1B2C3D4",
      requestType: "Correção de dados",
    });

    expect(result).toEqual({ messageId: "email-lgpd-1", status: "queued" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "Idempotency-Key": "privacy-request/LP-LGPD-20260825-A1B2C3D4",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      to: "titular@example.com",
      from: "Editalume Privacidade <lgpd@example.com>",
      template: {
        id: "template-lgpd",
        variables: {
          NOME: "Ana",
          TIPO_SOLICITACAO: "Correção de dados",
          PROTOCOLO: "LP-LGPD-20260825-A1B2C3D4",
        },
      },
    });
  });
});

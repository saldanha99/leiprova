import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { metadata } from "@/app/layout";
import manifest from "@/app/manifest";
import { BrandMark } from "@/components/brand/BrandMark";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { buildAccountAccessEmail } from "@/lib/account-access-email";
import { BRAND_NAME, BRAND_TAGLINE, normalizeBrandEmailSender } from "@/lib/brand";
import { SITE_NAME, SITE_URL, siteIdentityGraph } from "@/lib/seo";
import { getTransactionalEmailConfig, sendTransactionalEmail } from "@/lib/transactional-email";

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "--font-manrope" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("identidade pública da Editalume", () => {
  it("mantém metadados e dados estruturados alinhados sem antecipar um domínio novo", () => {
    expect(BRAND_NAME).toBe("Editalume");
    expect(SITE_NAME).toBe(BRAND_NAME);
    expect(SITE_URL).toBe("https://leiprova.2b.app.br");
    expect(metadata.title).toEqual({
      default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      template: `%s | ${BRAND_NAME}`,
    });
    expect(metadata).toMatchObject({
      applicationName: BRAND_NAME,
      creator: BRAND_NAME,
      publisher: BRAND_NAME,
      openGraph: { siteName: BRAND_NAME, title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
      twitter: { title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
    });
    expect(new URL(String(metadata.metadataBase)).origin).toBe(SITE_URL);
    expect(siteIdentityGraph["@graph"].every((item) => item.name === BRAND_NAME)).toBe(true);
  });

  it("mantém o aplicativo instalável com a nova marca e a rota existente", () => {
    expect(manifest()).toMatchObject({
      name: BRAND_NAME,
      short_name: BRAND_NAME,
      start_url: "/app",
      display: "standalone",
      icons: [
        { src: "/brand/editalume-icon-192.png" },
        { src: "/brand/editalume-icon-512.png" },
      ],
    });
  });

  it("apresenta a marca acessível mesmo pelos componentes de nome técnico legado", () => {
    const platformLogo = renderToStaticMarkup(createElement(LeiProvaMark, { href: "/app" }));
    const landingLogo = renderToStaticMarkup(createElement(BrandMark));

    expect(platformLogo).toContain('aria-label="Editalume — página inicial"');
    expect(platformLogo).toContain('href="/app"');
    expect(landingLogo).toContain('aria-label="Editalume — ir para o início"');
    for (const html of [platformLogo, landingLogo]) {
      expect(html).toContain(BRAND_TAGLINE.toLowerCase());
      expect(html).not.toMatch(/Lei\s*Prova/i);
    }
  });

  it.each([true, false])("usa Editalume no e-mail de acesso (compra: %s), preservando o link", (purchase) => {
    const accessUrl = "https://leiprova.2b.app.br/ativar?token=ficticio";
    const email = buildAccountAccessEmail({ name: "Ana", accessUrl, purchase });

    expect(email.subject).toContain(BRAND_NAME);
    expect(email.text).toContain(BRAND_NAME);
    expect(email.text).toContain(accessUrl);
    expect(email.html).toContain('alt="Editalume"');
    expect(email.html).toContain(`href="${accessUrl}"`);
    expect(email.html).toContain(BRAND_TAGLINE);
    expect(email.subject).not.toMatch(/Lei\s*Prova/i);
  });
});

describe("remetente com configuração legada", () => {
  it.each([
    ["LeiProva <acesso@leiprova.example>", "Editalume <acesso@leiprova.example>"],
    ["Lei Prova <acesso@example.com>", "Editalume <acesso@example.com>"],
    ["leiprova Privacidade <lgpd@example.com>", "Editalume Privacidade <lgpd@example.com>"],
    ['"LeiProva" <acesso@example.com>', '"Editalume" <acesso@example.com>'],
    [' "Lei Prova Privacidade" <lgpd@example.com>', ' "Editalume Privacidade" <lgpd@example.com>'],
    ["LeiProva<acesso@example.com>", "Editalume<acesso@example.com>"],
  ])("atualiza somente o nome de exibição de %s", (from, expected) => {
    expect(normalizeBrandEmailSender(from)).toBe(expected);
  });

  it.each([
    "acesso@leiprova.example",
    "leiprova@example.com",
    "<leiprova@example.com>",
    "Editalume <leiprova@example.com>",
    "Outra marca <leiprova@example.com>",
    "LeiProvaOutraMarca <acesso@example.com>",
    "Equipe LeiProva <acesso@example.com>",
  ])("preserva endereço isolado e nome que não é o prefixo legado: %s", (from) => {
    expect(normalizeBrandEmailSender(from)).toBe(from);
  });

  it("normaliza o remetente configurado no envio HTML sem alterar a variável nem o endereço", async () => {
    const originalFrom = "LeiProva <acesso@leiprova.example>";
    vi.stubEnv("TRANSACTIONAL_EMAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "token-ficticio");
    vi.stubEnv("TRANSACTIONAL_EMAIL_FROM", originalFrom);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-ficticio" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(getTransactionalEmailConfig()?.from).toBe("Editalume <acesso@leiprova.example>");
    await sendTransactionalEmail({
      to: "estudante@example.com",
      subject: "Editalume",
      html: "<p>Acesso de teste</p>",
      text: "Acesso de teste",
      idempotencyKey: "account-access/brand-test",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body)).from).toBe("Editalume <acesso@leiprova.example>");
    expect(process.env.TRANSACTIONAL_EMAIL_FROM).toBe(originalFrom);
  });
});

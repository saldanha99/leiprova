import { z } from "zod";

/**
 * Rastreamento de funil (LEI 10). Toda a lógica de atribuição fica aqui:
 * - captura TODOS os parâmetros da URL de entrada e guarda no sessionStorage;
 * - lê os cookies _fbp, _fbc e _ga; reconstrói o _fbc a partir do fbclid;
 * - gera event_id único, o mesmo enviado ao Pixel (dataLayer) e à CAPI (servidor);
 * - monta o pacote de atribuição que o checkout repassa à Stripe (metadata).
 *
 * Funções puras recebem os dados por parâmetro (testáveis sem navegador);
 * as funções `browser*` só rodam no cliente.
 */

export const TRACKING_STORAGE_KEY = "els:attribution:v1";
const MAX_PARAMS = 40;
const MAX_KEY = 64;
const MAX_VALUE = 300;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const CLICK_ID_KEYS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "msclkid"] as const;

export type FunnelEventName = "InitiateCheckout" | "AddPaymentInfo" | "Purchase" | "Lead";

export type Attribution = {
  /** Todos os parâmetros da primeira URL com parâmetros da sessão (valores truncados). */
  params: Record<string, string>;
  landingPath: string;
  capturedAt: string;
  fbp?: string;
  fbc?: string;
  ga?: string;
};

/** Parâmetros da URL, sem perder nenhum, com limites de tamanho. */
export function parseUrlParams(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of query) {
    if (Object.keys(params).length >= MAX_PARAMS) break;
    const safeKey = key.trim().slice(0, MAX_KEY);
    if (!safeKey || safeKey in params) continue;
    params[safeKey] = value.slice(0, MAX_VALUE);
  }
  return params;
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try {
      out[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[name] = part.slice(index + 1).trim();
    }
  }
  return out;
}

/** Formato da Meta: fb.1.<timestamp em ms>.<fbclid>. */
export function buildFbc(fbclid: string, nowMs: number): string {
  return `fb.1.${Math.trunc(nowMs)}.${fbclid}`;
}

/** Cookie _fbc existente vence; sem ele, reconstrói do fbclid da URL. */
export function resolveFbc(cookies: Record<string, string>, params: Record<string, string>, nowMs: number) {
  if (cookies._fbc) return cookies._fbc;
  return params.fbclid ? buildFbc(params.fbclid, nowMs) : undefined;
}

/**
 * Junta a atribuição salva com a visita atual. A primeira visita com parâmetros
 * é preservada (first-touch dentro da sessão); cookies são sempre os mais recentes.
 */
export function mergeAttribution(
  saved: Attribution | null,
  visit: { search: string; path: string; cookieHeader: string; nowMs: number },
): Attribution {
  const params = parseUrlParams(visit.search);
  const cookies = parseCookies(visit.cookieHeader);
  const base: Attribution = saved && Object.keys(saved.params).length > 0
    ? saved
    : { params, landingPath: visit.path.slice(0, 300), capturedAt: new Date(visit.nowMs).toISOString() };
  // Click id novo (outro anúncio) atualiza o fbc mesmo com atribuição antiga.
  const fbc = resolveFbc(cookies, { ...base.params, ...params }, visit.nowMs) ?? base.fbc;
  return {
    ...base,
    fbp: cookies._fbp ?? base.fbp,
    fbc,
    ga: cookies._ga ?? base.ga,
  };
}

/** event_id compartilhado entre Pixel e CAPI. Purchase usa id determinístico do pedido. */
export function newEventId(name: FunnelEventName, random: () => string = defaultRandomId): string {
  return `${name.toLowerCase()}_${random()}`;
}

export function purchaseEventId(orderOrSessionId: string) {
  return `purchase_${orderOrSessionId}`;
}

function defaultRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Campos curtos para a metadata da Stripe (máx. 50 chaves, 500 caracteres cada). */
export function attributionMetadata(attribution: Attribution | null): Record<string, string> {
  if (!attribution) return {};
  const pick: Record<string, string | undefined> = {
    ...Object.fromEntries(UTM_KEYS.map((key) => [key, attribution.params[key]])),
    ...Object.fromEntries(CLICK_ID_KEYS.map((key) => [key, attribution.params[key]])),
    fbp: attribution.fbp,
    fbc: attribution.fbc,
    ga: attribution.ga,
    landing_path: attribution.landingPath,
  };
  return Object.fromEntries(
    Object.entries(pick)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .map(([key, value]) => [`trk_${key}`, value.slice(0, 450)]),
  );
}

/** Repassa UTMs e click ids para um link de saída (ex.: checkout externo). */
export function decorateUrl(href: string, attribution: Attribution | null, origin: string): string {
  if (!attribution) return href;
  const url = new URL(href, origin);
  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    const value = attribution.params[key];
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

/* ------------------------------ navegador ------------------------------ */

export function browserReadAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** Chamar em toda navegação: captura parâmetros e cookies e persiste. */
export function browserCaptureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const merged = mergeAttribution(browserReadAttribution(), {
    search: window.location.search,
    path: window.location.pathname,
    cookieHeader: document.cookie,
    nowMs: Date.now(),
  });
  try {
    window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Modo privado/cota cheia: segue sem persistir.
  }
  return merged;
}

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

/** Evento para o GTM (web → Stape). O mesmo eventId vai à CAPI pelo servidor. */
export function browserTrack(name: FunnelEventName, eventId: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const target = window as DataLayerWindow;
  target.dataLayer = target.dataLayer ?? [];
  target.dataLayer.push({ event: name, event_id: eventId, ...data });
}

/* --------------------------- contrato com o servidor --------------------------- */


const shortText = (max: number) => z.string().trim().min(1).max(max);

/** O que o checkout aceita do navegador: atribuição e o event_id do InitiateCheckout. */
export const checkoutTrackingSchema = z
  .object({
    eventId: z.string().regex(/^initiatecheckout_[A-Za-z0-9-]{8,64}$/),
    attribution: z
      .object({
        params: z.record(shortText(MAX_KEY), z.string().max(MAX_VALUE)).refine((value) => Object.keys(value).length <= MAX_PARAMS),
        landingPath: z.string().max(300),
        capturedAt: z.string().max(40),
        fbp: shortText(200).optional(),
        fbc: shortText(500).optional(),
        ga: shortText(200).optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type CheckoutTracking = z.infer<typeof checkoutTrackingSchema>;

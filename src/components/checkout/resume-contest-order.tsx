"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { ContestOrderLine } from "@/lib/db/schema";

const ContestPayment = dynamic(() => import("./contest-payment").then((module) => module.ContestPayment), { ssr: false });

export function ResumeContestOrder({ orderId, items, totalCents, publishableKey }: {
  orderId: string; items: Pick<ContestOrderLine, "productSlug" | "accessKey">[]; totalCents: number; publishableKey?: string;
}) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  async function resume() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/stripe/contest-checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: orderId, items }),
      });
      const body: unknown = await response.json();
      const result = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível retomar esta tentativa.");
      if (typeof result.clientSecret === "string" && result.orderId === orderId && publishableKey) { setClientSecret(result.clientSecret); return; }
      if (typeof result.url === "string") {
        const target = new URL(result.url);
        if (target.protocol === "https:" && target.hostname === "checkout.stripe.com") { window.location.assign(target.href); return; }
      }
      throw new Error("Pagamento indisponível. Sua tentativa foi preservada; não refaça a compra.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível retomar o pagamento.");
    } finally { inFlight.current = false; setPending(false); }
  }
  if (clientSecret && publishableKey) return <ContestPayment publishableKey={publishableKey} clientSecret={clientSecret}
    orderId={orderId} totalCents={totalCents} billingLabel={items[0]?.accessKey === "annual" ? "/ano" : "/mês"} />;
  return <div className="mt-5">
    <button type="button" onClick={resume} disabled={pending} className="min-h-11 rounded-lg border border-emerald-300/30 px-4 text-xs font-bold text-emerald-200 disabled:opacity-50">
      {pending ? "Recuperando pagamento…" : "Retomar a mesma seleção"}
    </button>
    {message && <p role="status" className="mt-3 text-sm text-amber-100">{message}</p>}
  </div>;
}

"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { PortalButton } from "@/components/checkout/portal-button";
import { browserTrack, purchaseEventId } from "@/lib/tracking";

type Stage = "processing" | "active" | "attention" | "failed" | "error";

/** Purchase no Pixel com o mesmo event_id que o servidor usa na CAPI (purchase_<session>). */
function trackPurchaseOnce(sessionId: string, planName: string | null) {
  const key = `els:purchase-tracked:${sessionId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sem storage: o dedupe por event_id na Meta evita contagem dupla
  }
  browserTrack("Purchase", purchaseEventId(sessionId), { plan_name: planName, checkout_session_id: sessionId });
}

export function ReturnStatus({ sessionId }: { sessionId: string }) {
  const [stage, setStage] = useState<Stage>("processing");
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function poll() {
      attempts += 1;

      try {
        const response = await fetch(`/api/stripe/status?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 404 && attempts < 16) {
          timeout = setTimeout(poll, 2_000);
          return;
        }

        const data = (await response.json().catch(() => ({}))) as {
          stage?: Stage;
          planName?: string;
        };
        if (!response.ok || !data.stage) throw new Error("status unavailable");
        if (stopped) return;

        setStage(data.stage);
        setPlanName(data.planName ?? null);
        if (data.stage === "active") trackPurchaseOnce(sessionId, data.planName ?? null);

        if (data.stage === "processing" && attempts < 16) {
          timeout = setTimeout(poll, 2_000);
        } else if (data.stage === "processing") {
          setStage("error");
        }
      } catch {
        if (!stopped) setStage("error");
      }
    }

    void poll();
    return () => {
      stopped = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [sessionId]);

  const content = {
    processing: {
      icon: <LoaderCircle className="size-8 animate-spin text-els-amber-ink" aria-hidden="true" />,
      title: "Estamos confirmando seu pagamento",
      description: "A confirmação costuma chegar em poucos segundos. Você pode manter esta página aberta.",
    },
    active: {
      icon: <CheckCircle2 className="size-9 text-els-green-ink" aria-hidden="true" />,
      title: "Acesso liberado",
      description: planName
        ? `Seu plano ${planName} já está ativo. Bons estudos!`
        : "Seu plano já está ativo. Bons estudos!",
    },
    attention: {
      icon: <Clock3 className="size-9 text-els-amber-ink" aria-hidden="true" />,
      title: "Pagamento precisa de atenção",
      description: "Abra a gestão da assinatura para concluir a autenticação ou atualizar a forma de pagamento.",
    },
    failed: {
      icon: <AlertTriangle className="size-9 text-els-danger-ink" aria-hidden="true" />,
      title: "O pagamento não foi concluído",
      description: "Nenhuma liberação foi feita. Você pode voltar ao plano e iniciar uma nova tentativa.",
    },
    error: {
      icon: <RotateCcw className="size-9 text-els-fg-2" aria-hidden="true" />,
      title: "Ainda não conseguimos consultar a confirmação",
      description: "Seu pagamento não será duplicado. Aguarde um pouco e atualize esta página.",
    },
  }[stage];

  return (
    <section className="mx-auto max-w-xl rounded-[1.75rem] border border-els-line bg-els-surface p-7 text-center shadow-2xl shadow-black/20 sm:p-10" aria-live="polite">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-els-line bg-els-raise">
        {content.icon}
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-.035em] text-els-fg sm:text-3xl">{content.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-els-fg-3">{content.description}</p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/app" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber-2">
          Ir para meus estudos
        </Link>
        {stage === "attention" && <PortalButton />}
        {(stage === "failed" || stage === "error") && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-els-line px-5 text-sm font-semibold text-els-fg-2 transition hover:bg-els-raise-hover"
          >
            Atualizar confirmação
          </button>
        )}
      </div>
    </section>
  );
}

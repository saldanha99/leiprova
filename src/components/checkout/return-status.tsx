"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { PortalButton } from "@/components/checkout/portal-button";

type Stage = "processing" | "active" | "attention" | "failed" | "error";

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
      icon: <LoaderCircle className="size-8 animate-spin text-amber-300" aria-hidden="true" />,
      title: "Estamos confirmando seu pagamento",
      description: "A confirmação costuma chegar em poucos segundos. Você pode manter esta página aberta.",
    },
    active: {
      icon: <CheckCircle2 className="size-9 text-emerald-300" aria-hidden="true" />,
      title: "Acesso liberado",
      description: planName
        ? `Seu plano ${planName} já está ativo. Bons estudos!`
        : "Seu plano já está ativo. Bons estudos!",
    },
    attention: {
      icon: <Clock3 className="size-9 text-amber-300" aria-hidden="true" />,
      title: "Pagamento precisa de atenção",
      description: "Abra a gestão da assinatura para concluir a autenticação ou atualizar a forma de pagamento.",
    },
    failed: {
      icon: <AlertTriangle className="size-9 text-rose-300" aria-hidden="true" />,
      title: "O pagamento não foi concluído",
      description: "Nenhuma liberação foi feita. Você pode voltar ao plano e iniciar uma nova tentativa.",
    },
    error: {
      icon: <RotateCcw className="size-9 text-slate-300" aria-hidden="true" />,
      title: "Ainda não conseguimos consultar a confirmação",
      description: "Seu pagamento não será duplicado. Aguarde um pouco e atualize esta página.",
    },
  }[stage];

  return (
    <section className="mx-auto max-w-xl rounded-[1.75rem] border border-white/9 bg-[#0a1420] p-7 text-center shadow-2xl shadow-black/20 sm:p-10" aria-live="polite">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/8 bg-white/[.035]">
        {content.icon}
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-.035em] text-white sm:text-3xl">{content.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{content.description}</p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/app" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">
          Ir para meus estudos
        </Link>
        {stage === "attention" && <PortalButton />}
        {(stage === "failed" || stage === "error") && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            Atualizar confirmação
          </button>
        )}
      </div>
    </section>
  );
}

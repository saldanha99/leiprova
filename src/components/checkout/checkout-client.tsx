"use client";

import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe, type StripeCheckoutElementsSdkOptions } from "@stripe/stripe-js";
import { AlertTriangle, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CheckoutClientProps = {
  planSlug: string;
  publishableKey: string;
  buttonLabel: string;
};

type SessionResponse =
  | { clientSecret: string; completed?: never; sessionId?: never; error?: never }
  | { completed: true; sessionId: string; clientSecret?: never; error?: never }
  | { error: string; clientSecret?: never; completed?: never; sessionId?: never };

export function CheckoutClient({ planSlug, publishableKey, buttonLabel }: CheckoutClientProps) {
  const router = useRouter();
  const [stripePromise] = useState(() => loadStripe(publishableKey));
  const [attemptId] = useState(() => crypto.randomUUID());
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function createSession() {
      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planSlug, attemptId }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as SessionResponse;

        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Não foi possível abrir o pagamento.");
        }
        if ("completed" in data && data.completed && data.sessionId) {
          router.replace(`/checkout/retorno?session_id=${encodeURIComponent(data.sessionId)}`);
          return;
        }
        if (!("clientSecret" in data) || !data.clientSecret) {
          throw new Error("A sessão de pagamento não pôde ser iniciada.");
        }

        setClientSecret(data.clientSecret);
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível abrir o pagamento.");
      }
    }

    void createSession();
    return () => controller.abort();
  }, [attemptId, planSlug, router]);

  const options = useMemo<StripeCheckoutElementsSdkOptions | null>(
    () =>
      clientSecret
        ? {
            clientSecret,
            elementsOptions: {
              loader: "auto",
              appearance: {
                theme: "night",
                inputs: "spaced",
                labels: "above",
                variables: {
                  colorPrimary: "#fbbf24",
                  colorBackground: "#0b1623",
                  colorText: "#f8fafc",
                  colorTextSecondary: "#94a3b8",
                  colorDanger: "#fb7185",
                  borderRadius: "12px",
                  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                  spacingUnit: "4px",
                },
                rules: {
                  ".Input": {
                    border: "1px solid rgba(255,255,255,.12)",
                    boxShadow: "none",
                  },
                  ".Input:focus": {
                    border: "1px solid rgba(251,191,36,.75)",
                    boxShadow: "0 0 0 3px rgba(251,191,36,.10)",
                  },
                  ".Tab": {
                    border: "1px solid rgba(255,255,255,.10)",
                  },
                },
              },
            },
          }
        : null,
    [clientSecret],
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-5 text-sm text-rose-100" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-300" aria-hidden="true" />
          <div>
            <strong className="block font-semibold">Não foi possível iniciar o checkout</strong>
            <p className="mt-1 leading-6 text-rose-100/70">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-white/8 bg-white/[.025]" aria-live="polite">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-amber-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-400">Preparando seu ambiente seguro…</p>
        </div>
      </div>
    );
  }

  return (
    <CheckoutElementsProvider stripe={stripePromise} options={options}>
      <PaymentForm buttonLabel={buttonLabel} />
    </CheckoutElementsProvider>
  );
}

function PaymentForm({ buttonLabel }: { buttonLabel: string }) {
  const router = useRouter();
  const result = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result.type !== "success" || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const confirmation = await result.checkout.confirm({
        redirect: "if_required",
      });

      if (confirmation.type === "error") {
        setError(confirmation.error.message || "Confira os dados de pagamento e tente novamente.");
        setSubmitting(false);
        return;
      }

      router.replace(`/checkout/retorno?session_id=${encodeURIComponent(confirmation.session.id)}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível confirmar o pagamento.");
      setSubmitting(false);
    }
  }

  if (result.type === "error") {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-5 text-sm text-rose-100" role="alert">
        {result.error.message}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/8 bg-[#0b1623] p-4 sm:p-5">
        <PaymentElement
          options={{ layout: { type: "accordion", defaultCollapsed: false, radios: "always" } }}
          onLoadError={(event) =>
            setError(event.error.message ?? "Não foi possível carregar os meios de pagamento.")
          }
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] px-4 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={result.type !== "success" || !result.checkout.canConfirm || submitting}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-extrabold text-slate-950 shadow-[0_16px_50px_rgba(251,191,36,.16)] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Confirmando…
          </>
        ) : (
          <>
            <LockKeyhole className="size-4" aria-hidden="true" /> {buttonLabel}
          </>
        )}
      </button>

      <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
        <p>Seus dados de pagamento são enviados diretamente à Stripe e não passam pelos servidores da Editalume.</p>
      </div>
    </form>
  );
}

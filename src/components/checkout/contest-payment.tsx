"use client";

import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { loadStripe, type StripeCheckoutElementsSdkOptions } from "@stripe/stripe-js";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/plans";
import styles from "./contest-cart.module.css";

export function ContestPayment({ publishableKey, clientSecret, orderId, totalCents, billingLabel }: {
  publishableKey: string;
  clientSecret: string;
  orderId: string;
  totalCents: number;
  billingLabel: string;
}) {
  const [stripe] = useState(() => loadStripe(publishableKey));
  const options = useMemo<StripeCheckoutElementsSdkOptions>(() => ({
    clientSecret,
    elementsOptions: {
      loader: "auto",
      appearance: {
        theme: "stripe",
        labels: "above",
        variables: {
          colorPrimary: "#244c34",
          colorBackground: "#fffcf1",
          colorText: "#102b25",
          colorTextSecondary: "#586548",
          colorDanger: "#9b302b",
          borderRadius: "8px",
          spacingUnit: "4px",
        },
        rules: {
          ".Input": { border: "1px solid #c7cbb5", boxShadow: "none" },
          ".Input:focus": { border: "1px solid #244c34", boxShadow: "0 0 0 3px rgba(36,76,52,.12)" },
          ".Tab": { border: "1px solid #c7cbb5" },
        },
      },
    },
  }), [clientSecret]);
  return <section className={styles.paymentSection} aria-labelledby="secure-payment-title">
    <h3 id="secure-payment-title">Finalize com tranquilidade.</h3>
    <p>Os campos abaixo são protegidos pela Stripe. Confira seu resumo antes de confirmar.</p>
    <CheckoutElementsProvider stripe={stripe} options={options}>
      <ContestPaymentForm orderId={orderId} totalCents={totalCents} billingLabel={billingLabel} />
    </CheckoutElementsProvider>
  </section>;
}

function ContestPaymentForm({ orderId, totalCents, billingLabel }: {
  orderId: string; totalCents: number; billingLabel: string;
}) {
  const result = useCheckoutElements();
  const router = useRouter();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result.type !== "success" || !result.checkout.canConfirm || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const confirmation = await result.checkout.confirm({ redirect: "if_required" });
      if (confirmation.type === "error") {
        throw new Error(confirmation.error.message || "Confira os dados e tente novamente.");
      }
      // O retorno não libera direitos: a confirmação assinada da Stripe faz isso no servidor.
      router.replace(`/app/compras?pedido=${encodeURIComponent(orderId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o pagamento.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  if (result.type === "error") return <p role="alert" className={styles.error}>Não foi possível carregar o pagamento. Recarregue a página para retomar a mesma tentativa ou consulte Meus concursos.</p>;
  return <form onSubmit={submit}>
    <PaymentElement options={{ layout: { type: "accordion", defaultCollapsed: false, radios: "always" } }}
      onLoadError={() => setError("Não foi possível carregar os meios de pagamento. Recarregue para retomar sua tentativa.")} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={styles.payButton} type="submit" disabled={result.type !== "success" || !result.checkout.canConfirm || submitting}>
      <LockKeyhole size={17} aria-hidden="true" />
      {submitting ? "Confirmando pagamento…" : `Assinar por ${formatBRL(totalCents)}${billingLabel}`}
    </button>
    <p className={styles.paymentNote}>Renovação automática. O acesso será liberado somente após a confirmação do pagamento.</p>
  </form>;
}

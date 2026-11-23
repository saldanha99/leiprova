"use client";
import { useActionState } from "react";
import { cancelContestRenewalAction } from "@/app/actions/contest-subscriptions";

export function CancelContestRenewal({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(cancelContestRenewalAction, {
    message: "",
  });
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        disabled={pending}
        className="min-h-11 rounded-lg border border-els-line-strong px-4 text-xs font-bold text-els-fg-2 disabled:opacity-50"
      >
        {pending
          ? "Cancelando renovação…"
          : "Cancelar renovação ao fim do período"}
      </button>
      {state.message && (
        <p role="status" className="mt-3 text-sm text-els-amber-ink">
          {state.message}
        </p>
      )}
    </form>
  );
}

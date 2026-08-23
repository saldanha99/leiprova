"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function PortalButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Não foi possível abrir a gestão da assinatura.");
      }

      window.location.assign(data.url);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Tente novamente em instantes.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-4 text-sm font-semibold text-slate-200 transition hover:border-amber-300/25 hover:text-white disabled:cursor-wait disabled:opacity-60",
          className,
        )}
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
        Gerenciar na Stripe
      </button>
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clipboard, ExternalLink, LoaderCircle, Plus, X } from "lucide-react";

type OnboardingResponse = {
  partner: {
    publicId: string;
    displayName: string;
    email: string;
    status: string;
  };
  onboarding: {
    url: string;
    expiresAt: string;
  };
};

function useOnboardingRequest() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResponse | null>(null);

  async function submit(body: Record<string, string>) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/stripe-connect/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | OnboardingResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("onboarding" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : "Não foi possível gerar o formulário.");
      }

      setResult(payload);
      router.refresh();
      return payload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível gerar o formulário.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, result, setResult, submit };
}

function OnboardingLink({ result }: { result: OnboardingResponse }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(result.onboarding.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/7 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
        <Check aria-hidden="true" className="size-4" />
        Formulário criado para {result.partner.displayName}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        O link é temporário e deve ser enviado somente ao titular. A LeiProva não recebe os documentos nem os dados bancários.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-bold text-[#071019] hover:bg-emerald-200"
        >
          {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <a
          href={result.onboarding.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold text-slate-200 hover:bg-white/5"
        >
          Conferir formulário <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}

export function NewConnectPartnerButton({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const request = useOnboardingRequest();

  async function handleSubmit(formData: FormData) {
    const result = await request.submit({
      action: "create_partner",
      requestId: crypto.randomUUID(),
      displayName: String(formData.get("displayName") ?? ""),
      legalName: String(formData.get("legalName") ?? ""),
      email: String(formData.get("email") ?? ""),
    });
    if (result) setOpen(true);
  }

  return (
    <div className="sm:max-w-xl">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => {
          setOpen((value) => !value);
          request.setResult(null);
        }}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold text-slate-200 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:text-slate-600"
      >
        {open ? <X className="size-4" /> : <Plus className="size-4" />}
        {open ? "Fechar" : "Adicionar recebedor"}
      </button>

      {open && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
          {request.result ? (
            <OnboardingLink result={request.result} />
          ) : (
            <form action={handleSubmit} className="grid gap-4">
              <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
                Nome para exibição
                <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" className="min-h-11 rounded-xl border border-white/10 bg-[#071019] px-3 text-sm text-white outline-none focus:border-amber-300/50" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
                Nome completo ou razão social
                <input name="legalName" required minLength={2} maxLength={180} autoComplete="organization" className="min-h-11 rounded-xl border border-white/10 bg-[#071019] px-3 text-sm text-white outline-none focus:border-amber-300/50" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
                E-mail do titular
                <input name="email" type="email" required maxLength={254} autoComplete="email" className="min-h-11 rounded-xl border border-white/10 bg-[#071019] px-3 text-sm text-white outline-none focus:border-amber-300/50" />
              </label>
              {request.error && <p role="alert" className="text-xs leading-5 text-rose-300">{request.error}</p>}
              <button type="submit" disabled={request.loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-[#071019] hover:bg-amber-200 disabled:opacity-60">
                {request.loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                Criar conta e gerar formulário
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function ConnectPartnerOnboardingButton({
  partnerPublicId,
  enabled,
}: {
  partnerPublicId: string;
  enabled: boolean;
}) {
  const request = useOnboardingRequest();

  async function createLink() {
    await request.submit({
      action: "create_link",
      requestId: crypto.randomUUID(),
      partnerPublicId,
    });
  }

  return (
    <div className="min-w-44">
      {request.result ? (
        <OnboardingLink result={request.result} />
      ) : (
        <>
          <button type="button" disabled={!enabled || request.loading} onClick={createLink} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[11px] font-bold text-slate-300 enabled:hover:bg-white/5 disabled:text-slate-600">
            {request.loading && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />}
            Gerar formulário
          </button>
          {request.error && <p role="alert" className="mt-2 max-w-52 text-[10px] leading-4 text-rose-300">{request.error}</p>}
        </>
      )}
    </div>
  );
}

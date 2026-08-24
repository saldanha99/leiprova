import { getSupplierIdentity } from "@/lib/legal";

/**
 * Bloco de identificação do fornecedor exigido pelo Decreto 7.962/2013,
 * art. 2º, I. Enquanto o `.env` não estiver preenchido, exibe um aviso honesto
 * em vez de um texto que finge cumprir a norma — e o checkout permanece
 * bloqueado por `getCheckoutAvailability`.
 */
export function SupplierIdentityBlock() {
  const supplier = getSupplierIdentity();

  if (!supplier) {
    return (
      <p className="rounded-xl border border-amber-300/15 bg-amber-300/6 px-4 py-3 text-sm leading-6 text-amber-100/80">
        A identificação completa do fornecedor ainda não foi publicada. Enquanto isso, não há
        oferta comercial ativa: o checkout permanece bloqueado no próprio código, e não apenas
        por configuração.
      </p>
    );
  }

  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-white/8 bg-white/2 px-4 py-4 sm:grid-cols-[auto_1fr]">
      <dt className="text-slate-500">Razão social</dt>
      <dd className="text-slate-200">{supplier.legalName}</dd>
      {supplier.tradeName && (
        <>
          <dt className="text-slate-500">Nome fantasia</dt>
          <dd className="text-slate-200">{supplier.tradeName}</dd>
        </>
      )}
      <dt className="text-slate-500">CNPJ</dt>
      <dd className="text-slate-200">{supplier.taxId}</dd>
      <dt className="text-slate-500">Endereço</dt>
      <dd className="text-slate-200">{supplier.address}</dd>
      <dt className="text-slate-500">E-mail</dt>
      <dd className="text-slate-200">{supplier.email}</dd>
      <dt className="text-slate-500">Atendimento</dt>
      <dd className="text-slate-200">{supplier.supportChannel}</dd>
    </dl>
  );
}

/** Contato do encarregado pelo tratamento de dados (LGPD, art. 41). */
export function DataProtectionContact() {
  const supplier = getSupplierIdentity();

  if (!supplier) {
    return (
      <p>
        O contato do encarregado pelo tratamento de dados será publicado nesta página junto com a
        identificação do fornecedor, antes de qualquer oferta comercial.
      </p>
    );
  }

  return (
    <p>
      Encarregado pelo tratamento de dados pessoais: {supplier.dataProtectionContact}. Os pedidos
      são respondidos nos prazos da Lei 13.709/2018.
    </p>
  );
}

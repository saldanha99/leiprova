import { getDataProtectionContact, getSupplierIdentity } from "@/lib/legal";

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
      <p className="rounded-xl border border-els-amber/15 bg-els-amber/6 px-4 py-3 text-sm leading-6 text-els-amber-ink/80">
        A identificação completa do fornecedor ainda não foi publicada. Enquanto isso, não há
        oferta comercial ativa: o checkout permanece bloqueado no próprio código, e não apenas
        por configuração.
      </p>
    );
  }

  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-els-line bg-els-raise px-4 py-4 sm:grid-cols-[auto_1fr]">
      <dt className="text-els-fg-3">Razão social</dt>
      <dd className="text-els-fg-2">{supplier.legalName}</dd>
      {supplier.tradeName && (
        <>
          <dt className="text-els-fg-3">Nome fantasia</dt>
          <dd className="text-els-fg-2">{supplier.tradeName}</dd>
        </>
      )}
      <dt className="text-els-fg-3">CNPJ</dt>
      <dd className="text-els-fg-2">{supplier.taxId}</dd>
      <dt className="text-els-fg-3">Endereço</dt>
      <dd className="text-els-fg-2">{supplier.address}</dd>
      <dt className="text-els-fg-3">Endereço eletrônico</dt>
      <dd className="text-els-fg-2">
        {supplier.email.startsWith("https://") || supplier.email.startsWith("http://") ? (
          <a
            className="font-semibold text-els-amber-ink transition hover:text-els-amber-ink"
            href={supplier.email}
          >
            Acessar canal digital
          </a>
        ) : (
          <a
            className="font-semibold text-els-amber-ink transition hover:text-els-amber-ink"
            href={`mailto:${supplier.email}`}
          >
            {supplier.email}
          </a>
        )}
      </dd>
      <dt className="text-els-fg-3">Atendimento</dt>
      <dd className="text-els-fg-2">{supplier.supportChannel}</dd>
    </dl>
  );
}

/** Contato do encarregado pelo tratamento de dados (LGPD, art. 41). */
export function DataProtectionContact() {
  const contact = getDataProtectionContact();

  if (!contact) {
    return (
      <p>
        O contato do encarregado pelo tratamento de dados será publicado nesta página junto com a
        identificação do fornecedor, antes de qualquer oferta comercial.
      </p>
    );
  }

  return (
    <p>
      Encarregado pelo tratamento de dados pessoais:{" "}
      <a className="font-semibold text-els-amber-ink hover:text-els-amber-ink" href={`mailto:${contact}`}>
        {contact}
      </a>
      . Os pedidos são respondidos nos prazos da Lei 13.709/2018.
    </p>
  );
}

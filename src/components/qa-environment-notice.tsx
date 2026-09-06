import "server-only";

export function QaEnvironmentNotice() {
  // A imagem QA é construída com esta flag; produção preserva páginas estáticas.
  if (process.env.LEIPROVA_QA_ENVIRONMENT !== "synthetic") return null;

  return (
    <aside
      aria-label="Ambiente de homologação"
      className="border-b border-amber-300/40 bg-amber-100 px-4 py-3 text-center text-xs leading-5 text-amber-950"
    >
      <strong className="font-extrabold">HOMOLOGAÇÃO · DADOS FICTÍCIOS</strong>
      {" — "}Perfis e acessos de teste. Não representa matrícula, pagamento ou
      conteúdo jurídico liberado para venda. Não insira dados reais de clientes.
    </aside>
  );
}

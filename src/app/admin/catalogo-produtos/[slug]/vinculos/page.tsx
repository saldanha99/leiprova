import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { CONTEST_CATALOG, contestTitle } from "@/lib/commerce/catalog";
import { listProductBindingProposals } from "@/lib/commerce/product-binding-admin-query";
import { ProductBindingReviewPanel } from "@/components/admin/product-binding-review-panel";

export default async function ProductBindingsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireSuperAdmin("/admin/catalogo-produtos");
  const { slug } = await params;
  const product = CONTEST_CATALOG.find((item) => item.slug === slug);
  if (!product) notFound();
  const query = await searchParams;
  const page = typeof query.page === "string" && /^\d{1,4}$/u.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  let failed = false;
  let rows: Awaited<ReturnType<typeof listProductBindingProposals>> | [] = [];
  try { rows = await listProductBindingProposals(getDb(), slug, page); } catch { failed = true; }
  return <main className="mx-auto max-w-4xl px-5 py-10">
    <Link href="/admin/catalogo-produtos" className="inline-flex min-h-11 items-center text-sm text-emerald-200">← Caderno dos produtos</Link>
    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Curadoria de vínculos</p>
    <h1 className="mt-3 font-serif text-3xl text-amber-50">{contestTitle(product)}</h1>
    <p className="mt-4 text-sm leading-7 text-slate-300">Cada decisão vale somente para a questão, o produto e a edição identificados. Propostas pendentes e versões históricas não contam para o mínimo de 68. A revisão jurídica da questão continua separada.</p>
    <div className="my-6 flex flex-wrap gap-5 text-sm"><Link className="min-h-11 py-3 text-emerald-200" href="/admin/motor-editais">Conferir fontes, requisitos e edição →</Link><Link className="min-h-11 py-3 text-emerald-200" href="/admin/fabrica-autoral">Revisar autoria e conteúdo →</Link></div>
    <p className="mb-6 rounded-xl border border-amber-200/20 p-4 text-xs leading-6 text-amber-100">Este painel não cria associações produto–oportunidade, não concede permissões ao banco e não abre vendas. Se dados ou privilégios estiverem ausentes, a operação fica bloqueada; não há acesso privilegiado alternativo.</p>
    {failed ? <p role="alert" className="text-amber-200">Não foi possível consultar as propostas. Verifique a disponibilidade e as permissões de leitura do banco.</p>
      : rows.length === 0 ? <p className="text-slate-300">Nenhuma proposta nesta página. Preparar um curso no caderno não cria vínculos automaticamente.</p>
      : <div className="space-y-6">{rows.slice(0, 10).map((row) => <ProductBindingReviewPanel key={row.bindingId} productSlug={slug} row={row} />)}</div>}
    <nav aria-label="Páginas de propostas" className="mt-8 flex justify-between gap-5 text-sm text-emerald-200">
      {page > 1 ? <Link className="min-h-11 py-3" href={`?page=${page - 1}`}>← Anteriores</Link> : <span />}
      {rows.length > 10 && <Link className="min-h-11 py-3" href={`?page=${page + 1}`}>Próximas →</Link>}
    </nav>
  </main>;
}

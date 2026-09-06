import Link from "next/link";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { agentWorkSummary } from "@/lib/editorial/agent-work-queue";
import { AGENT_FOR_WORK, agentWorkResultSchema, type AgentWorkKind } from "@/lib/editorial/agent-work-contract";

const statuses:Record<string,string>={pending:"Na fila",running:"Em execução",prepared:"Preparado · revisar",blocked:"Precisa de insumo",failed:"Falhou",superseded:"Fonte alterada"};
const kinds:Record<AgentWorkKind,string>={discovery:"Novos editais",legal_mapping:"Vínculo com a lei",authoring:"Questões inéditas",legal_change:"Mudança legislativa"};
type WorkRow={key:string;kind:AgentWorkKind;status:string;title:string;attempts:number;updatedAt:string;result:unknown;error:string|null};

export default async function MotorsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  await requireAdmin("/admin/motores");
  const query=await searchParams;
  const page=Math.floor(Math.min(1000,Math.max(1,Number(typeof query.page==='string'?query.page:1)||1)));
  const db=getDb();
  const [summary,rows,cycles]=await Promise.all([
    agentWorkSummary(db),
    db.execute<WorkRow>(sql`select job_key key,kind,status,payload->>'title' title,attempts,
      updated_at::text as "updatedAt",result,last_error_code error from editorial_agent_work
      order by updated_at desc,job_key limit 30 offset ${(Math.floor(page)-1)*30}`),
    db.execute<{action:string;at:string;data:Record<string,unknown>}>(sql`
      select distinct on(action) action,created_at::text at,metadata data from audit_logs
      where action in ('automation.editorial.completed','monitor.legal.completed') order by action,created_at desc`),
  ]);
  const counts=summary.counts;
  return <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
    <header className="border-b border-white/10 pb-8">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-emerald-300">EDITALUME / CENTRAL EDITORIAL</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight md:text-5xl">Motores em movimento.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Da fonte oficial ao rascunho, cada tarefa tem responsável e evidência.
        Preparado não significa aprovado: a revisão humana continua antes da publicação e da entrega ao aluno.</p>
      <div className="mt-5 flex flex-wrap gap-3 text-xs text-amber-200">
        <span className="rounded-full border border-amber-200/20 px-3 py-2">Stripe pausado</span>
        <span className="rounded-full border border-white/15 px-3 py-2 text-slate-300">{String(summary.budget.used??0)} / {summary.budget.limit} reservas nas últimas 24h</span>
      </div>
    </header>
    <section aria-label="Filas por motor" className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(kinds).map(([kind,label],index)=>{
        const group=counts.filter(item=>item.kind===kind);const total=group.reduce((sum,item)=>sum+item.count,0);
        return <article key={kind} className="bg-[#0a1522] p-6">
          <p className="text-xs tracking-widest text-slate-500">0{index+1} / {AGENT_FOR_WORK[kind as AgentWorkKind]}</p>
          <h2 className="mt-3 text-lg font-semibold">{label}</h2><p className="mt-4 text-4xl text-emerald-200">{total}</p>
          <ul className="mt-4 space-y-2 text-xs text-slate-400">{group.map(item=><li className="flex justify-between gap-2" key={item.status}><span>{statuses[item.status]??item.status}</span><span>{item.count}</span></li>)}</ul>
        </article>;
      })}
    </section>
    <aside className="my-7 border-l-2 border-amber-300/50 pl-4 text-sm leading-7 text-slate-400">
      Coleta e monitoramento rodam na VPS. As etapas de IA dependem do Maestri aberto, dos agentes disponíveis e das assinaturas com saldo.
      Não há troca automática para API paga. Descoberta cobre os portais configurados, não todos os concursos do Brasil.
    </aside>
    <nav aria-label="Revisão editorial" className="mb-8 flex flex-wrap gap-3 text-sm text-emerald-200">
      <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4" href="/admin/fabrica-autoral">Revisar questões</Link>
      <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4" href="/admin/motor-editais">Revisar editais e requisitos</Link>
      <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4" href="/admin/fontes-oficiais">Revisar legislação</Link>
    </nav>
    <section aria-labelledby="tasks-title"><h2 id="tasks-title" className="mb-5 font-serif text-2xl">Diário de trabalho</h2>
      {!rows.length&&<p className="rounded-xl border border-white/10 p-6 text-slate-400">Nenhuma tarefa registrada neste ambiente. Isso não comprova que o motor esteja ativado.</p>}
      <div className="space-y-3">{rows.map(row=>{const parsed=agentWorkResultSchema.safeParse(row.result);const result=parsed.success?parsed.data:null;
        return <details key={row.key} className="rounded-xl border border-white/10 bg-white/[.025] p-5">
          <summary className="cursor-pointer break-words text-sm leading-6"><span className="mr-3 text-emerald-300">{statuses[row.status]??row.status}</span>{row.title}
            <span className="mt-1 block text-xs text-slate-500">{AGENT_FOR_WORK[row.kind]} · {row.attempts} tentativa(s) · {new Date(row.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span></summary>
          <div className="mt-5 space-y-4 border-t border-white/10 pt-4 text-sm leading-7 text-slate-300">
            <p className="break-all text-xs text-slate-500">Identificador: {row.key}</p>
            {row.error&&<p className="text-amber-200">Diagnóstico: {row.error}</p>}
            {result?<><p>{result.summary}</p>{result.limitations.length>0&&<ul className="list-disc space-y-2 pl-5 text-amber-100">{result.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul>}
              {result.discoveries.map((item,index)=><div key={index} className="rounded-lg border border-white/10 p-4"><p className="font-semibold">{item.title}</p><p>{item.role} · {item.jurisdiction} · {item.bank??'Banca não confirmada'}</p><p>{item.evidence}</p><a className="break-all text-emerald-300 underline" href={item.url} target="_blank" rel="noreferrer">Fonte oficial</a></div>)}
              {result.mappings.map(item=><div key={item.articleId}><p className="text-emerald-200">Artigo #{item.articleId} — proposta de vínculo</p><p>{item.rationale}</p><blockquote className="mt-2 border-l border-white/20 pl-4 text-slate-400">{item.quote}</blockquote></div>)}
              {result.questions.length>0&&<p>{result.questions.length} rascunho(s) preparado(s). Consulte a Fábrica autoral para revisão. Não estão publicados para alunos.</p>}
            </>:<p>Aguardando resultado validado. Nenhuma aprovação é presumida.</p>}
          </div>
        </details>;
      })}</div>
      <nav aria-label="Páginas de tarefas" className="mt-6 flex gap-4 text-sm text-emerald-200">
        {page>1&&<Link className="inline-flex min-h-11 items-center" href={`/admin/motores?page=${page-1}`}>← Anterior</Link>}
        {rows.length===30&&<Link className="inline-flex min-h-11 items-center" href={`/admin/motores?page=${page+1}`}>Próximas →</Link>}
      </nav>
    </section>
    <section className="mt-10 border-t border-white/10 pt-6" aria-label="Últimas execuções da VPS">
      <h2 className="font-serif text-2xl">Últimas execuções na VPS</h2>
      {cycles.map(cycle=><details key={cycle.action} className="mt-4 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-slate-300">{cycle.action==='automation.editorial.completed'?'Coleta e preparação':'Monitor de legislação'} · {new Date(cycle.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</summary><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-400">{JSON.stringify(cycle.data,null,2)}</pre></details>)}
    </section>
  </main>;
}

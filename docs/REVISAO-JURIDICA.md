# Dossiê para revisão jurídica

Documento de trabalho para o advogado que vai revisar os textos antes da
abertura comercial. Registra o que já foi ajustado, o que depende de decisão do
cliente e o que precisa de análise profissional.

**Este arquivo não é parecer jurídico.** Foi redigido por quem escreveu o
software, não por advogado, e serve para encurtar a revisão — não para
substituí-la.

Documentos em revisão: [`/termos`](../src/app/termos/page.tsx),
[`/privacidade`](../src/app/privacidade/page.tsx),
[`/reembolso`](../src/app/reembolso/page.tsx).

## Ajustes já feitos

| Ponto | Antes | Agora |
|---|---|---|
| Prazo de arrependimento | "prazo legal aplicável" | 7 dias corridos, citando o art. 49 do CDC, com devolução atualizada monetariamente (parágrafo único) |
| Identificação do fornecedor | promessa de inclusão futura | bloco estruturado com razão social, CNPJ, endereço físico, e-mail e canal de atendimento (Decreto 7.962/2013, art. 2º, I) |
| Controlador de dados | ausente | seção própria na política de privacidade (LGPD, art. 5º, VI) |
| Encarregado (DPO) | ausente | seção própria com contato (LGPD, art. 41) |
| Transferência internacional | **não mencionada** | declarada, com base legal no art. 33, VI, e escopo limitado à cobrança |
| Prazos de retenção | "serão publicados" | prazos concretos por categoria, incluindo 6 meses de registros de acesso (Marco Civil, art. 15) |
| Cancelamento | genérico | meio eficaz e confirmação imediata (Decreto 7.962/2013, art. 5º) |
| Foro | ausente | domicílio do consumidor (CDC, art. 101, I) |
| Oferta vitalícia | plano Fundador com promessa de acesso contínuo | retirada do catálogo, da interface e do checkout; registro histórico mantido inativo no banco |

A trava mais importante não está no texto e sim no código: `getCheckoutAvailability`
devolve `supplier_identity` e **impede o checkout de abrir** enquanto a
identificação estiver incompleta. Coberto por `tests/legal-identity.test.ts`.

## Depende de decisão do cliente

Não há como o software resolver estes; são dados e escolhas de negócio.

1. **Identificação:** razão social, CNPJ, endereço com CEP, e-mail e horário de
   atendimento. Vão no `.env`, não no código — o repositório é público.
2. **Encarregado de dados:** quem é e qual o contato público.
3. **Política de atualizações e SLA de suporte.**
4. **Preços definitivos**, hoje R$ 49,90/mês e R$ 497/ano.

## Para análise profissional

1. **Renovação automática** e o dever de informar com destaque, incluindo aviso
   prévio de cobrança.
2. **Promessas de resultado.** A seção 8 dos termos afasta garantia de aprovação;
   confirmar se a comunicação de marketing acompanha o mesmo cuidado.
3. **Conteúdo de terceiros.** O schema distingue `dry_law`, `previous_exam` e
   `original_style`. A modalidade `previous_exam` exige licença, titular e
   validade registrados. Confirmar o desenho antes de publicar qualquer item
   nessa modalidade — reprodução de caderno de banca sem licença é o risco
   autoral mais concreto do produto.
4. **Base legal do legítimo interesse** para métricas de qualidade de conteúdo,
   e se cabe LIA documentada.
5. **Cookies.** Hoje só há cookie essencial de sessão, o que dispensa banner de
   consentimento. Se entrar analytics, a análise muda.
6. **Uso de IA na elaboração de questões.** A procedência está declarada em
   `DEMO_CONTENT_PROVENANCE` com `humanReviewRecorded: false`. Avaliar se e como
   isso deve aparecer para o consumidor.
7. **Stripe Connect.** Se houver repasse a professores, o desenho contratual da
   participação precede a habilitação técnica. Ver seção correspondente no README.

## Verificação de conteúdo já disponível

`pnpm content:verify` confere as 12 questões contra o texto oficial no Planalto e
falha se um gabarito não for verbatim ou se um distrator reproduzir a norma. Foi
executado em 2026-08-24 com resultado limpo. Confere transcrição, não mérito
editorial nem vigência — a revisão humana independente continua pendente.

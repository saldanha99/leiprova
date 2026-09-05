# LeiProva / Editalume — fundação da operação automatizada

Registro de implementação e validação em 05/09/2026. Complementa o [benchmark do motor](BENCHMARK-MOTOR-LEIPROVA.md) e o [guia operacional](OPERACAO.md).

## Estado real da entrega

Implementado e testado **localmente**, na branch `codex/benchmark-motor-lei-prova`, a partir de `ec608475e8f9ce3e592ca69d4f82fbfcde00b2ec`. Não houve commit, push, deploy, alteração da VPS, ativação comercial ou publicação de conteúdo jurídico real nesta etapa.

O ciclo de estudo foi exercitado com banco PostgreSQL descartável, contas fictícias e regras sem validade jurídica. Isso comprova o funcionamento dos caminhos testados, não a qualidade jurídica das questões nem a prontidão da operação integral.

O motor atual ainda gera rascunhos por regras e modelos de texto. **Não foi integrado um gerador LLM de produção.** O acesso dos agentes no Maestri não implica acesso de API para o serviço na VPS.

Atualização posterior nesta data: a decisão de custo passou a ser usar sessões das
assinaturas locais, sem OpenRouter. Foram produzidos 160 rascunhos em arquivos e
implementada uma [ponte de importação local](IMPORTACAO-RASCUNHOS-LOCAIS.md), com
migration 0030. Isso não conecta automaticamente as sessões à fila descrita abaixo
nem aprova o conteúdo. O registro P0 a seguir preserva seu escopo histórico.

## O que mudou

| Frente | Implementação |
|---|---|
| Fila de geração | Persistência, reserva atômica, recuperação após queda, até cinco tentativas, intervalo progressivo, conclusão condicionada ao dono da reserva e reavaliação por mudança de entrada. |
| Idempotência | A geração identifica o rascunho já existente antes de compará-lo com o próprio acervo. A execução repetida não deve criar outra cópia. Não se promete processamento externo exatamente uma vez. |
| Elegibilidade | Questão autoral exige revisão, fonte oficial revisada e vigente, norma ativa e banca válida. Uma edição selecionada exige vínculo explícito com concurso, requisito e fonte aprovados. |
| Identidade do concurso | Vínculo único entre oportunidade e edição. Não há associação automática por ano/carreira nem preenchimento retroativo por suposição. |
| Provas futuras | Edição agendada só aparece com programa/fonte aprovados e ao menos uma questão autoral elegível. Continua proibida no modo de questões de prova já realizada. O filtro de matéria ainda pode resultar em recorte vazio; não se promete cobertura integral. |
| Revisão editorial | Dossiê completo; aprovação individual ou somente dos itens marcados; declaração explícita; impressão digital da versão lida; revalidação sob bloqueio transacional; auditoria. |
| Memorização | Erro novo em conteúdo autoral entra na fila de revisão, sem duplicar na repetição da conclusão e sem adiar uma revisão já vencida. O treino de revisão atualiza o próximo intervalo. Provas licenciadas não são transferidas para esse fluxo; a leitura e a resposta também recusam esses itens, inclusive em filas antigas. |
| Operação | Painel de pendências e solicitação auditada de reavaliação. Reenfileirar não dispensa revisão nem aprova conteúdo. |
| Superfície pública | Demonstração sem questões jurídicas até existir revisão humana registrada; textos públicos e do painel deixam de prometer aprovação/execução não comprovadas. |
| Responsividade | Corrigido transbordamento horizontal no resultado do quiz provocado por textos longos em itens de grade. Identidade Editalume preservada. |

A fila durável está conectada à **geração de rascunhos**. O tipo `source_capture` está previsto no armazenamento, mas a captura existente ainda usa o laço limitado do coletor, não essa fila. Permanecem os limites de 12 tentativas de documentos / 6 novas capturas e 50 tentativas de geração / 25 novos rascunhos por rodada.

## Banco e permissões

Aplicar, nesta ordem, antes de iniciar esta versão do app/worker:

1. `0027_editorial_durable_jobs.sql`: fila e invariantes de estado.
2. `0028_exact_opportunity_edition.sql`: vínculo explícito e único da oportunidade com a edição.
3. `0029_editorial_context_locks.sql`: função transacional de bloqueio editorial.
4. Reaplicar `deploy/grant-app-role.sql` com o papel restrito correto.

As três migrations e os privilégios foram exercitados somente no banco local descartável.

A função `public.lock_editorial_approval_context(bigint[])` é `SECURITY DEFINER` porque `FOR SHARE` exige permissão de escrita que o papel da aplicação não deve ganhar sobre todo o catálogo. Ela não altera dados: limita o escopo a até 250 questões, deriva suas referências dentro da transação, bloqueia alternativas/fontes/perfis em ordem estável, usa nomes de tabela qualificados e `search_path` fixo. Execução pública é revogada; a aplicação recebe somente `EXECUTE`. Preservar essas restrições e a ordem migration → grants.

Isso foi verificado com papel limitado: tentativa direta de travar catálogo sem privilégio falhou; o caminho autorizado funcionou. A aprovação pela interface também foi executada com esse papel, não com o proprietário do banco.

Não executar o script de dados fictícios nem os testes de integração no banco do produto.

## Evidência de qualidade

Resultado final registrado também no Maestro. Nesta rodada: lint, tipos, testes e build passaram; **54 arquivos / 358 testes**, incluindo 19 testes PostgreSQL opt-in.

Os testes de banco cobrem geração repetida/concorrente, avanço após itens bloqueados, disputa por reservas, expiração, limite de tentativas, mudança de entrada, fonte revogada, duas edições distintas do mesmo ano, unicidade de vínculo, fila de revisão e alterações concorrentes no dossiê/fonte. Sem a variável de testes, os testes PostgreSQL são pulados — não confundir a suíte sem banco com essa validação completa.

Teste de navegador com `agent-browser`, app local e papel restrito:

- Login do aluno → seleção da edição/matéria → quiz com a questão correspondente → erro → resultado.
- Duas edições do mesmo ano retornaram questões diferentes, sem misturar programas.
- Tentar prova futura no modo de prova já realizada retornou 400.
- Concluir a mesma sessão duas vezes retornou sucesso sem duplicar a revisão.
- Duas conclusões HTTP simultâneas da mesma sessão retornaram 200; houve uma tentativa persistida e somente um incremento de repetição/lapso. Cenário executado via navegador autenticado; sua incorporação como regressão HTTP persistente na suíte ainda é uma melhoria pendente.
- Erro agendou revisão; simulada a data de vencimento somente na linha fictícia, a revisão com confiança avançou o intervalo de 1 para 3 dias.
- Vinculação de programa/edição pelo painel funcionou.
- Alteração de justificativa após abrir o dossiê bloqueou a aprovação; ambas as questões permaneceram pendentes.
- Após recarregar e conferir o novo dossiê, somente a questão marcada foi aprovada; a outra permaneceu pendente.
- Reavaliação de tarefa bloqueada tornou-a pendente e registrou auditoria, sem promover conteúdo.
- Responder uma prova licenciada pelo endpoint de treino de lei seca retornou 404; o predicado compartilhado também é testado no PostgreSQL antes/depois do vencimento da licença.

Na revisão final, Prism identificou risco de transporte de conteúdo licenciado para revisão e uma edição agendada aparecendo sem requisitos/questões elegíveis. Ambos foram corrigidos e ganharam regressão SQL. A consulta do catálogo, a seleção pela API e a entrega das questões compartilham as condições de conteúdo autoral e vínculo exato.

Emulação Chromium: fluxo mobile em 390×844 e resultado tablet em 768×1024. Corrigido e novamente medido o overflow horizontal. Foi utilizada preferência de movimento reduzido para estabilizar a automação de rolagem. **Não foram testados aparelho físico, Safari/iOS, rede móvel instável ou uso offline.** Não apresentar esses resultados como homologação em dispositivo.

Evidências locais temporárias da rodada: `/tmp/leiprova-postgres.praWvS/resultado-mobile-corrigido.png`, `resultado-tablet.png` e `demo-mobile.png`. Contêm somente fixtures; não são material de divulgação.

Ao encerrar esta rodada, os servidores web/PostgreSQL e as sessões de navegador criados para o QA foram parados. Os arquivos temporários foram preservados; nenhum serviço de outro projeto foi interrompido.

### Reproduzir sem tocar dados reais

Usar PostgreSQL exclusivo em loopback com banco `leiprova_automation_test`; aplicar migrations e seed com URLs explícitas desse banco. Só então definir `LEIPROVA_TEST_DATABASE_URL` para rodar `pnpm test`. Os dois testes PostgreSQL nunca escolhem `DATABASE_URL` nem leem `.env`.

O auxiliar `scripts/setup-local-automation-smoke.ts` é de uso único sobre um banco fictício recém-preparado, após os testes de geração. Exige exatamente usuário `leiprova_test`, endereço `127.0.0.1:55439` e banco `leiprova_automation_test`. Não é seed de produto nem rotina idempotente de produção. Rodar por `pnpm exec tsx --env-file-if-exists=.env scripts/setup-local-automation-smoke.ts`, com a variável de testes explícita. As senhas de fixtures no arquivo são somente de QA.

Para o app de QA, substituir explicitamente as duas URLs de banco pelo ambiente descartável, usar cookie próprio e desativar cadastro, contato, privacidade, checkout, Connect e e-mail. Nunca expor esse ambiente fora do loopback. Ao terminar, encerrar apenas os servidores e sessões criados para o teste.

## Próximos marcos — necessários para operação real

1. **Decisão de infraestrutura de IA:** confirmar provedor de API, modelo efetivamente disponível, orçamento e credencial configurada fora de chat/Git. Preferência anterior por Gemini nos agentes não define automaticamente o contrato do serviço na VPS.
2. **Geração baseada em fontes e perfil de banca:** adaptador de provedor, saída estruturada validada, limites de custo/tempo, registro de modelo/prompt/fontes, tratamento de recusa/resposta incompleta, checagem de similaridade e testes com respostas simuladas. Nunca promover saída de IA diretamente a conteúdo revisado.
3. **Descoberta/captura robusta:** ampliar fontes oficiais das oito áreas; versionar edital e retificações; classificar pré-edital como previsão identificada; vincular banca por ato oficial. Migrar captura para fila, acrescentar navegação por agent-browser e OCR quando necessário, mantendo proveniência, controle de domínio, limites e respeito a restrições de acesso.
4. **Piloto editorial:** confirmar vigência e documentos do ENAM 2026.2 / FGV; uma disciplina primeiro, mapa requisito → dispositivo → questão, revisão humana competente e avaliação cega do estilo/dificuldade. Hoje não existe lote real novo aprovado por esta implementação.
5. **Homologação integral:** fonte real → ingestão → rascunho → revisão → edição → aluno → repetição espaçada; testar revogação/retificação, reinício do worker e dispositivos físicos. Medir cobertura curricular, não só quantidade de questões.
6. **Liberação controlada:** autorização explícita de deploy, novo preflight Git/VPS, backup recuperável, migrations/grants, flags comerciais preservadas, smoke pós-deploy, monitoramento e reversão. Depois expandir por carreira.

Não liberar as oito áreas simultaneamente apenas porque o catálogo contém seus nomes. A disponibilidade comercial deve refletir cobertura verificada. Este P0 reduz riscos e comprova caminhos locais; não encerra o projeto de automação.

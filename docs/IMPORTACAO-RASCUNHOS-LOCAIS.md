# Importação de rascunhos locais — LeiProva

## Situação

Atualização posterior: [operação controlada do lote](OPERACAO-LOTE-160.md) descreve o schemaVersion 2
e o operador de produção separado, agora autorizados pelo usuário. A CLI local descrita abaixo
mantém as restrições originais; os limites da primeira versão foram preservados, não removidos.

Continuação autorizada por Vinícius em 05/09/2026: “aprove tudo e continue”. Posteriormente, o usuário confirmou explicitamente a conferência das 160 questões e fontes e indicou sua conta. Essa conta foi encontrada em produção com papel `editor`. A confirmação está registrada localmente e vinculada aos hashes do pacote, sem fabricar autoria limpa, sessão autenticada ou aprovação no banco. Veja o [preflight posterior à confirmação](PREFLIGHT-LOTE-160.md).

A ponte entre os arquivos e a tabela de questões agora existe como serviço interno e comando **local**. Foi testada com fixtures fictícias, não com aprovação de conteúdo jurídico real. Os 160 rascunhos do pacote original continuam fora do banco de produto. A nova consulta à VPS foi somente leitura; não houve alteração remota nem acesso ao servidor residencial.

## O que a ponte faz

1. Valida fontes, quatro lotes e mapeamento estrito; no máximo 250 questões por aplicação.
2. Exige vínculo explícito de cada fonte a artigo, versão, checksum, matéria e tópico. Compara o texto normalizado completo e a referência exata, não apenas uma citação ou o número do artigo.
3. Exige artigo oficial revisado, versão vigente, ato ativo e perfil/matéria/tópico ativos. Não cria nem aprova fontes para satisfazer essas condições.
4. Simula em transação somente leitura. Fornece impressão digital do pacote e do contexto que deve acompanhar a aplicação.
5. Aplica questões, alternativas e evidências de origem em uma transação. Falha em qualquer item desfaz as gravações daquela tentativa.
6. Atribui UUID estável pelo pacote e ID local. Uma repetição idêntica não duplica nem altera estados editoriais. Conteúdo ou procedência conflitante preserva o registro existente e bloqueia a tentativa.
7. Registra o operador editorial na auditoria, sem colocá-lo como autor ou revisor. Guarda modelo declarado, ambiente, citação de apoio, fonte, versão e impressão do conteúdo.
8. Insere apenas `draft`, com autoria assistida por IA. `createdByUserId`, `reviewedByUserId`, `cleanRoomAttestedAt` e `submittedAt` permanecem nulos. Os filtros atuais não oferecem esses rascunhos ao aluno.

## Preparação necessária

- Banco dedicado com migrations até 0030, catálogo e função de bloqueio editorial instalados; o comando não executa migrations, seed, grants ou criação de contas. A migration 0030 estende a função restrita com locks de matéria/tópico, sem conceder escrita no catálogo à aplicação.
- Fontes já conferidas e aprovadas pelo fluxo humano do próprio sistema. A captura local em JSON, por si, não satisfaz essa condição.
- Operador com papel `editor` ou `admin`, identificado por UUID público. Esse é o operador da importação, não uma declaração de que essa conta revisou o conteúdo.
- Preencher [o modelo de mapeamento](../content/editorial/import-mapping.example.json). Os IDs nulos e o checksum vazio são propositais: o exemplo **não é executável**. Resolver os IDs no banco de destino, sem copiar IDs do QA para produção.

Nesta versão conservadora, a URL do ato e da versão devem corresponder à URL oficial do pacote, e o artigo precisa conter o mesmo recorte completo. Compilações equivalentes com outra URL ou artigos agregados exigem uma estratégia explícita de equivalência, ainda não implementada; não afrouxar silenciosamente a comparação.

## Execução local

O lançador carrega `.env` por convenção do projeto, mas **não utiliza `DATABASE_URL` nem `MIGRATION_DATABASE_URL`**. A conexão deve vir de `LEIPROVA_IMPORT_DATABASE_URL`, fornecida fora de prompts, notas e Git.

O comando aceita apenas:

- `127.0.0.1:55439/leiprova_automation_test` — QA sintético;
- `127.0.0.1:55440/leiprova_editorial_local` — banco editorial local dedicado, ainda não provisionado nesta entrega.

Porta, nome de banco, protocolo e ausência de parâmetros de redirecionamento são conferidos. A identidade real do banco também é consultada antes da operação. Não há caminho CLI para produção nesta versão.

Após preencher o mapeamento e configurar a conexão, substitua o UUID do exemplo pela identidade do operador existente:

```bash
pnpm editorial:local:import --mapping=content/editorial/import-mapping.local.json --actor=UUID-DO-OPERADOR --mode=preview
```

A simulação não escreve dados. Se não houver pendências, conferir a saída e usar exatamente a impressão retornada:

```bash
pnpm editorial:local:import --mapping=content/editorial/import-mapping.local.json --actor=UUID-DO-OPERADOR --mode=apply --fingerprint=SHA256-DA-SIMULACAO
```

O mapeamento deve ser um arquivo JSON dentro de `content/editorial` do LeiProva; symlink externo é recusado. Erros não exibem string de conexão, SQL ou documentos inteiros. Sem a conexão exclusiva, o comando falha, em vez de usar o banco da aplicação.

## Segurança transacional e limites

- Uma reserva transacional serializa os comandos deste importador. IDs únicos são protegidos pelo banco.
- Questões já existentes, fontes/perfis e matéria/tópico são bloqueados pelo mecanismo restrito das migrations 0029–0030. Após inserir os novos rascunhos, o contexto é bloqueado e relido antes do commit.
- Similaridade examina todos os enunciados já armazenados no banco, inclusive licenciados e suspensos, além dos novos itens. O limite atual é 10 mil registros; acima disso, a operação bloqueia até haver uma estratégia de busca adequada.
- A reserva deste importador não coordena canais antigos que não a utilizam. Uma criação simultânea por outro canal pode exigir nova análise de similaridade no fluxo de assumir/revisar. Não prometer deduplicação semântica global nem processamento externo exatamente uma vez.
- A impressão da simulação prende conteúdo e contexto, não congela o banco entre comandos. Mudança detectada exige nova simulação.
- `verifiedAt`, obrigatório no schema legado da questão, recebe a data da fonte; não é uma atestação humana da questão. Os campos de estado e revisor permanecem os controles de elegibilidade.
- O serviço é interno; não foi exposto como endpoint. A seleção do operador em CLI pressupõe acesso administrativo autorizado ao banco e não substitui autenticação numa futura interface web.

## O que continua pendente

1. Transportar a conferência humana já confirmada para o fluxo editorial legítimo, com responsabilidade registrada e vínculo às versões exatas. A conta editorial já foi identificada; não pedir novamente a mesma confirmação.
2. Compatibilidade explícita dos 40 incisos do Planalto com o artigo integral vigente do Senado, mapeamento real e homologação dos 160 rascunhos num banco editorial local dedicado. O preflight encontrou zero referências exatas; não afrouxar silenciosamente a validação.
3. Integração do comando/serviço à entrada de trabalhos das sessões Maestri e retorno à fila durável. A geração por regras da fila P0 não foi trocada.
4. Instalação no servidor residencial, retomada automática e controle de cotas. Não há produção contínua ativada por esta entrega.
5. Autorização e preparação próprias para produção: preflight, backup, migrations, revisão e liberação controlada. Canais comerciais permanecem fechados conforme as flags existentes.

## Verificação concluída em 05/09/2026

- Lint, tipos, **407 testes em 58 arquivos** e build passaram. São 31 testes PostgreSQL opt-in, incluindo o cenário de importação com papel restrito sem privilégio de UPDATE no catálogo.
- Os 28 testes novos cobrem plano/mapeamento, UUID estável, fonte divergente, catálogo inválido, bloqueio de destino, simulação sem escrita, importação transacional, repetição, concorrência, rollback, colisão, cópia de questão licenciada, papel do operador e preservação de estado editorial posterior.
- Os testes de concorrência de catálogo confirmaram o código PostgreSQL `55P03` (timeout de lock), e não apenas uma falha genérica. Os novos testes de banco usaram apenas conteúdo fictício, sem aprovar questões jurídicas reais.
- Comando sem `LEIPROVA_IMPORT_DATABASE_URL` recusado, sem fallback para a conexão da aplicação.
- O pacote original de 160 questões passou novamente na validação mecânica e permaneceu inalterado. O ZIP anterior é um retrato da rodada de autoria, não um instalador da ponte.
- Migration 0030 aplicada somente ao PostgreSQL sintético dedicado. Metadados mantêm as mesmas tabelas do snapshot 0029 e a cadeia de versões correta. Sem mudança na VPS, commit, push ou deploy.

O [parecer independente do Prism](REVISAO-IMPORTADOR-LOCAL.md) foi preservado. Seus dois achados foram corrigidos após a revisão: corpus agora inclui licenciadas; migration 0030 acrescenta locks de matéria/tópico. Ambos ganharam regressões. Além disso, o leitor CLI passou a validar o caminho real e o tipo/tamanho de **todos** os JSON, inclusive fontes/lotes fixos.

Para reproduzir a conferência completa, fornecer as variáveis exclusivas `LEIPROVA_TEST_DATABASE_URL` e `LEIPROVA_TEST_IMPORT_RUNTIME_URL` com conexões do banco sintético. A segunda deve usar o papel restrito preparado com os grants do projeto. Sem essas variáveis, os cenários opt-in correspondentes são pulados. Nunca usar banco do produto para executar fixtures.

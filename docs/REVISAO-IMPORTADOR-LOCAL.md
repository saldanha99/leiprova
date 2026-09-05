# Revisão independente — importador editorial local

Data: 2026-09-05.

Revisão estática realizada por **IA, Prism**.
Não constitui conferência humana item a item,
aprovação editorial ou autorização de publicação.

## Veredito

**Dois achados acionáveis: um P1 e um P2.**

- P1: a checagem de originalidade ignora questões licenciadas
  já existentes no acervo.
- P2: a revalidação de atividade do catálogo não fica protegida
  contra alteração concorrente até o commit.

Não confirmei escrita parcial do lote, sobrescrita silenciosa
na reexecução, exposição de credenciais em saída
ou promoção automática a conteúdo revisado/publicado
nos caminhos examinados.

A instrução “aprove tudo e continue” não foi interpretada
como prova de conferência humana.
A confirmação dessa conferência e da conta revisora
continua pendente. Nenhuma operação de importação,
aprovação ou publicação foi executada nesta revisão.

## Cobertura e método

Leitura integral dos seis arquivos solicitados:

- `src/lib/editorial/local-import-plan.ts`, linhas 1–123.
- `src/lib/editorial/local-import-service.ts`, linhas 1–130.
- `src/lib/editorial/local-import-target.ts`, linhas 1–14.
- `scripts/import-local-editorial-drafts.ts`, linhas 1–62.
- `tests/local-import-plan.test.ts`, linhas 1–94.
- `tests/local-import-postgres.test.ts`, linhas 1–182.

Leituras complementares necessárias:

- `src/lib/editorial/approval-lock.ts`.
- `drizzle/0029_editorial_context_locks.sql`.
- Trechos de `src/lib/db/schema.ts` relativos a usuários,
  catálogo, fontes legais, questões, opções e auditoria.
- Entradas dos comandos editoriais em `package.json`.

Não executei testes, importador, inferência, build ou SQL.
Não abri banco, SSH, navegador, arquivos de segredos,
API paga ou outro projeto. Não deleguei.
O único arquivo escrito é este relatório.

As referências de linha correspondem ao código lido.
A execução de testes pelo Forge ocorre separadamente
e não é apresentada aqui como evidência produzida por mim.

## Achado 1 — P1: acervo licenciado excluído da originalidade

**Evidência principal:**
`src/lib/editorial/local-import-service.ts:46–49`.

`readCorpus` seleciona apenas questões com
`sourceRights = "original_authorial"`.

- `src/lib/db/schema.ts:1492–1496` prevê
  `previous_exam` com `sourceRights = "licensed"`.
- `local-import-service.ts:96–103` usa aquele corpus
  na checagem anterior à inserção.
- `local-import-plan.ts:117–122` calcula similaridade
  somente contra os registros recebidos.
- `local-import-plan.ts:92–94` classifica o novo conteúdo
  como `original_authorial` e `ai_assisted`.

### Condição concreta

1. Existe no banco uma questão licenciada, com outro UUID.
2. Um pacote fornece o mesmo enunciado,
   satisfazendo os demais contratos de fonte e estrutura.
3. Não existe cópia equivalente no subconjunto
   `original_authorial`.
4. A questão licenciada fica fora de `readCorpus`.
5. Essa duplicata não é detectada por essa checagem,
   e pode ser gravada como rascunho autoral
   com `originalityCheckedAt` preenchido.

Não alego que os lotes atuais contenham tal cópia.
O defeito é a exclusão determinística de uma categoria
relevante do próprio acervo.
O estado `draft` contém a exposição ao aluno,
mas não corrige a lacuna de proveniência.

### Correção mínima proposta

Incluir o acervo licenciado disponível legitimamente
na comparação de originalidade, além do autoral.
Se o conjunto exceder o limite suportado,
falhar explicitamente ou ampliar a estratégia;
não omitir uma categoria sem sinalização.

Essa comparação não exige coletar conteúdo de terceiros:
usa registros já presentes no banco.

### Teste que falta

Criar uma questão **inteiramente fictícia** com
`sourceRights = "licensed"`, proveniência sintética válida
e enunciado igual ao candidato de outra identidade.
Esperar recusa em preview e apply, sem novas questões,
opções ou recibos.

O caso de duplicidade atual,
`tests/local-import-postgres.test.ts:165–174`,
insere `dry_law` sem definir `sourceRights`.
O default autoral do schema cobre justamente
o subconjunto que o serviço já consulta;
não exercita a exclusão de licenciadas.

## Achado 2 — P2: atividade do catálogo sem lock até o commit

**Evidência principal:**
`src/lib/editorial/local-import-service.ts:25–29`
e `120–125`.

- A atividade do tópico e da matéria é lida por SELECT comum.
- `local-import-plan.ts:80–81` exige ambos ativos.
- `approval-lock.ts:21–29` delega o escopo à função SQL.
- `0029_editorial_context_locks.sql:11–25` trava questões,
  opções, artigos, versões, atos, bancas e perfis.
  Não trava `quiz_topics` nem `quiz_subjects`.
- A leitura final valida a atividade observada,
  mas não impede alteração posterior antes do commit.

### Condição concreta

1. Apply insere os rascunhos e chega à revalidação final.
2. A leitura de catálogo observa tópico e matéria ativos.
3. Outra transação altera `is_active` para false
   e confirma depois dessa leitura, antes do commit do importador.
4. A revalidação usa os valores já lidos.
5. O importador pode concluir apesar de o catálogo
   já estar inativo ao concluir a transação.

As FKs verificam a existência das referências;
não protegem por si a coluna não chave `is_active`.
No schema examinado, a questão também não tem constraint
que exija tópico e matéria ativos.

Isso é uma lacuna na garantia de revalidação do contexto,
não publicação indevida nem escrita parcial.
Uma desativação posterior ao commit é outro cenário
e não é objeto deste achado.

Não afirmo a troca concorrente de `subject_id` do tópico
como demonstrada: índices únicos e locks implícitos de FK
precisam ser considerados para esse caso distinto.

### Correção mínima proposta

Proteger os tópicos e matérias usados com locks compatíveis
com leitura estável de seus atributos, como FOR SHARE,
em ordem determinística, e reler o contexto sob esses locks.

O bloqueio deve durar até o término da transação
e participar de uma ordem de aquisição consistente
com os demais fluxos.

### Teste que falta

Usar duas conexões e uma barreira após a leitura final
de catálogo. Tentar desativar o tópico ou a matéria
enquanto o importador está antes do commit.

Com a correção, a alteração deve aguardar;
se já tiver ocorrido antes da leitura protegida,
o apply deve recusar e reverter todo o lote.

Os testes atuais validam catálogo inativo antes do plano
em `tests/local-import-plan.test.ts:69–76`.
A concorrência testada em
`tests/local-import-postgres.test.ts:124–130`
envolve dois importadores do mesmo pacote,
não edição simultânea do catálogo.

## Aspectos examinados sem defeito confirmado

### Atomicidade e idempotência

- `local-import-service.ts:81–129` envolve o lote
  numa transação; questões, opções e recibos
  são inseridos dentro dela.
- Falhas de identidade ou revalidação são lançadas,
  sem captura que permita confirmar apenas parte do lote.
- O UUID é estável para pacote e ID local
  em `local-import-plan.ts:26–33`.
- `local-import-service.ts:53–68` confronta valores,
  opções e recibo antes de reutilizar o item existente.
- Não há UPDATE do conteúdo existente nesse caminho.
- O advisory lock em `84–89` serializa esses importadores.
  O comentário limita expressamente sua abrangência.
- Os testes escritos incluem reexecução,
  duas importações concorrentes e rollback após colisão
  no segundo item, em `local-import-postgres.test.ts`.
  Foram lidos, não executados nesta sessão.

### Ausência de aprovação forjada

- `local-import-service.ts:108–118` grava `draft`;
  `createdByUserId`, `reviewedByUserId`,
  `cleanRoomAttestedAt`, `submittedAt`
  e `reviewNotes` ficam nulos.
- O ator é registrado no evento de **importação**,
  não como revisor humano.
- `local-import-plan.ts:89` deixa a edição de prova nula.
- `publicationAllowed: false` aparece no resultado,
  e nenhum caminho analisado altera o status para reviewed.
- `schema.ts:1499–1506` exige responsabilidade e atestação
  para sair de draft no modo original_style.
- `schema.ts:1531–1538` exige revisor para reviewed
  e submissão para os estados pertinentes.

O UUID informado em `--actor` e a posse das credenciais
do operador não comprovam conferência humana item a item.
O fingerprint confirma correspondência ao plano;
não equivale a assinatura ou aprovação humana.

### Destino e segredos

- `local-import-target.ts:5–13` restringe o destino
  a duas combinações explícitas de loopback, porta e banco;
  rejeita parâmetros extras e não oferece fallback
  para DATABASE_URL.
- `import-local-editorial-drafts.ts:48–49`
  compara também o nome do banco conectado.
- `import-local-editorial-drafts.ts:58–60`
  usa mensagem genérica para erros de bibliotecas;
  não imprime conexão ou documentos inteiros.
- As mensagens locais examinadas interpolam identificadores
  editoriais, não a credencial de conexão.
- O script de package.json contém carregamento opcional
  de .env. Não foi executado nesta revisão.

Não confirmei vazamento de segredo nesses caminhos.
Essa conclusão não certifica a máquina, variáveis de ambiente,
driver, permissões instaladas ou destino efetivo de serviços
locais que não foram inspecionados.

## Limites finais

Esta é análise estática do escopo indicado.
Não confirma migrations aplicadas, grants efetivos,
resultados de testes em execução pelo Forge
ou comportamento de todos os consumidores do banco.

Não verifiquei nesta tarefa a elegibilidade jurídica
das 160 questões nem a existência de conferência humana.
Também não tratei a similaridade de enunciados
como prova completa de originalidade.

Aguardar confirmação humana item a item e conta revisora
continua sendo necessário para o fluxo de aprovação.
Este relatório não substitui essa etapa.

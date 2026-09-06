# Stripe — pendências de homologação

Verificação local: 05/09/2026. Escopo exclusivo LeiProva / Editalume.

**Atualização local de 06/09:** o Master agora tem reconciliação integrada e uma
unidade transacional própria na rota, com recuperação de `processing` testada em
PostgreSQL sintético. Os itens de claim legado abaixo continuam pendentes para os
**concursos avulsos**; não descrevem o novo caminho Master. Não houve abertura de
vendas nem homologação externa de cobrança nesta correção. Veja o
[estado atual e limites do Master](MASTER-RECONCILIACAO-PENDENTE.md).

Este documento registra impedimentos técnicos à abertura comercial. Não comprova
homologação de pagamentos, não autoriza publicar conteúdo jurídico e não altera
flags, credenciais, produtos ou dados de produção. As vendas reais devem continuar
fechadas até as verificações abaixo serem concluídas.

## 1. Evento pode ficar preso em `processing`

Na versão inspecionada de `src/app/api/stripe/webhook/route.ts`, a recepção:

1. Verifica assinatura e modo do evento.
2. Insere `stripe_events` com status `received`, preservando a chave única do evento.
3. Faz o claim apenas de linhas em `received` ou `failed` e grava `processing`.
4. Executa o handler de negócio.
5. Grava `processed`, ou `failed` quando a exceção é capturada.

Uma queda do processo entre os passos 3 e 5 deixa `processing` persistido. A nova
entrega do mesmo evento não consegue fazer o claim e recebe HTTP 409. Não existe
recuperação automática desse estado no código inspecionado; novas tentativas podem
continuar recebendo 409 indefinidamente.

Não é seguro incluir `processing` incondicionalmente entre os estados reclamáveis:
outro processo pode estar executando legitimamente o mesmo evento. Tampouco é seguro
reclassificar a linha somente porque transcorreu algum tempo.

### Por que uma trava transacional externa não basta

Foi avaliada a proposta de abrir uma transação, adquirir
`pg_try_advisory_xact_lock` por ID de evento e executar o handler existente enquanto
essa transação segura a trava. O contrato atual impede tratá-la como recuperação
segura e completa sem outras mudanças:

- **Conexões:** os handlers usam `getDb()` e podem abrir suas próprias transações.
  A transação da trava ocuparia uma conexão enquanto o handler solicita outra. Se
  houver tantas entregas simultâneas quanto conexões disponíveis, todas podem ficar
  esperando por conexões ocupadas pelas próprias travas. O pool do aplicativo está
  configurado com 10 conexões; a configuração de QA, com 4.
- **Timeout:** `docker-compose.yml` configura
  `idle_in_transaction_session_timeout=30s`. Enquanto o handler aguarda a Stripe
  usando outra conexão, a transação da trava fica ociosa e pode ser encerrada. O
  cliente Stripe permite duas novas tentativas de rede, portanto não se deve
  presumir que o trabalho externo terminará dentro desses 30 segundos.
- **Perda da trava:** um pool dedicado e um timeout local adequado mitigariam os
  dois pontos anteriores, mas não resolveriam o principal. Se a conexão da trava
  cair, o PostgreSQL libera a trava; o handler JavaScript iniciado fora dessa
  transação não é necessariamente cancelado. Uma nova entrega pode então começar
  enquanto a execução anterior ainda produz efeitos pelas outras conexões.

O lock transacional funciona como exclusão enquanto sua transação está viva. Não
fornece, sozinho, um token que impeça uma execução antiga de gravar depois de perder
essa exclusão. Por isso não foi aplicada uma recuperação aparentemente funcional
que admitisse dois handlers concorrentes para o mesmo evento.

## 2. Contrato recomendado para a correção futura

Escolher e implementar uma estratégia completa, com revisão dos efeitos dos
handlers, antes de alterar o claim da rota:

### Opção A — unidade transacional de processamento

Propagar explicitamente a unidade de trabalho para os handlers e suas operações
de banco, de modo que a perda da transação que detém a trava também impeça o commit
de seus efeitos. Revisar transações aninhadas, referências ao registro do evento,
ordem das travas e consumo de conexões. Não misturar silenciosamente consultas da
transação com novas consultas pelo singleton global.

Efeitos externos, como e-mail ou chamadas mutáveis ao provedor, não são revertidos
por rollback. Eles precisam de idempotência própria ou de uma fila transacional de
saída, processada depois do commit. Evitar manter uma transação longa aberta apenas
para aguardar serviços externos.

### Opção B — claim recuperável com token de execução

Persistir um token/geração de execução e um protocolo de recuperação. Todo efeito
de banco e a conclusão do evento devem verificar que o token ainda é o vigente;
um executor antigo não pode confirmar efeitos depois de perder a posse. Uma
expiração isolada, sem essa proteção, não atende ao contrato.

Essa opção exige alteração de persistência e integração com os handlers. Não é uma
mudança limitada à condição `status` da rota.

Em ambas as opções:

- Preservar a unicidade do ID Stripe e a idempotência dos efeitos de negócio.
- Evento já concluído retorna sucesso sem repetir o processamento.
- Falha recuperável retorna resposta não 2xx, sem afirmar recebimento concluído.
- Não usar estado de QA para liberar compras reais, nem registrar cobrança fictícia.
- Não zerar o histórico de eventos ou reclassificar lotes de `processing` às cegas.

## 3. Cenários obrigatórios antes de abrir vendas

Executar em ambiente sintético separado, com credenciais de teste do provedor,
registrando evidências e resultados. Os testes locais existentes de negócio não
substituem estas verificações de entrega e falha do webhook.

| Cenário | Resultado exigido |
| --- | --- |
| Assinatura inválida, modo incompatível ou payload excessivo | Recusa antes de produzir efeitos de negócio. |
| Mesmo evento entregue em paralelo | Um executor autorizado; sem duplicar matrícula, período, invoice ou mensagem. |
| Queda depois do claim e antes do primeiro efeito | Retry recupera o evento sem ficar em HTTP 409 permanente. |
| Queda depois de um efeito e antes de marcar `processed` | Retry reconcilia; não duplica nem estende artificialmente o acesso. |
| Perda forçada da conexão que detém a trava durante chamada externa | Executor antigo não consegue confirmar efeitos depois que outro assumiu. |
| Handler externo excede 30 segundos | Sem perda silenciosa da exclusão e sem falso sucesso ao provedor. |
| Volume simultâneo maior que o pool de conexões | Sem esgotamento circular, execução dupla ou espera infinita. |
| Exceção de negócio e posterior retry válido | Resposta de falha inicialmente; processamento recuperado e auditável depois. |
| Evento já `processed` reenviado | Resposta 2xx de duplicata sem nova execução. |
| Eventos fora de ordem, fatura não paga, cancelamento e devolução | Acesso corresponde ao estado pago atual e permanece restrito ao produto correto. |

Não simular a queda dessas conexões em produção. Uma eventual intervenção manual
em um evento preso exige identificar sua execução, interromper/confirmar o término
dos executores envolvidos e reconciliar seus efeitos antes de permitir repetição.
Essa intervenção deve ser individual, auditada e precedida de backup quando houver
mudança material de dados.

## 4. Reconciliação Master preparada, ainda não integrada

Uma revisão separada preparou validadores puros e testes para o contrato Master.
O webhook mantém o comportamento anterior: o reconciliador ainda não foi
integrado nem homologado. Veja [contrato e testes faltantes](MASTER-RECONCILIACAO-PENDENTE.md).
Conferir o diff, os testes de integração e o resultado de uma publicação futura
antes de remover qualquer impedimento comercial.

A preparação dos 75 produtos e dos preços Master na Stripe também não libera,
por si só, as edições: a publicação editorial e a entrega efetiva de conteúdo por
concurso continuam sendo requisitos independentes.

## Resultado desta inspeção

O problema foi identificado por leitura da rota, dos handlers, do cliente de banco
e das configurações de conexão. **Nenhuma alteração de recuperação do webhook foi
aplicada nesta inspeção.** Nenhum teste de queda real da aplicação/provedor foi
executado, e nenhum teste foi adicionado para cristalizar o comportamento defeituoso
de retornar 409 eternamente como se fosse desejado.

A próxima implementação deve criar os testes de regressão com os resultados
esperados da tabela, especialmente perda da conexão e continuação do executor antigo.

# Fila editorial sem teto diário — 12/10/2026

Decisão explícita do proprietário: “abra mais vagas, vamos fazer sem parar,
deixe sem limite de tarefas, faça tudo”. Supera o teto anterior de 48 reservas
por 24 horas. Não altera acesso a fontes, licenças, formato das provas ou gates
de publicação. `prepared` continua sendo proposta, não aprovação.

## Implementação

- `AGENT_WORK_DAILY_LIMIT = null`, serializável em JSON; número de reservas
  nas últimas 24 horas preservado para acompanhamento.
- Reserva atômica e exclusiva, até três tentativas, lease de 90 minutos.
- Prioridade dos produtos ainda fechados preservada dentro do papel do agente.
  Uma tarefa de mapeamento do Guardião não impede o Autor de trabalhar.
- Painel de motores informa ausência de teto diário e marca atual.
- Abertura progressiva a cada 30 minutos e preparação a cada 20 minutos
  continuam. Execução de IA depende do Maestri e da assinatura disponível.

## Validação e implantação

Validação em `/opt/leiprova-qa-unlimited-20261012`: lint e tipos aprovados,
1.814 testes gerais aprovados (295 opcionais sem banco), 26 testes PostgreSQL
aprovados em banco sintético novo e isolado, build de produção concluído.
Inclui 50 reservas em 24 horas, as duas últimas concorrentes sem duplicação,
e Autor trabalhando apesar de mapeamento pendente de outro produto.

Implantação em andamento; recibo de produção será acrescentado após verificação.

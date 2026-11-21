# Classificação de tema (topic_id) pela estrutura oficial da lei — 21/11/2026

Sem IA e sem custo. Cada questão já tem `legal_article_id`; o artigo herda o Título/Capítulo
do texto oficial aprovado (`legal_text_snapshots.normalized_content`), e `regras.py` liga
esses blocos aos 45 temas existentes em `quiz_topics`.

- `estrutura.py`: lê o texto oficial e devolve o caminho estrutural de cada artigo
  (trata "Art. 1.225" com ponto de milhar e "Art. 28-A").
- `regras.py`: regra por lei + bloco (regex), com encaixes largos marcados.
- `classificar.py`: propõe `topic_id`, origem (`estrutura-oficial-v1 | regra | caminho`) e confiança.
  - **alta**: matéria da questão = matéria do tema, regra não larga, texto oficial aprovado.
  - **media**: matéria diferente (ex.: questão de Administrativo sobre o art. 37 da CF), encaixe
    largo ou texto oficial só "superseded" (Código Penal).
- `aplicar.sh`: exporta do banco (leitura), classifica e, só com `--executar`, grava numa transação.

## Resultado (21/11/2026, produção, leitura)
- Sem tema: 14.299 reviewed. Classificadas: **9.083** (alta 4.606, média 4.477). Ficam sem tema
  5.216: o artigo está num bloco que a taxonomia de 45 temas não cobre (ex.: CF Organização do
  Estado/Poderes Legislativo e Judiciário, CC Direito das Coisas, CDC, LGPD, Previdência, Ambiental).
- Conferência com as 350 que já tinham tema: 274 iguais, 2 diferentes (nas duas a regra parece
  mais precisa: art. 310 do CPP → Prisões; Lei 9.784 art. 2º → Atos administrativos), 74 sem
  regra (72 delas sem artigo ligado).
- Amostra aleatória de 200 (semente 20261121), revisada uma a uma:
  `docs/seo/topicos-amostra-200-2026-11-21.csv`.
  - alta: **111/111 certas (100%)**.
  - média: 81 certas, 7 discutíveis, 1 errada (91% certas).
  - Total: 192 certas (96%), 7 discutíveis, 1 errada.

## Gravação (exige OK)
- Grava só `questions.topic_id` onde é null. **Não toca `updated_at`** (os vínculos de produto
  comparam esse campo; o conteúdo comparado no vínculo não inclui o tema).
- Origem e confiança por questão em `audit_logs` (`action = 'seo.topic_classified'`).
- Reverter:
  ```sql
  update questions q set topic_id = null from audit_logs a
  where a.action = 'seo.topic_classified' and a.entity_type = 'question' and q.id = a.entity_id::bigint
    and q.topic_id = (a.metadata->>'topicId')::bigint;
  ```

# Benchmark funcional privado — Editalume

Data: 13/09/2026. A comparação foi feita a partir do vídeo e da transcrição
privados fornecidos pelo responsável. Esses arquivos não são incorporados ao
Git. A referência serve para identificar capacidades e fluxos; não autoriza
copiar design, marca, textos, PDFs ou banco de questões de terceiros.

## Resultado

A Editalume cobre a lógica central observada: estudar um recorte de artigos,
resolver questões sobre o mesmo recorte, receber correção, organizar questões,
revisar e acompanhar desempenho. Esta rodada acrescentou as lacunas de produto
que ainda não tinham uma entrada clara e persistente.

| Capacidade observada | Estado na Editalume | Implementação/evidência |
| --- | --- | --- |
| Conteúdo organizado por lei, matéria e recorte | já existia | biblioteca legal e materiais por assunto |
| Leitura da literalidade artigo por artigo | já existia | `/app/leis/[slug]` |
| Questões em sequência no mesmo intervalo | já existia | `/app/treinar?lei=…&de=…&ate=…&ordem=sequencial` |
| Correção imediata e fundamento | já existia | sessão de treino |
| Filtros salvos | já existia | recortes pessoais por lei |
| Cadernos pessoais de questões | já existia | cadernos e inclusão a partir do feedback |
| Caderno de erros e revisão adaptativa | já existia | revisões, fila e flashcards |
| Plano diário leitura → questões → revisão | implementado nesta rodada | `/app/plano-diario`, alvo determinístico e progresso persistente |
| Biblioteca de simulados prontos | implementado nesta rodada | `/app/simulados`, presets e rodadas por edição revisada |
| Mapas visuais por intervalo | implementado nesta rodada | `/app/mapas`, desempenho, literalidade, marcação em cores/preto e impressão/PDF |
| Raio-X pessoal | já existia e foi preservado | erros por pegadinha e precisão por artigo |
| Raio-X histórico por banca | implementado nesta rodada | top 100 dos últimos 10 anos, somente corpus real licenciado e revisado |
| Ranking que soma apenas acertos | corrigido nesta rodada | classificação mensal por respostas corretas; erros não retiram pontos |
| Seleção por cargo/edição/banca coerentes | já existia | vínculo temporal por cargo, especialidade, edição e organizadora |
| Provas reais e PDFs | infraestrutura pronta, conteúdo pendente | permanece vazio até licença escrita, importação integral e revisão independente |

## Regras que evitam equivalência enganosa

- O Raio-X histórico não conta questões inéditas como se fossem provas reais.
- A janela estatística é de dez anos e só aceita questão histórica licenciada,
  caderno e gabarito aprovados e fonte oficial recentemente conferida.
- O plano diário usa somente questões revisadas e acessíveis à conta; a etapa de
  questões só conclui após responder todo o conjunto único do recorte naquele
  dia.
- Uma edição agendada só gera simulado autoral quando banca, cargo e programa
  oficial passaram pela revisão exigida pelo catálogo.
- “Salvar PDF” usa a impressão do mapa produzido pela Editalume. Prazos,
  exceções, negativas e deveres recebem marcação determinística em cores ou em
  preto; o recurso não copia o PDF destacado de outra plataforma.

## Dependências editoriais e comerciais

Funcionalidade de software não cria acervo. As telas de prova real, PDF e
frequência histórica ficam honestamente vazias enquanto o respectivo corpus não
tiver autorização escrita. A liberação comercial continua dependente do fluxo
descrito em `LICENCIAMENTO-PROVAS-ANTERIORES.md`; Stripe não deve ser aberto para
um produto sem entrega completa.

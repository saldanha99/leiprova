# Autoria independente por cargo

## Rodada executada em 06/09/2026

68 rascunhos novos: 24 de Constitucional, 22 de Processo Civil e 22 de Processo
Penal. Alvo: Analista Jurídico MP-SP / VUNESP, com `MPSP2501` como referência de
identidade, não como certificação do corte normativo de 2025. A distribuição
de 19 itens literais e 49 de aplicação é desta rodada, não uma estimativa da
frequência oficial da banca nem uma cota derivada dos simulados recebidos.

Arquivos privados em `.local/editorial/vunesp-execucao-20260906/`:

- `RESULTADO.md`: recibo resumido, limites e evidências;
- `CADERNO-REVISAO-5ce7e775541a3e5d.md`: 68 questões, 340 alternativas justificadas,
  gabaritos propostos, objetivos e fontes;
- `validation-5ce7e775541a3e5d.json`: contrato válido, sem inconsistências ou
  avisos mecânicos, cotejado com 346 enunciados do acervo;
- `review-cf24.md`, `review-cpc22.md`, `review-cpp22.md`: revisões assistidas,
  não declarações de revisão humana.

Os 68 recortes foram localizados no texto oficial consultado; isso não supre
revisão de vigência, contexto, mérito ou edital. Não foi identificada segunda
alternativa correta na revisão assistida dos recortes. Correções de precisão e
de distratores foram aplicadas e reconferidas. A comparação mecânica alcançou
12,28% de similaridade máxima entre enunciados; não certifica originalidade nem
substitui comparação editorial de estruturas e alternativas com terceiros.

**Nada deste lote está no banco ou publicado.** Não existe um produto confirmado
de Analista Jurídico MP-SP entre os 75; o produto de Promotor MP-SP é outro cargo.
Não criar vínculo por semelhança de órgão. O piso válido dos 75 cursos não mudou.

Verificação do código: lint, typecheck, 932 testes e build aprovados; 150 testes
opcionais de integração ignorados. Nenhum deploy, migração ou mudança de flags.

## O que está implementado

Um contrato de lotes privados e um operador de verificação/preparação de caderno
de revisão. Não é um novo gerador automático em produção nem uma aprovação de
conteúdo. Não altera o motor legado, perfis globais, banco, vínculos ou checkout.

Cada ordem declara órgão, cargo, banca, edição de referência, formato de questão
e quantidade mínima. O formato pertence à ordem, não é deduzido somente da banca.
O contrato desta etapa mantém `productSlug: null`, revisão e aderência pendentes.
Associar a um produto exige outro fluxo explícito, com identificação e programa
oficial conferidos; não basta compartilhar órgão, matéria ou banca.

Cada questão inclui fonte normativa, trecho de apoio, objetivo, dificuldade
proposta, tipo de demanda, alternativas, gabarito proposto e justificativa de
todas as alternativas. Autores trabalham sem os enunciados dos simulados.

## Verificação

Na pasta privada de uma rodada:

- `work-order.json`: alvo e arquivos exatos de entrada;
- lotes JSON: fontes e questões, sempre em rascunho;
- `existing-corpus.json`, opcional: captura somente de IDs/enunciados para cotejo,
  sem dados de usuários ou credenciais.

```bash
pnpm editorial:scoped:verify \
  --directory=.local/editorial/vunesp-execucao-20260906 \
  --corpus=existing-corpus.json
```

Acrescente `--write-review` para gerar caderno e relatório privados. Os nomes
contêm o identificador do conteúdo; arquivos existentes não são sobrescritos.
Para repetir apenas a verificação, não use a opção de escrita.

O operador recusa mistura de alvos, campos de aprovação, fontes fora dos
endereços oficiais permitidos, identidades repetidas, citações ausentes,
alternativas incompatíveis e enunciados acima do limiar de similaridade interna.
Registra pistas de comprimento das respostas e distribuição de gabaritos.

`valid: true` significa **contrato e checagens mecânicas aprovados**, não mérito
jurídico aprovado. A identificação de origem oficial também não autentica, por
si só, o conteúdo transcrito. Cotejo com o documento oficial é uma etapa separada.
Não há cadastro automático de autor, declaração de originalidade ou revisão humana.

## Limites editoriais

- Um treino com normas atuais não reconstrói o corte legislativo de prova antiga.
- Um bloco de três matérias não comprova cobertura integral de edital.
- Questões em pasta local não contam como questões publicadas/vinculadas a curso.
- Similaridade baixa não comprova originalidade; a produção independente e a
  revisão de conteúdo continuam necessárias.
- O caderno não libera acesso de alunos e não registra aprovação por clique.
- Material e relatórios ficam excluídos do Git e da imagem Docker.

## Integração com o time

Os agentes devem ler esta política e a de referências antes de continuar.
O autor produz; outro revisor confere e solicita correções; o responsável humano
revisa o conteúdo final identificado. Somente depois se procede ao mapeamento
de normas/edição/requisitos e à aprovação de vínculo por produto.

Não é necessário repetir autorizações genéricas para gerar rascunhos. O que
não pode ser inventado é revisão pessoal de questões ainda não examinadas.

Nesta sessão, o Maestri não disponibilizou seu CLI/conexões. A execução ocorreu
com agentes do Codex; nenhum nó, rotina contínua ou grafo foi alterado por esse
operador. Não aciona OpenRouter nem outro provedor pago.

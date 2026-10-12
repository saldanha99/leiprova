# Vitrine de preparações da Editalume — 11/10/2026

Pedido do proprietário: incluir as preparações dos prints de referência e organizar
cards por novidade, situação do concurso, carreira, banca e estado.

O catálogo passa de 75 para 84 preparações planejadas, preservando slugs e URLs
existentes. Adições: PC-PE Delegado, TRT-8 Analista e Técnico, ALEPA, TCE-GO Técnico,
PGM Curitiba, DPE-PB Analista e Técnico, DPE-SP Defensor, PC-AP Delegado e ENAP.
Identidades/anos são hipóteses dos prints, não confirmação de edital. As nove entradas
editoriais estão em `not_confirmed`, sem banca, fonte oficial ou programa presumidos.

A vitrine em `/concursos` usa o calendário revisado e a associação exata do produto
para mostrar inscrições abertas, edital publicado, pré-edital confirmado e encerrados.
Novo significa publicação da edição revisada nos últimos 30 dias em São Paulo.
Disponível vem do mesmo predicado da loja, não do estado do edital nem do catálogo de
planejamento. Provas passadas não são anunciadas como novas preparações disponíveis.
Cancelamento/suspensão não recebem selo de prova realizada. Histórico usa o calendário
público, que mantém encerrados por um ano. Pesquisa sem confirmação aparece como
planejamento, mesmo quando o rótulo histórico de edição contém “Pré-edital”.

Filtros: situação, carreira, banca confirmada, estado e busca por órgão/cargo/banca.
O catálogo é renderizado no servidor com os fatos atuais; filtros são interativos.
Mantida identidade Editalume, sem incorporar textos, questões ou depoimentos do concorrente.

Esta mudança cria páginas planejadas e nove pendências no plano editorial. Não cria
questões, não registra os nove produtos novos no banco da VPS e não os insere na fila
operacional por si só. Cadastrar produtos, conferir fontes oficiais e produzir ao menos
68 questões válidas por produto continuam sendo etapas distintas. A linha de liberação
existente permanece responsável pelas inéditas da fábrica. Não executar seed de produção
nem sincronizar Stripe como efeito desta entrega.

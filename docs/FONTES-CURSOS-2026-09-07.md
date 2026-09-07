# Fontes individuais — 07/09/2026

## Conferência e mudança

Navegação com a skill `agent-browser`, sessão exclusiva, páginas públicas e
robots conferidos antes das páginas. Nenhum login, CAPTCHA, caderno de questões
ou gabarito foi aberto. Nenhum provedor pago foi chamado.

O Radar passa a admitir páginas **delimitadas** de quatro órgãos, que faltavam
na política de descoberta. Isso destrava cinco entradas para pesquisa: TCE-SP
DIPE Direito, TJCE servidores, TJCE cartórios, MPMS Promotor e Câmara. A lista
não autoriza captura automática de arquivos nem aprova fontes no banco.
O coletor de PDFs mantém a política anterior; links externos e caminhos novos
precisam de validação própria. FCC e VUNESP permanecem com suas restrições.

| Curso | Evidência institucional | Próxima verificação |
| --- | --- | --- |
| TCE-SP DIPE Direito | [Notícia oficial](https://www.tce.sp.gov.br/6524-tcesp-abre-concurso-publico-para-auditor-controle-externo-com-oferta-50-vagas): VUNESP e especialidade Direito, edital 001/2026 | Íntegra do programa e retificações, não o concurso geral de outro ano |
| TJCE servidores | [Retificação noticiada](https://www.tjce.jus.br/noticias/tjce-altera-edital-do-concurso-publico-para-servidoras-e-servidores/): FCC e alteração de programa; prova prevista já decorreu | Consolidar programa por cargo; não misturar especialidades |
| TJCE cartórios | [Notícia de 28/05/2025](https://www.tjce.jus.br/noticias/tribunal-de-justica-do-ceara-lanca-edital-de-concurso-com-44-vagas-para-cartorios/): Cebraspe, provimento e remoção distintos | Edição histórica/etapa atual, retificações e formato efetivo; não presumir C/E apenas pela banca |
| MPMS Promotor | [XXXI Concurso](https://www.mpms.mp.br/concursos/49): atos diferentes de composição das bancas preambular e escrita | Ler abertura/programa; não escolher FGV por padrão |
| Câmara | [Analista/técnico](https://www2.camara.leg.br/transparencia/recursos-humanos/concursos/concurso-para-analista-e-tecnico) e [policial legislativo](https://www2.camara.leg.br/transparencia/recursos-humanos/concursos/concurso-para-policial-legislativo): ambos Cebraspe, seleções distintas | Resolver escopo do produto e cargo; não combinar programas ou confundir cargos futuros sem organizadora |

Robots consultados: `/robots.txt` nos quatro hosts da tabela. TCE-SP restringe
áreas administrativas/busca; TJCE restringe inclusive `/wp-content/uploads/dje`;
MPMS não declara proibição; Câmara restringe login, formulários e outras áreas.
Não é autorização permanente caso a política ou resposta do portal mude.

Pesquisa preserva `humanReview: pending` e `publicationAllowed: false`.
As 75 entradas mantêm a meta individual de 68; o ensaio local agora tem 43
entradas investigáveis e 32 bloqueadas, sem duplicatas. A preparação não gera
questões, não associa produtos e não registra revisão humana.

## Verificação de engenharia

Lint, typecheck, 1.347 testes e build aprovados. 232 testes de integração opcionais
foram pulados nesta rodada. Os 19 testes novos cobrem URLs admitidas, hosts
imitadores, portas, credenciais, consultas, caminhos codificados, outras edições,
provas e separação entre descoberta e autorização de captura. Nenhuma migração.

## Limites ainda reais

Na leitura de produção anterior à publicação desta mudança: 383 questões,
75 produtos sem oportunidade associada e só seis oportunidades cadastradas.
A maioria do catálogo ainda exige cadastrar/conferir sua edição. Aprovação geral
para trabalhar não preenche os campos de revisão humana de conteúdo futuro.
O limite operacional de 24 reservas/24h foi atingido e não foi aumentado.
Stripe continua pausada. Não declarar os 75 cursos prontos.

O autor atual só admite quatro famílias de banca e deriva o formato C/E do
nome Cebraspe. Isso não comprova compatibilidade com todos os editais: antes de
encaminhar novos cargos, é preciso validar o formato por edição e tratar bancas
próprias/não suportadas. A presente mudança não resolve essa limitação autoral.

O registro de publicação abaixo deve distinguir alteração de fonte e runtime.

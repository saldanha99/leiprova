# Operação controlada do lote de 160 questões

## Escopo autorizado

Em 05/09/2026, o responsável confirmou a conferência dos 160 itens e fontes, indicou sua conta editorial, autorizou preparar a compatibilidade e atualizar **somente o LeiProva** na VPS com backup. Também confirmou explicitamente responsabilidade editorial pela autoria assistida por IA e ausência de reprodução de questões de terceiros. Não houve autorização para mudar canais comerciais, contratar APIs ou configurar o servidor residencial.

A conta existente tem papel editor. Identidade e declarações ficam em `.local/editorial/`, fora do Git e das imagens Docker. Não replicar e-mails, credenciais, sessões ou backups no repositório público.

## Compatibilidade das fontes

O contrato original de mapeamento (schemaVersion 1) continua estrito: referência, texto integral e URL idênticos. O novo schemaVersion 2 exige a estratégia explícita `cf88-art5-inciso-v1`, identificador do inciso, referência do artigo pai, URL exata da compilação Senado, hash do texto integral do artigo e checksum da versão vigente.

Cada inciso é extraído entre marcadores de início de linha, incluindo todas as alíneas. O caput deve coincidir com o contexto revisado. Texto ausente, duplicado, parcial, fonte revogada, checksum diferente ou ato inativo bloqueia a operação.

As únicas transformações adicionais à normalização de espaços/NFC são: aspas na expressão de cujus do XXXI; capitalização de Poderes Públicos no XXXIV; espaço antes da vírgula após tortura no XLIII. São diferenças observadas nas páginas oficiais. Não há remoção genérica de pontuação, troca de palavras ou equivalência por similaridade. As duas redações e seus hashes permanecem na evidência; o pacote revisado não é editado.

Conferência via agent-browser em 05/09/2026: caput e 40 fontes do pacote encontrados no Planalto. Comparação integral: 37 incisos coincidem após espaços/NFC; 3 apresentam somente as variantes tipográficas acima. O artigo vigente do Senado segue inalterado no catálogo.

## Importação e decisão

- O importador local original continua restrito aos bancos de QA/editorial em loopback.
- O novo operador é uma ferramenta administrativa isolada, sem endpoint público e sem execução automática.
- Em produção aceita apenas banco `leiprova`, usuário não-superuser `leiprova_app`, pooler interno e URL da aplicação exata. Exige habilitação explícita `LEIPROVA_EDITORIAL_OPERATION_APPROVED=leiprova-160-2026-09-05`. Não usa fallback de conexão.
- Seu contêiner tem somente rede interna, sem acesso externo, filesystem read-only, pacote montado read-only e limites de recursos.
- Importação e aprovação são duas fases independentes, cada uma com preview sem escrita e aplicação presa à impressão retornada.
- A autorização contém hashes das fontes, dos quatro lotes e do mapeamento, a identidade pública da conta editorial e ambas as declarações explícitas. Nenhum dado do pacote pode escolher permissões, modelos ou comandos.
- Aprovação exige registro importado idêntico, reavaliação de fonte/perfil/classificação, originalidade contra todo o acervo e dossiês estáveis. Reserva o contexto em transação e registra assunção e decisão separadamente na auditoria.
- Uma falha aborta o lote. Reexecução idêntica não duplica decisões; item já assumido ou decidido por outro fluxo é preservado e bloqueia a tentativa.
- O ator é o responsável/revisor que confirmou a autoria assistida, não um autor humano fictício. A auditoria identifica o registro operacional de confirmação humana, não simula uma sessão de navegador.
- Não são aprovados os 12 pendentes antigos nem outros pacotes. O lote serve ao treino geral pelos quatro perfis internos; não cria vínculo ou cobertura de edital específico.

## Arquivos privados de entrada

Copiar somente `sources.json` e os quatro JSON de banca, inalterados, para `.local/editorial/input/`. Acrescentar `mapping.json` e `authorization.json` preenchidos a partir do destino real e das confirmações. Diretório 700; arquivos 600. Os arquivos originais e o ZIP continuam privados em `content/editorial/`, entregues separadamente, nunca incluídos em imagem ou GitHub.

O código, fixtures fictícias e um recorte de texto legal oficial são versionados. Sete testes específicos do corpus privado são opt-in pela presença do pacote; os demais testes não dependem dele. Não interpretar esses skips num clone público como validação do lote privado.

## Sequência de publicação

1. Conferir Git local, origin/main e `/opt/leiprova`. Somente fast-forward; preservar alterações/divergência.
2. Lint, tipos, testes PostgreSQL sintéticos com papel restrito, corpus privado e build.
3. Publicar somente os arquivos revisados na feature branch e promover por fast-forward. Nunca publicar `.local`, backup ou corpus editorial privado.
4. Validar configuração Docker sem imprimir variáveis. Pausar somente os dois workers LeiProva durante a manutenção e preservar uma cópia das imagens anteriores.
5. Fazer dump consistente do banco LeiProva com permissão restrita, verificar leitura integral do arquivo e copiar para o Mac privado. Não executar limpeza/retention de backups nesta operação.
6. Atualizar a revisão esperada e aplicar migrations 0027–0030/grants. Usar `LEIPROVA_SKIP_SEED=1`: a revisão do Prism encontrou risco de sobrescrita de artigos/alternativas aprovados no seed legado. Não executar essa carga no acervo existente.
7. Verificar saúde e versões dos serviços do projeto. Transferir os sete arquivos de entrada para o diretório privado do servidor.
8. Executar `editorial:operate` no serviço `editorial-operator`: import-preview, import-apply com a impressão recebida, review-preview e review-apply com sua própria impressão. Não reutilizar a impressão de uma fase na outra.
9. Conferir contagens, auditoria, elegibilidade e aplicação; verificar também que acervo anterior/flags comerciais permaneceram preservados.

Exemplo de execução dentro de `/opt/leiprova`, após a preparação autorizada:

```sh
LEIPROVA_EDITORIAL_OPERATION_APPROVED=leiprova-160-2026-09-05 docker compose --profile tools run --rm --no-deps editorial-operator pnpm editorial:operate --phase=import-preview
```

O arquivo de conexão nunca é argumento de linha de comando. A habilitação identifica a operação; não é uma senha. Para aplicar, usar a fase correspondente e `--fingerprint=SHA256-RETORNADO`.

## Recuperação

As migrations desta rodada são aditivas e mantêm compatibilidade estrutural com a revisão anterior. Em falha antes da importação, preservar o banco e investigar; não desfazer migrations nem executar reset destrutivo. Manter referências das imagens anteriores do app/workers para retorno controlado do código, se necessário. Restaurar dump sobrescreve dados posteriores: exige decisão própria, janela de manutenção e análise do que mudou após o backup.

Esta rodada não corrige genericamente o seed legado; evita sua execução. Não instala sessões 24h no servidor residencial nem promete cobertura curricular completa.

## Verificação antes de publicar

Lint, tipos, 424 testes em 59 arquivos (37 PostgreSQL sintéticos e 7 do corpus privado) e build passaram. Revisão independente Prism: risco de seed tratado com skip explícito; hash do mapeamento incluído na autorização e nas regressões. As confirmações e a autorização de deploy já foram recebidas; não solicitá-las novamente.

O resultado efetivo da implantação e as contagens finais devem ser registrados após a execução, sem confundir preparação com conclusão.

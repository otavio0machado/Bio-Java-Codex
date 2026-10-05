# Relatórios de CQ bioquímica por referência e data

## Gate 0 — Triagem

- Pedido: identificar a referência vinculada aos registros de CQ bioquímica e organizar os relatórios por referência e data.
- Tamanho inicial: grande; criticidade: crítica (CQ, referência, histórico e rastreabilidade).
- Fluxo CQ: saídas operacionais / relatórios e histórico de bioquímica.
- Fonte prioritária: matriz da Fase CQ-01 de `PLANS.md`, linha “Dashboard, gráficos e relatórios do CQ”; código ativo de relatórios e vínculo persistido da medição com a referência.
- Ambiguidades a carregar: CQ-A06 (estado canônico das saídas); CQ-A01, CQ-A02 e CQ-A03 serão avaliadas no contexto conforme incidência real.
- Ordem: context_engineer → architect → backend_engineer (frontend_engineer apenas se o contrato exigir) → qa_engineer → domain_auditor → refactor_engineer se necessário → release_engineer.
- Architect obrigatório, sem bypass: exige decisão explícita sobre agrupamento e rastreabilidade dos relatórios.
- Condição de pronto: relatórios acessíveis de bioquímica identificam a referência realmente vinculada a cada registro, agrupam referências distintas separadamente e apresentam datas em ordem determinística; preservam filtros e decisões laboratoriais; testes relevantes, revisão técnica, auditoria de domínio e fechamento com evidências.
- Risco inicial: agrupar apenas por exame/lote pode juntar referências distintas; escolher a referência atual ao gerar um histórico pode atribuir contexto errado às medições.
- Workspace: há alterações locais preexistentes de frontend/mobile e documentos de auditoria; preservar esse trabalho.

## Gate 1 — Contexto

Context engineer concluiu pacote read-only; explorer confirmou os caminhos React.

- Fonte de verdade: matriz CQ-01 de `PLANS.md`, linhas “Dashboard, gráficos e relatórios do CQ”, “Cadastro e listagem de referências” e “Registro bioquímico, cálculo e decisão Westgard”; código ativo Java/React.
- Contexto prioritário (8 arquivos): `PLANS.md`, `QcRecord.java`, `QcReferenceValue.java`, `QcRecordRepository.java`, `CqOperationalV2Generator.java`, `PdfReportService.java`, `CqOperationalV2GeneratorTest.java` e `PdfReportServiceTest.java`.
- Símbolos: vínculo nullable `QcRecord.reference`; UUID/nome da referência; data operacional `QcRecord.date`; snapshots de alvo, DP, CV, limite, Z-score, status; `findByAreaAndDateRange`; renderização de resumo, gráficos, diário, violações e pós-calibração.
- Superfícies: conteúdo PDF operacional V2 e V1, PDFs especializados com registros individuais, pacote regulatório que reutiliza geradores. Nenhuma nova API, entidade, migration ou regra de frontend necessária.
- Caminho ativo: bioquímica redireciona à central `/relatorios`; `ReportStudio` usa geração/download V2 e apresenta o PDF pronto. V1 permanece como endpoint de compatibilidade.
- Invariantes: usar vínculo persistido mesmo se referência inativa/vencida; distinguir UUIDs iguais em nome/exame/nível/lote; não reconstruir vínculo ausente; valores e decisões vêm da medição; organização não altera histórico Westgard, filtro, estado original ou pós-calibração.
- Ambiguidades carregadas: CQ-A01/CQ-A06; CQ-A02/CQ-A03 como invariantes de preservação.
- Lacuna: nome/lote/fabricante/vigência da referência são metadados editáveis, sem snapshot histórico no registro; o UUID preserva identidade, mas a identificação textual reflete cadastro atual.
- Divergência preexistente: V1 calcula “Status Pós” por CV e trata nulo como zero, apesar de CQ-10 declarar ausência de recálculo de decisão. V2 apresenta classificação de eficácia distinta. Registrar como risco fora do escopo, sem mudar a semântica nesta entrega.
- Fora de escopo: resolução de referência, cálculo/Westgard, mutação de registros, novos filtros, módulos de outras áreas, mobile e consolidações agregadas sem registro individual.
- Validação definida: referências distintas com nome/exame/nível/lote iguais, registros desordenados, várias datas/mesmo dia, inativa/vencida, legado sem vínculo, filtros e snapshots preservados, texto extraído e inspeção visual de PDFs, regressão de outras áreas.
- Próximo agente: architect obrigatório; executor após congelamento.
- Baseline: `./mvnw -q -Dtest=PdfReportServiceTest,CqOperationalPartialMonthTest,CqOperationalPostCalibrationNullCvTest test` passou no ambiente disponível (JDK 25, projeto com target Java 21).

## Gate 2 — Arquitetura congelada

- Backend apresenta PDF por referência → data; sem alteração de React, API, DTO, entidade ou repositório.
- Vínculo persistido por UUID; nome atual e UUID completo visíveis; nota obrigatória: “Nome da referência conforme cadastro atual; valores e decisão conforme registro da medição.”
- Legado sem vínculo é explicitamente identificado e separado pela tupla exata (exame, nível, lote), sem reconstrução de referência.
- Grupos vinculados ordenados por nome/UUID; legado ao final; itens ordenados por data descendente, criação ascendente e ID, com ausentes ao final.
- Escopo: PDF V1 e operacional V2 (resumo, gráficos, histórico, violações e pós), tabelas/diário de Westgard dedicado e calibração dedicada. Outras áreas e agregados MULTIAREA preservados. Pacote regulatório recebe ajustes dos filhos.
- Data de violação é a medição original; data pós-calibração continua a do evento pós. Original e pós continuam distintos.
- Limites de violações: escolher o subconjunto conforme seleção atual antes de organizar por referência/data (30 no Westgard dedicado, 50 no operacional).
- Estatísticas/cálculos e semântica de estado permanecem conforme código ativo.
- Parecer prévio de domain_auditor: aprovado com ressalvas, CQ-A01/A06 e invariantes CQ-A02/A03; exige nome atual qualificado e evidência final após QA. Divergência preexistente V1 “Status Pós” registrada, fora do escopo.

### Contrato interno compartilhado para execução paralela

Helper puro `com.biodiagnostico.service.reports.QcReferenceReportGrouping`:

- `REFERENCE_METADATA_NOTE`: nota de cadastro atual acima.
- `key(QcRecord)`: chave tipada `ReferenceKey(referenceId, examName, level, lotNumber)`; vinculados usam somente referenceId, legado a tupla sem concatenar campos.
- `referenceLabel(QcRecord)`: nome atual e UUID completo, ou “Sem referência vinculada”.
- `referenceContext(QcRecord)`: contexto por snapshots de exame, nível e lote da medição.
- `groups(List<QcRecord>)`: grupos de medições ordenados.
- `groups(List<T>, Function<T,QcRecord>, Function<T,LocalDate>, Function<T,Instant>, Function<T,UUID>)`: mesmo agrupamento para eventos, usando data/criação/ID do evento; sem regra clínica.
- `Group<T>(QcRecord record, List<T> items)`: representante para identificação e itens ordenados.

Ownership congelado: executor principal escreve helper, `CqOperationalV2Generator` e respectivos testes; executor secundário escreve `PdfReportService`, `WestgardDeepdiveGenerator`, `CalibracaoPrePostGenerator` e respectivos testes, consumindo apenas a API acima. Root mantém este artefato e probes temporários de validação visual.

## Gate 3 — Implementação

- Helper puro adicionado: `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/QcReferenceReportGrouping.java`.
- Geradores alterados: `service/PdfReportService.java` e `service/reports/v2/generator/impl/{CqOperationalV2Generator,WestgardDeepdiveGenerator,CalibracaoPrePostGenerator}.java`.
- Testes adicionados: `service/reports/QcReferenceReportGroupingTest.java` e `service/reports/v2/generator/impl/CqOperationalReferenceGroupingTest.java`.
- Testes ampliados: `service/PdfReportServiceTest.java` e `service/reports/v2/generator/impl/{WestgardDeepdiveGeneratorTest,CalibracaoPrePostGeneratorTest}.java`.
- Impacto: identificação por nome atual/UUID completo; histórico de bioquímica por referência e data; grupos sem vínculo explícitos; cabeçalhos de referência repetidos nas tabelas quando passam de página; seções de violações e pós-calibração usam identidade original e datas corretas.
- Dependências entre camadas: nenhuma alteração contratual, de persistência ou frontend; pacote regulatório herda a apresentação dos geradores filhos.
- Seleção/valores preservados: recortes top30/top50 antes de ordenar grupos; representante original preservado para alvo/DP de estatísticas/gráficos; gráfico de delta da calibração mantém a mesma ordem de entrada e comportamento existente por exame.
- QA durante integração encontrou regressão no diário de coagulação (loader bioquímica no fallback); executor corrigiu com branch legado por `rf.area` e teste dedicado. Correção evita exibir registros de bioquímica no diário de outra área.
- Validação secundária passou: `./mvnw -q -Dtest=PdfReportServiceTest,WestgardDeepdiveGeneratorTest,CalibracaoPrePostGeneratorTest test` (19 testes, zero falhas).
- Validações operacional/helper, suíte final, inspeção visual e vereditos finais permanecem em execução.

## Gate 4 — QA

QA read-only concluída: apta a seguir para auditoria de domínio. Fluxo CQ relatórios/histórico de bioquímica, CQ-A01/CQ-A06 e invariantes CQ-A02/CQ-A03. Nenhum finding permaneceu aberto.

Findings corrigidos e reinspecionados:

- MÉDIA: diário de coagulação passou temporariamente a consultar bioquímica; branch legado restaurado por `rf.area`, com teste contra mistura de áreas.
- MÉDIA: contexto de um representante podia parecer contexto único do UUID; helper agora qualifica “Contexto do registro usado no cabeçalho” em grupos vinculados. Legados mantêm a tupla exata.
- BAIXA: resumo do fallback de outras áreas também recebia novos cabeçalhos; apresentação baseline restaurada, sem corrigir a consulta estatística preexistente. Teste verifica documento inteiro sem novos UUIDs/nomes/nota/headers.
- BAIXA: identificadores dos gráficos podiam se separar das imagens na paginação; referência/contexto/imagem ficam em bloco `keepTogether`, mantendo seleção, valores e cálculos.
- Ajustes locais de largura tornam status do diário bioquímico e datas do detalhe de calibração legíveis sem quebra da palavra/data.

Evidências de QA: 30 testes focados sem falhas (helper 4, referência operacional 7, V1 6, Westgard 6 e calibração 7); conjunto de 24 testes operacional/helper/existentes também passou; `git diff --check` passou. Cobertura de homônimos, legado, colisões de tupla, desempates, vigência/inatividade, snapshots alterados, filtro, evento pós, seleção dos limites e repetição UUID/data em múltiplas páginas.

Riscos preexistentes registrados: metadados textuais atuais, “Status Pós” V1, seleção nos empates de data e fallback estatístico de coagulação. Suíte completa e nova inspeção visual após ajustes finais em execução; nenhum teste bloqueante ausente para auditoria.

## Gate 5 — Auditoria de domínio

Domain auditor concluiu **aprovado_com_ressalvas**, read-only, sem bloqueio de domínio introduzido. Fluxo relatórios/histórico bioquímico, CQ-A01/CQ-A06 e invariantes CQ-A02/CQ-A03.

- Conceitos auditados: vínculo/UUID da referência, vigência/inatividade, cadastro atual versus snapshots, registro legado, agrupamento e histórico temporal, alvo/DP/CV/Z-score/status/violações, eventos pós e recortes dos relatórios.
- Fontes: matriz CQ-01 de `PLANS.md`, código ativo de entidades/repositórios e geradores, diff, testes/XML Surefire, artefato da entrega e texto extraído/visualização dos PDFs.
- Invariantes confirmados: UUID histórico sem nova resolução; referências homônimas separadas; legado sem identidade presumida; metadado atual/contexto representante qualificados; snapshots e decisão preservados; histórico/cálculos intactos; top30/top50 selecionados antes do agrupamento; original e pós distintos; cabeçalhos completos nas continuações.
- Cenários exercitados: homônimos, referência editada/inativa/vencida, valores e contexto distintos no mesmo UUID, legado, datas/empates, separadores/nulos, filtros, coagulação, limites, CV pós ausente, nomes longos e multipágina.
- Validação completa: `./mvnw -q test` passou (79 suítes, **705 testes**, zero falhas/erros/ignorados; saída `target/cq-reference-final-tests.log`).
- Visual final: quatro PDFs de fixture (85 medições, 85 violações e 29 eventos pós), **26 páginas** após ajustes (V1 5, operacional 11, Westgard 6, calibração 4), renderizados com Poppler e inspecionados; identificadores completos, nomes longos, datas e tabelas em continuação legíveis. Probes permanecem no diretório ignorado `biodiagnostico-api/target/reference-pdf-visual/`, sem dados reais.
- Ressalva: nome do cadastro atual não é snapshot histórico, explicitado no PDF.
- Ressalva preexistente: V1 “Status Pós” compara CV e trata nulo como zero; não constitui aprovação dessa regra clínica, exige tarefa própria.
- Precisão temporal preservada: filtro do pós-calibração usa data da medição original (`qcRecord.date`); exibição/ordenação usa data do evento (`PostCalibrationRecord.date`).
- Exigências adicionais de domínio: nenhuma para o escopo implementado. Próximo agente: release_engineer.

## Gate 6 — Fechamento

Release engineer concluiu **pronto_com_ressalvas**. Nenhuma pendência impeditiva para integrar o escopo implementado.

- Gates 0–5 confirmados; QA sem finding aberto; domain auditor aprovado com ressalvas para CQ-A01/CQ-A06, preservando CQ-A02/CQ-A03.
- Backend compilado e validado: 79 suítes/705 testes, zero falhas, erros ou ignorados.
- Após último ajuste cosmético (“Equip.” no diário bioquímico), `./mvnw -q -Dtest=CqOperationalReferenceGroupingTest test` passou novamente: 7 testes sem falha/erro/ignorados (`target/cq-reference-presentation-tests.log`).
- Quatro PDFs/26 páginas inspecionados com nomes longos, UUIDs completos, datas e cabeçalhos repetidos; página operacional final também inspecionada independentemente pelo release engineer, com cabeçalho “Equip.” e status legíveis.
- `git diff --check` passou; nenhuma alteração de contrato, dados, dependência ou regra clínica. Trabalho mobile preexistente preservado. Refactor engineer dispensado: não houve refatoração adicional necessária após corretude e revisão.
- Risco residual: nome atual do cadastro, comportamento preexistente “Status Pós” V1 e filtro pós pela data original versus exibição pela data do evento, conforme Gate 5.
- Próximo passo operacional: integrar as alterações, atualizar o backend pelo processo existente e emitir novos relatórios. Relatórios previamente armazenados/assinados permanecem como documentos históricos; esta entrega muda a geração de novos PDFs.
- Commit, implantação e reinício do backend não foram executados nesta entrega.

Resumo executivo: relatórios bioquímicos V1, operacional V2, Westgard e calibração identificam a referência persistida e organizam registros por referência/data, com nomes atuais qualificados, legado sem vínculo explícito e rastreabilidade preservada nas continuações.

## Continuação operacional autorizada

Em 04/10/2026, o usuário autorizou continuar após o fechamento, para integrar e atualizar o backend pelo processo vigente.

- Classificação: continuação operacional pequena, crítica pela publicação de CQ; reutiliza os gates técnicos e de domínio já concluídos, sem nova mudança de regra ou contrato.
- Fonte operacional: `README.md`, `transicao-java/05-DEPLOY.md`, Dockerfile/railway.toml e registros de deployments/status do GitHub.
- Revisão anterior: `9f2ae4b93e0e95960aacf019460b1b7a23940695`, confirmada em `main`, `origin/main` e último deploy Railway com sucesso.
- Destino: backend do projeto Railway `confident-acceptance / Java Labbio`, acessível em `https://api.labbio.app` e `https://back-end-java-labbio.up.railway.app`.
- Publicação vigente: push em `main` aciona a integração GitHub/Railway. O frontend também segue essa branch; esta entrega não altera arquivos do frontend.
- O diff não inclui migrations, entidades, configuração, Dockerfile ou dependências. O startup executa Flyway conforme comportamento anterior.
- Escopo de integração: somente helper, quatro geradores, cinco testes e este artefato; preservar alterações mobile e auditorias preexistentes no workspace.
- Validação antes de publicar: testes existentes confirmados (79 suítes/705 testes sem falha/erro/ignorados), diff check e empacotamento Maven.
- Critério de validação operacional: commit publicado no GitHub; Railway declara sucesso para o mesmo SHA; backend responde health/readiness e frontend responde após a implantação.
- Controle do Chrome indisponível: sessão encerrada pela restrição da URL atual. Nenhum contorno de restrição; acompanhamento pelo GitHub/HTTP.
- Evidência de relatório autenticado em produção depende de sessão/credenciais disponíveis; não criar nem alterar referências ou medições para a verificação.

Resultado da publicação será anexado ao registro operacional após acompanhar o deploy.

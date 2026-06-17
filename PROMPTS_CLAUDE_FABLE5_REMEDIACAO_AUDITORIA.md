# Sistema de prompts para Claude Fable 5 corrigir a auditoria Labbio

Pesquisa realizada em 2026-06-10.

Nota de nomenclatura: nao encontrei produto oficial chamado "Claude Flare 5". As fontes oficiais da Anthropic indicam "Claude Fable 5" como modelo publico mais recente dessa linha. Este documento usa o nome oficial Claude Fable 5.

## Fontes oficiais pesquisadas

- https://www.anthropic.com/claude/fable
- https://www.anthropic.com/claude/mythos
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/about-claude/models/migration-guide
- https://platform.claude.com/docs/en/build-with-claude/context-windows
- https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- https://platform.claude.com/docs/en/build-with-claude/effort
- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/tools-reference
- https://code.claude.com/docs/en/commands
- https://code.claude.com/docs/en/checkpointing
- https://code.claude.com/docs/en/hooks

## O que muda no Claude Fable 5

- Modelo oficial: `claude-fable-5`.
- Foco: tarefas longas, agenticas, assincromas, engenharia complexa, migracoes grandes, conhecimento, visao e computer use.
- Contexto: 1M tokens por padrao na Claude API.
- Saida maxima: ate 128k tokens.
- Raciocinio: adaptive thinking sempre ativo; nao usar `thinking: {type: "disabled"}`.
- Controle de profundidade: usar `--effort high` como padrao e `--effort max` apenas para tarefas P0/P1 muito criticas.
- Claude Code: requer v2.1.170 ou superior para selecionar Fable 5.
- Seguranca: Fable 5 tem salvaguardas fortes para cybersecurity, biologia e quimica; tarefas de seguranca devem ser defensivas, autorizadas e nao destrutivas.
- Retencao: Fable 5 exige politica de 30 dias de retencao para monitoramento de seguranca; nao usar se o projeto exigir Zero Data Retention.

## Comando recomendado para abrir o workspace

```bash
cd "/Users/otaviodasilvamachado/Desktop/Bio Java Codex"
claude update
claude --model fable --effort high --permission-mode plan
```

Para uma correcao P0 com mais autonomia, depois de revisar o plano:

```bash
claude --model fable --effort max --worktree remediacao-auditoria-p0 --permission-mode plan
```

## Funcoes e capacidades de terminal confirmadas no Claude Code

### Comandos de CLI

- `claude`: abre sessao interativa.
- `claude "prompt"`: abre sessao com prompt inicial.
- `claude -p "prompt"`: executa em modo print/SDK e sai.
- `cat arquivo | claude -p "prompt"`: processa entrada por pipe.
- `claude -c`: continua a conversa mais recente no diretorio atual.
- `claude -r "<sessao>" "prompt"`: retoma sessao por ID ou nome.
- `claude update`: atualiza Claude Code.
- `claude install [version|stable|latest]`: instala/reinstala binario.
- `claude auth login`, `logout`, `status`: login, logout e estado de autenticacao.
- `claude agents`: gerencia sessoes/agentes em background.
- `claude attach <id>`: anexa a uma sessao em background.
- `claude logs <id>`: le logs recentes de uma sessao em background.
- `claude stop <id>` / `claude kill <id>`: para uma sessao.
- `claude daemon status|stop`: diagnostica/encerra supervisor de background.
- `claude mcp`: configura MCP servers.
- `claude plugin`: gerencia plugins.
- `claude remote-control`: habilita controle via Claude.ai/app.
- `claude ultrareview [target]`: revisao nao interativa profunda.
- `claude setup-token`: gera token longo para CI/scripts.

### Flags uteis

- `--model fable`: seleciona Claude Fable 5.
- `--effort low|medium|high|xhigh|max`: controla profundidade/custo.
- `--advisor fable|opus|sonnet`: ativa advisor quando disponivel.
- `--worktree <nome>`: cria worktree isolada.
- `--permission-mode plan|default|acceptEdits|auto|dontAsk|bypassPermissions`: controla permissoes.
- `--allowedTools` e `--disallowedTools`: limita ferramentas.
- `--tools "Bash,Edit,Read"`: restringe ferramentas carregadas.
- `--add-dir <path>`: adiciona diretorio acessivel.
- `--system-prompt-file` / `--append-system-prompt-file`: injeta prompts.
- `--max-budget-usd`: limita custo em modo print.
- `--max-turns`: limita turnos agenticos.
- `--output-format json|stream-json`: saida estruturada.
- `--json-schema`: valida saida contra JSON Schema.
- `--chrome`: habilita integracao Chrome para teste web.
- `--bg`: inicia em background.
- `--exec`: executa comando shell como job em background.

### Ferramentas internas importantes

- `Bash`: executa comandos shell; exige permissao. Timeout padrao de 2 minutos, pode pedir ate 10 minutos.
- `Read`: le arquivos, imagens, PDFs e notebooks.
- `Edit` e `Write`: edita ou cria arquivos.
- `Grep` e `Glob`: busca conteudo e arquivos.
- `LSP`: definicoes, referencias, tipos, simbolos e erros via language server.
- `Monitor`: acompanha logs, CI, arquivos ou scripts em background.
- `Agent`: cria subagente com contexto proprio.
- `TaskCreate`, `TaskList`, `TaskUpdate`, `TaskStop`: gerencia tarefas.
- `WebSearch` e `WebFetch`: pesquisa e leitura web.
- `NotebookEdit`: edita notebooks.
- `CronCreate`, `CronList`, `CronDelete`: agenda prompts dentro da sessao.
- `MCP`: conecta ferramentas externas, bancos, APIs, issue trackers e observabilidade.
- `Hooks`: executa shell/HTTP/prompts em eventos como `PreToolUse`, `PostToolUse`, `Stop`, `FileChanged`.

## Prompt mestre

Use este prompt ao iniciar a sessao principal:

```text
Voce esta no workspace /Users/otaviodasilvamachado/Desktop/Bio Java Codex.

Atue como engenheiro senior de seguranca, arquitetura web, Java/Spring, React/TypeScript e dominio laboratorial. Siga AGENTS.md e CLAUDE.md como instrucoes obrigatorias. Esta tarefa e grande e critica.

Objetivo: corrigir, com testes e evidencia, todos os achados da auditoria Labbio, priorizando P0 e P1 antes de qualquer melhoria cosmética.

Escopo autorizado: apenas testes defensivos e nao destrutivos no codigo local, servidor local e dominios proprios labbio.app/www.labbio.app/api.labbio.app. Nao executar brute force, exploracao destrutiva, exfiltracao, fuzzing agressivo ou ataques reais.

Fonte de verdade:
1. Codigo ativo Java/React.
2. Configuracao real publicada em labbio.app e api.labbio.app.
3. Documentacao de migracao em transicao-java quando houver lacuna.
4. Legado apenas para paridade e ambiguidade.

Pipeline obrigatorio:
Gate 0 triage -> Gate 1 contexto -> Gate 2 arquitetura -> Gate 3 implementacao -> Gate 4 QA -> Gate 5 auditoria de dominio quando tocar CQ/LGPD/rastreabilidade -> Gate 6 release.

Nao implemente nada antes de:
- ler os arquivos afetados;
- declarar fonte de verdade;
- classificar tamanho/criticidade;
- definir criterio de validacao;
- registrar risco residual.

Preserve mudancas nao relacionadas no git. Use worktree/branch se a alteracao for grande. Depois de cada lote, rode testes relevantes e documente evidencia.

Achados a resolver:
A01 config.js aponta para backend antigo.
A02 Prometheus publico.
A03 reset de senha salva token em claro e loga link.
A04 senha minima fraca em fluxos administrativos.
A05 AuditService engole falha de auditoria.
A06 Reports V2 aceita storage efemero em producao.
A07 validacoes numericas de CQ insuficientes.
A08 IA com dados laboratoriais sem permissao/LGPD suficiente.
A09 rate limit e blacklist em memoria.
A10 canonical apex/www e CORS desalinhados.
A11 frontend sem CSP.
A12 HSTS ausente no backend publico.
A13 preview HTML de relatorios V2 exige sanitizacao/escape.
A14 /api/* no dominio frontend nao e proxy real.
A15 perfil local nao replica producao.
A16 arquivos gigantes concentram responsabilidade.
A17 sitemap publica rotas privadas.
A18 warning de hook no frontend.
A19 manifest com content-type incorreto.
A20 SCA/dependency audit nao automatizado.

Entrega esperada:
- commits pequenos por frente;
- um commit por fase validada, nunca misturando P0/P1 com refatoracao cosmetica;
- tabela achado -> arquivo alterado -> teste -> status;
- evidencia de curl/build/test;
- risco residual;
- instrucoes de deploy/env para Railway/Vercel/Nginx.
```

## Prompt P0: producao e superficie exposta

```text
Resolva somente P0 de infraestrutura/seguranca:
- A01 config.js/backend canonico;
- A02 Prometheus publico;
- A10 apex/www/CORS se necessario para nao quebrar usuarios;
- A12 HSTS no backend;
- A14 comportamento /api no dominio frontend se houver fallback perigoso.

Regras:
1. Leia runtimeConfig, templates nginx, application.yml/prod, SecurityConfig, CorsConfig e docs de deploy.
2. Nao mexa em regra laboratorial.
3. Crie uma nota arquitetural curta antes de editar.
4. Se Prometheus precisar continuar existindo, proteja por rede privada, auth ou remova da exposicao publica.
5. Atualize exemplos de env para apontar para https://api.labbio.app/api.
6. Rode build/test relevantes.
7. Valide com curl seguro:
   - https://api.labbio.app/actuator/health deve continuar UP.
   - /actuator/prometheus nao deve ficar publico.
   - origem https://www.labbio.app deve funcionar.
   - origem nao autorizada deve falhar.
8. Entregue diffs e risco residual.
```

## Prompt P0: autenticacao, reset e senhas

```text
Resolva A03, A04 e parte autentica de A09.

Objetivo:
- Reset de senha deve armazenar apenas hash do token.
- Nenhum log deve conter token ou link completo.
- Senhas administrativas/register/reset devem ter politica forte uniforme.
- Reset/forgot-password deve ter rate limit defensivo por IP e por identificador normalizado, sem enumerar usuario.

Leia:
- AuthController
- AuthService
- PasswordResetService
- PasswordResetToken entity/repository
- DTOs de auth/admin
- testes existentes de auth/reset
- migracoes Flyway se schema mudar

Implemente com compatibilidade de migracao. Nao remova tokens ativos sem decisao explicita; se necessario, crie migracao que invalida tokens antigos de forma segura.

Valide:
- mvnw test para backend;
- testes especificos de reset;
- curl local para forgot/reset sem revelar se email existe;
- logs sem token.
```

## Prompt P0: auditabilidade e relatorios

```text
Resolva A05 e A06.

Para AuditService:
- Identifique eventos criticos que nao podem falhar silenciosamente.
- Defina se falha bloqueia transacao ou vai para outbox/alerta.
- Nao quebre leituras simples por indisponibilidade de auditoria.

Para Reports V2:
- Em producao, se reports.v2.enabled=true, storage persistente e publicBaseUrl devem ser obrigatorios.
- Fallback tmp pode existir apenas em local/test/piloto explicitamente configurado.
- Atualize logs e testes.

Valide:
- testes unitarios/integracao;
- profile local continua subindo;
- profile prod falha rapido se configuracao obrigatoria estiver ausente.
```

## Prompt P1 critico: Controle de Qualidade e invariantes laboratoriais

```text
Resolva A07 com disciplina de dominio.

Fluxo CQ afetado: referencia, registro de medicao, media, desvio padrao, CV, z-score, Westgard e pos-calibracao.

Antes de implementar:
- Leia PLANS.md Fase CQ-01.
- Leia WestgardEngine, QcService, QcReferenceService, PostCalibrationService, AreaQcService, HematologyQcService.
- Leia DTOs de request correspondentes.
- Liste invariantes atuais e lacunas.
- Se tocar ambiguidades CQ-A01 a CQ-A06, pare e registre a ambiguidade no handoff.

Objetivo:
- Rejeitar valores nao finitos, targetSd <= 0, CV negativo ou limites impossiveis.
- Validar min/max/tolerancia coerentes.
- Evitar que frontend invente regra que pertence ao backend.
- Adicionar mensagens de erro claras e testes.

Nao alterar formula de Westgard por inferencia. Qualquer divergencia entre codigo e docs exige veredito de dominio antes de merge.
```

## Prompt P1: IA, LGPD e permissoes

```text
Resolva A08.

Objetivo:
- Restringir /api/ai/analyze e /api/ai/voice-to-form por permissao adequada.
- Garantir minimizacao de dados enviados ao Gemini.
- Validar mimeType e tamanho.
- Adicionar aviso/documentacao de LGPD e base operacional.
- Registrar auditoria de uso sem armazenar prompt/audio sensivel.

Leia AiController, GeminiAiService, permission model, frontend que chama IA e docs de privacidade existentes.

Valide:
- usuario VISUALIZADOR nao consegue usar endpoint se nao tiver permissao;
- usuario autorizado consegue;
- payload invalido e rejeitado com 400;
- logs nao incluem audio/prompt sensivel.
```

## Prompt P1/P2: frontend hardening, XSS, SEO e PWA

```text
Resolva A11, A13, A17 e A19.

Objetivo:
- Adicionar CSP no frontend, preferencialmente report-only primeiro se houver risco de quebra.
- Padronizar escape/sanitizacao de HTML de preview dos relatorios.
- Remover rotas privadas e reset-password do sitemap.
- Ajustar manifest.webmanifest para content-type correto.

Leia:
- nginx.conf.template
- ReportBuilder.tsx
- generators de relatorio V2
- sitemap/robots templates
- Dockerfile/entrypoint de SEO

Valide:
- vite build;
- testes de relatorios;
- curl nos headers;
- render local sem console errors.
```

## Prompt P2/P3: qualidade, arquitetura e dependencias

```text
Resolva A15, A16, A18 e A20 sem ampliar escopo.

Objetivo:
- Corrigir warning do hook em ImunologiaArea.
- Adicionar scripts/gates de SCA ou documentar comando oficial.
- Planejar refatoracao dos arquivos gigantes sem misturar com P0/P1.
- Melhorar paridade local/prod onde for seguro.

Regra:
- Refatoracao so depois de comportamento coberto por teste.
- Nao alterar CQ por conveniencia.
- Entregue plano e uma primeira melhoria pequena e verificavel.
```

## Prompt final de QA/release

```text
Faca revisao final de release.

Para cada achado A01-A20, informe:
- status: corrigido, parcialmente corrigido, pendente ou bloqueado;
- arquivos alterados;
- evidencias de teste;
- comando usado;
- risco residual;
- passo de deploy/env necessario.

Execute no minimo:
- git diff --check
- backend tests
- frontend tests
- frontend lint
- frontend build
- curls seguros para labbio.app/www/api quando aplicavel

Nao marque pronto se:
- Prometheus ainda estiver publico;
- reset ainda gravar token em claro;
- relatorio regulatorio puder ficar apenas em tmp em producao;
- CQ aceitar targetSd <= 0 ou valor nao finito;
- config publicada ainda apontar para host antigo.
```

## Sugestao de hooks defensivos no Claude Code

Use hooks para reduzir erro humano:

- `PreToolUse` para bloquear `rm -rf`, comandos destrutivos e fuzzing agressivo.
- `PostToolUse` para rodar `git diff --check` depois de edicoes.
- `FileChanged` para disparar lint/testes especificos.
- `Stop` para exigir resumo com arquivos alterados, validacoes e riscos.

## Estrategia de commits por fase

Sim: use um commit por fase ou por lote coeso de achados. Isso torna rollback, revisao e deploy muito mais seguros. Nao misture correcao critica de seguranca com refatoracao, SEO, lint ou reorganizacao de componente.

Regras:

- Cada commit deve ter no maximo uma intencao principal.
- P0 deve ser commitado antes de P1/P2.
- Mudancas de dominio CQ devem ter commit proprio e citar o fluxo CQ afetado.
- Mudancas de env/deploy devem ter commit proprio quando forem aplicadas no repo.
- Refatoracao so entra depois de testes verdes e em commit separado.
- Cada commit deve rodar os testes proporcionais ao risco antes de ser criado.
- Mensagem de commit deve listar os achados resolvidos, por exemplo `fix(security): protect prometheus and align api host (A01,A02)`.

Sequencia sugerida de commits:

1. `fix(infra): align production api host and canonical origins (A01,A10,A14)`
2. `fix(security): restrict public actuator metrics (A02,A12)`
3. `fix(auth): harden password reset and password policy (A03,A04,A09)`
4. `fix(audit): enforce critical audit-log reliability (A05)`
5. `fix(reports): require persistent storage in production (A06)`
6. `fix(qc): validate laboratory numeric invariants (A07)`
7. `fix(ai): restrict ai endpoints and document lgpd safeguards (A08)`
8. `fix(web): add csp and harden report previews (A11,A13)`
9. `fix(seo): remove private routes from sitemap and fix manifest type (A17,A19)`
10. `chore(quality): add sca gates and address frontend warning (A18,A20)`
11. `refactor: split large modules behind existing tests (A16)` somente se ainda houver tempo e cobertura.

Checklist antes de cada commit:

```bash
git diff --check
./mvnw -q test
cd biodiagnostico-web && node node_modules/vitest/vitest.mjs run
cd biodiagnostico-web && node node_modules/eslint/bin/eslint.js .
cd biodiagnostico-web && node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build
```

Adapte os comandos ao escopo: se o commit for apenas backend, nao precisa rodar build frontend; se tocar contrato backend/frontend, rode ambos.

## Ordem recomendada de execucao

1. P0 infraestrutura: A01, A02, A10, A12, A14.
2. P0 autenticacao: A03, A04, A09 auth/reset.
3. P0 compliance: A05, A06.
4. P1 dominio CQ: A07.
5. P1 LGPD/IA: A08.
6. P1/P2 frontend: A11, A13, A17, A19.
7. P2/P3 qualidade: A15, A16, A18, A20.
8. QA/release final.

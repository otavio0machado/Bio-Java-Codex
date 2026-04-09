# Prompts por Area - Auditoria Biodiagnostico 3.0

Fonte base: `auditorias/AUDITORIA_BIODIAGNOSTICO.docx`  
Data da auditoria: `2026-03-29`

## Regras globais para TODOS os prompts

- O site ja esta em producao.
- Nao remover dados.
- Nao dropar tabelas, nao truncar tabelas, nao apagar registros em massa, nao resetar banco, nao sobrescrever dados reais, nao invalidar sessoes em massa sem plano seguro.
- Toda mudanca deve ser retrocompativel, incremental e reversivel.
- Se houver migracao, ela deve ser forward-only, idempotente quando possivel e sem perda de dados.
- Arquivos em `biodiagnostico_app/.web/` sao artefatos gerados pelo Reflex. Use-os para diagnostico e validacao, mas prefira corrigir a fonte real em `biodiagnostico_app/biodiagnostico_app/`, `biodiagnostico_app/assets/` e arquivos de configuracao.
- Antes de corrigir qualquer item, confirme se o problema ainda existe no codigo atual. Se a auditoria estiver desatualizada em algum ponto, documente como falso positivo ou ja resolvido em vez de duplicar logica.
- Ao final de cada execucao, sempre entregar: arquivos alterados, resumo do que foi feito, riscos residuais, comandos rodados e resultado dos testes/validacoes.

---

## 1. Performance

### Prompt resolutivo

```text
Voce e um engenheiro senior de performance especializado em Reflex, React 19, Vite, Nginx, Railway e Supabase. Sua tarefa e corrigir SOMENTE a area de PERFORMANCE do projeto Biodiagnostico 3.0 com foco em ganho real de tempo de carregamento e reducao de payload sem quebrar fluxos existentes.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao editar dados reais do banco.
- Nao fazer refactor cosmetico sem impacto.
- Nao editar manualmente arquivos gerados em `biodiagnostico_app/.web/` como fonte da verdade.

CONTEXTO DA AUDITORIA
- Bundle muito pesado nas rotas geradas de login e proin.
- Carregamento waterfall em `biodiagnostico_app/biodiagnostico_app/states/qc_state.py`.
- Ausencia de compressao em `biodiagnostico_app/nginx.conf`.
- Imagem pesada em `biodiagnostico_app/assets/login_bg.png`.
- Possiveis re-renders amplificados em `.web/utils/context.js` e efeitos visuais caros em `biodiagnostico_app/assets/custom.css`.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/biodiagnostico_app/states/qc_state.py`
- `biodiagnostico_app/biodiagnostico_app/pages/login.py`
- `biodiagnostico_app/biodiagnostico_app/pages/proin.py`
- `biodiagnostico_app/biodiagnostico_app/biodiagnostico_app.py`
- `biodiagnostico_app/nginx.conf`
- `biodiagnostico_app/assets/custom.css`
- `biodiagnostico_app/assets/login_bg.png`
- Arquivos gerados apenas para diagnostico: `biodiagnostico_app/.web/app/routes/_index.jsx`, `biodiagnostico_app/.web/app/routes/[proin]._index.jsx`, `biodiagnostico_app/.web/vite.config.js`, `biodiagnostico_app/.web/utils/context.js`

OBJETIVOS
1. Reduzir payload inicial e custo de parse nas rotas de login e proin.
2. Paralelizar chamadas independentes no carregamento do QC usando `asyncio.gather()` ou estrategia equivalente com tratamento granular de erro.
3. Habilitar gzip no Nginx para HTML, CSS, JS, JSON, SVG e WASM.
4. Corrigir cache headers para que HTML revalide e assets com hash mantenham cache longo.
5. Otimizar a imagem de login para WebP ou AVIF com fallback seguro.
6. Reduzir jank visual causado por efeitos CSS caros, sem piorar o design.
7. Confirmar se existe alguma forma segura de influenciar chunking/lazy loading a partir do codigo-fonte do Reflex; se nao existir, documentar a limitacao.

FORMA DE EXECUCAO
1. Medir e diagnosticar antes de alterar. Gere o build disponivel do app e inspecione os artefatos para identificar os maiores bundles e imports dominantes.
2. Descubra a fonte real das rotas pesadas no codigo Python do Reflex. Evite hotfix em `.web/`.
3. No `qc_state.py`, separe o que e dependente do que e independente. Paralelize apenas o que nao depende de resultado anterior. Use tratamento por bloco para que falha de um recurso nao derrube o resto.
4. No `nginx.conf`, adicione compressao e preserve todas as `location` existentes (`/_event`, `/_upload`, `/api`, `/ping`, `/_backend`, `/`, `/assets/`).
5. Ajuste cache de `index.html` para revalidacao e mantenha cache agressivo apenas para assets versionados.
6. Gere um arquivo de imagem otimizado e atualize a referencia de forma retrocompativel.
7. Revise `custom.css` e alivie `filter: blur()` e outros efeitos custosos apenas onde isso trouxer beneficio real.
8. Se houver necessidade de lazy loading, aplique na fonte do app e confirme o efeito no build gerado.

RESTRICOES
- Nao reescrever o app inteiro.
- Nao mudar contratos de dados.
- Nao eliminar funcionalidades da tela proin para "melhorar performance".
- Nao trocar bibliotecas estruturais sem forte necessidade.

ENTREGAVEIS
- Diff enxuto e focado.
- Resumo before/after com os gargalos que de fato melhoraram.
- Lista de arquivos alterados.
- Comandos executados e seus resultados.
- Riscos residuais.

CRITERIOS DE ACEITE
- Compressao habilitada no Nginx.
- HTML revalida corretamente e assets continuam cacheados.
- Carregamento do QC nao fica todo serializado quando nao precisa.
- Login background otimizado.
- Nenhuma regressao funcional nas rotas `/`, `/dashboard` e `/proin`.
```

### Prompt de QA

```text
Voce e um QA tecnico e code reviewer de performance. Sua tarefa e auditar SOMENTE a area de PERFORMANCE apos a implementacao no projeto Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Validar com evidencias.
- Se algum item da auditoria original tiver virado falso positivo ou tiver sido tratado de outra forma, registre isso com clareza.

O QUE VERIFICAR
1. Build e artefatos
- Gere o build disponivel do app e inspecione os arquivos finais.
- Confirme se houve reducao de peso ou melhor segmentacao de bundles nas rotas mais caras.
- Verifique se a correcao foi feita na fonte do Reflex e nao apenas em `.web/`.

2. Carregamento de dados
- Leia `biodiagnostico_app/biodiagnostico_app/states/qc_state.py`.
- Confirme se chamadas independentes foram paralelizadas com `asyncio.gather()` ou estrategia equivalente.
- Verifique se chamadas dependentes continuam em ordem.
- Valide tratamento de excecao por recurso, sem mascarar falhas silenciosamente.

3. Nginx
- Leia `biodiagnostico_app/nginx.conf`.
- Confirme `gzip on`, `gzip_vary on`, `gzip_min_length`, `gzip_comp_level` sensato e `gzip_types` adequados.
- Confirme que nenhuma `location` existente foi perdida.
- Verifique cache header de `/` com revalidacao e de `/assets/` com cache longo.

4. Assets e CSS
- Verifique se existe versao otimizada da imagem de login e se ela esta realmente referenciada.
- Compare tamanhos de arquivo quando possivel.
- Revise `biodiagnostico_app/assets/custom.css` para confirmar que efeitos caros foram tratados sem quebrar visual.

5. Regressao funcional
- Validar, no minimo, login, dashboard e proin.
- Conferir se o carregamento nao falha quando algum recurso parcial apresenta erro.

FORMATO DO RELATORIO
- Liste achados primeiro, em ordem de severidade, com arquivo e linha quando possivel.
- Depois diga o que passou.
- Ao final, de um veredito unico: `Aprovado`, `Aprovado com ressalvas` ou `Reprovado`.
- Se nao houver achados relevantes, diga isso explicitamente e aponte riscos residuais.
```

---

## 2. SEO

### Prompt resolutivo

```text
Voce e um especialista senior em SEO tecnico para apps feitos com Reflex e React Router. Sua tarefa e corrigir SOMENTE a area de SEO do projeto Biodiagnostico 3.0, melhorando indexacao basica, compartilhamento de links e higiene tecnica sem quebrar o app.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao quebrar autenticacao nem navegação.
- Nao editar `.web/` como fonte primaria; use `.web/` para diagnostico e validacao.

CONTEXTO DA AUDITORIA
- SSR aparece desabilitado no artefato gerado.
- Meta tags estao incompletas.
- Sitemap gerado aponta para localhost.
- Nao existe `robots.txt`.
- Nao ha canonical nem dados estruturados basicos.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/biodiagnostico_app/biodiagnostico_app.py`
- `biodiagnostico_app/rxconfig.py`
- `biodiagnostico_app/assets/manifest.json`
- Para diagnostico: `biodiagnostico_app/.web/react-router.config.js`, `biodiagnostico_app/.web/app/root.jsx`, `biodiagnostico_app/.web/app/_document.js`, `biodiagnostico_app/.web/public/sitemap.xml`

OBJETIVOS
1. Implementar metadata global e metadata por rota para `/`, `/dashboard`, `/proin` e `404`.
2. Garantir `robots.txt` valido.
3. Garantir sitemap com dominio correto de producao, nunca localhost.
4. Adicionar canonical URL por rota.
5. Adicionar estrutura minima de Open Graph e, se fizer sentido, JSON-LD leve e seguro.
6. Investigar se SSR pode ser habilitado pelo Reflex sem alto risco. Se nao puder, documentar claramente a limitacao e maximize o SEO possivel no modelo atual.

FORMA DE EXECUCAO
1. Descubra como o app monta metadados pela fonte do Reflex. Aproveite `app = rx.App(...)` e a configuracao das paginas.
2. Adicione titulos, descricoes, `og:title`, `og:description`, `og:type`, `og:image`, `theme-color` e `canonical`.
3. Defina uma variavel de ambiente canonica como `SITE_URL` ou use `RAILWAY_PUBLIC_DOMAIN` com normalizacao segura. Nunca hardcode localhost em arquivos finais.
4. Gere ou corrija sitemap para o dominio real de producao.
5. Crie `robots.txt` coerente com o app, bloqueando endpoints tecnicos como `/_event`, `/_upload`, `/_backend` e `/api/`.
6. Se JSON-LD for aplicado, mantenha simples, valido e sem informacoes enganosas.
7. Caso SSR nao seja suportado de forma segura neste app, nao force um hack. Documente o limite, implemente o maximo possivel de metadata e entregue a justificativa tecnica.

RESTRICOES
- Nao indexar acidentalmente endpoints internos ou sensiveis.
- Nao inventar paginas publicas que nao existem.
- Nao mascarar um sistema autenticado como site de marketing.

ENTREGAVEIS
- Metadados globais e por pagina.
- `robots.txt`.
- Sitemap corrigido.
- Explicacao objetiva sobre SSR: habilitado com seguranca, inviavel no momento, ou dependente do framework.
- Comandos e validacoes executadas.

CRITERIOS DE ACEITE
- Nenhum `localhost` em sitemap, canonical ou metadados finais.
- `robots.txt` acessivel e coerente.
- Paginas principais com titulo e descricao uteis.
- Resultado final sem impacto funcional nas rotas existentes.
```

### Prompt de QA

```text
Voce e um QA tecnico especialista em SEO para SPAs e apps autenticados. Sua tarefa e validar SOMENTE a area de SEO apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Validar o que foi realmente entregue, sem assumir que SSR precisa existir se o framework nao suportar isso com seguranca.

CHECKLIST
1. Metadata
- Verifique titulos e descricoes para `/`, `/dashboard`, `/proin` e `404`.
- Confirme a presenca de `og:title`, `og:description`, `og:type` e imagem social quando aplicavel.
- Confirme `canonical` por rota, sem `localhost`.

2. Dominio canonico
- Leia a fonte e confirme como o dominio e resolvido.
- Garanta que o codigo nao depende de dominio hardcoded incorreto.
- Verifique se ha fallback seguro para ambientes sem `SITE_URL` ou `RAILWAY_PUBLIC_DOMAIN`.

3. Sitemap e robots
- Confirme que existe sitemap valido com URLs reais.
- Verifique `robots.txt` e as diretivas para endpoints internos.
- Confirme que `Sitemap:` aponta para a URL correta.

4. SSR ou limitacao documentada
- Verifique se a implementacao tentou habilitar SSR de modo suportado.
- Se SSR nao foi habilitado, confirme que isso foi documentado com justificativa tecnica e que o restante do SEO foi maximizado.

5. Regressao
- Confirme que o app continua carregando normalmente.
- Verifique se nao houve exposicao indevida de paginas internas a crawlers por erro de configuracao.

FORMATO DO RELATORIO
- Achados primeiro, com severidade, arquivo e evidencia.
- Depois itens aprovados.
- Finalize com `Aprovado`, `Aprovado com ressalvas` ou `Reprovado`.
```

---

## 3. Acessibilidade

### Prompt resolutivo

```text
Voce e um especialista senior em acessibilidade web (WCAG 2.1 AA) com experiencia em Reflex e componentes interativos. Sua tarefa e corrigir SOMENTE a area de ACESSIBILIDADE do projeto Biodiagnostico 3.0, preservando o design atual e sem regressao funcional.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao quebrar navegacao de teclado.
- Preserve os bons pontos ja existentes: focus states, labels e hierarquia visual.

CONTEXTO DA AUDITORIA
- Falta skip link para pular para o conteudo principal.
- Havia suspeita de navegacao mobile incompleta.
- Toasts podem depender do comportamento padrao da biblioteca sem `aria-live` explicito.
- A auditoria tambem registrou varios pontos positivos que devem ser preservados.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/biodiagnostico_app/biodiagnostico_app.py`
- `biodiagnostico_app/biodiagnostico_app/components/navbar.py`
- `biodiagnostico_app/biodiagnostico_app/components/ui.py`
- `biodiagnostico_app/biodiagnostico_app/pages/dashboard.py`
- `biodiagnostico_app/assets/custom.css`

OBJETIVOS
1. Implementar skip link funcional e visivel ao foco.
2. Confirmar se a navegacao mobile realmente esta faltando ou se o item da auditoria virou falso positivo por causa de `mobile_nav_trigger()`.
3. Garantir anuncios acessiveis para toasts e mensagens dinamicas.
4. Preservar foco visivel, labels e estrutura semantica ja existentes.
5. Corrigir apenas o que melhora acessibilidade de verdade.

FORMA DE EXECUCAO
1. Verifique primeiro se o problema da navegacao mobile ainda existe. O arquivo `navbar.py` ja possui `mobile_nav_trigger()`. Se o menu estiver funcional, nao duplique a navegacao; apenas documente o falso positivo e melhore o que faltar em acessibilidade do menu.
2. Adicione um skip link no layout principal apontando para a regiao de conteudo real, com foco visivel e sem quebrar o layout.
3. Revise a forma como toasts sao montados e garanta anuncio adequado para leitores de tela, seja via configuracao da biblioteca ou por camada propria segura.
4. Preserve a hierarquia de headings e os labels associados.
5. Valide foco de teclado, ordem de tab e navegacao mobile.

RESTRICOES
- Nao trocar toda a biblioteca de toast.
- Nao introduzir componentes que piorem contraste ou foco.
- Nao duplicar menus ou landmarks desnecessariamente.

ENTREGAVEIS
- Skip link funcional.
- Ajustes de acessibilidade do menu mobile, se realmente necessarios.
- Ajustes de anuncios dinamicos.
- Resumo do que era problema real versus falso positivo.

CRITERIOS DE ACEITE
- Usuario de teclado consegue pular a navegacao e ir ao conteudo.
- Menu mobile esta acessivel e coerente.
- Toasts e feedbacks relevantes sao anunciados de forma adequada.
- Nenhum componente importante perdeu foco visivel ou semantica.
```

### Prompt de QA

```text
Voce e um QA de acessibilidade com foco em WCAG 2.1 AA. Sua tarefa e validar SOMENTE a area de ACESSIBILIDADE apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Verificar tambem se algum achado da auditoria original era falso positivo.

CHECKLIST
1. Skip link
- Confirme que existe link para pular ao conteudo principal.
- Valide foco visivel, texto compreensivel e alvo correto.

2. Menu mobile
- Leia `navbar.py`.
- Confirme se a navegacao mobile esta acessivel por teclado e leitor de tela.
- Se o app ja tinha menu mobile via `mobile_nav_trigger()`, registre a divergencia entre auditoria e codigo atual.

3. Toasts e mensagens dinamicas
- Verifique se o mecanismo final usa `aria-live`, role apropriado ou equivalente suportado.
- Confirme que mensagens nao ficam invisiveis para tecnologia assistiva.

4. Regressao geral
- Preserve focus ring, labels e headings bons ja existentes.
- Verifique se nao surgiram armadilhas de foco ou elementos inacessiveis no mobile.

FORMATO DO RELATORIO
- Achados primeiro, por severidade, com arquivo e evidencia.
- Diferencie `problema`, `ressalva` e `falso positivo da auditoria`.
- Finalize com veredito e risco residual.
```

---

## 4. Seguranca

### Prompt resolutivo

```text
Voce e um engenheiro senior de seguranca aplicacional e infraestrutura. Sua tarefa e corrigir SOMENTE a area de SEGURANCA do projeto Biodiagnostico 3.0 com o menor risco possivel para um sistema que ja esta em producao.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao executar nenhuma acao destrutiva no banco.
- Nao imprimir, expor ou reutilizar chaves reais em logs, commits ou respostas.
- Toda correcao de banco deve ser feita com migracoes seguras e sem perda de dados.

CONTEXTO DA AUDITORIA
- Existe `.env` com segredos reais no repo do app.
- As policies de RLS em `migrations/005_fix_qc_records_rls.sql` e `migrations/006_restrict_rls_policies.sql` estao amplas demais.
- `nginx.conf` esta sem headers de seguranca.
- Nao ha rate limiting.
- Cookies de auth precisam endurecimento.
- CORS esta permissivo para defaults de localhost em producao.
- `voice_ai_service.py` decodifica audio sem teto claro.
- O `Dockerfile` roda como root.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/.env`
- `biodiagnostico_app/.gitignore`
- `biodiagnostico_app/nginx.conf`
- `biodiagnostico_app/rxconfig.py`
- `biodiagnostico_app/biodiagnostico_app/states/auth_state.py`
- `biodiagnostico_app/biodiagnostico_app/services/voice_ai_service.py`
- `biodiagnostico_app/Dockerfile`
- `biodiagnostico_app/migrations/005_fix_qc_records_rls.sql`
- `biodiagnostico_app/migrations/006_restrict_rls_policies.sql`

OBJETIVOS
1. Remover segredos reais do versionamento e criar `.env.example` seguro.
2. Definir um plano operacional de rotacao de chaves sem expor valores atuais.
3. Endurecer RLS de forma compativel com o modelo real do app.
4. Adicionar headers de seguranca no Nginx.
5. Implementar rate limiting de forma segura para login e endpoints sensiveis.
6. Endurecer cookies, CORS, upload/audio limits e container runtime.

FORMA DE EXECUCAO
1. Trate o problema de segredos primeiro. O codigo nao deve mais carregar valores reais do repo. Substitua apenas no versionamento e documente a rotacao operacional; nao publique chaves em lugar nenhum.
2. Audite o modelo real de autenticacao e ownership antes de apertar RLS. Se `user_id` nao existir em todas as tabelas, nao invente uma migracao destrutiva. Entregue a versao mais segura compativel agora e documente fase 2 se necessario.
3. Adicione headers como CSP proporcional ao app, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Strict-Transport-Security` quando fizer sentido no proxy de producao.
4. Adicione rate limiting sem quebrar uploads legitimos nem websocket.
5. Ajuste cookies de auth para `Secure`, `HttpOnly` e `SameSite` conforme suporte da stack.
6. Restrinja CORS para o dominio de producao e ambientes explicitamente permitidos.
7. Em `voice_ai_service.py`, aplique limite maximo de payload antes da decodificacao/uso.
8. Torne o container menos privilegiado, preferencialmente com usuario nao-root.

RESTRICOES
- Nao fazer rollback de dados.
- Nao trocar Supabase por outra stack.
- Nao quebrar login por endurecimento apressado.
- Nao usar CSP tao agressiva que mate o app sem validar fontes reais.

ENTREGAVEIS
- Correcao no versionamento de segredos.
- `.env.example`.
- Hardenings de proxy, auth, CORS e runtime.
- Migracao segura ou plano faseado para RLS.
- Instrucoes operacionais minimas para rotacao de chaves.

CRITERIOS DE ACEITE
- Nenhum segredo real comitado.
- Headers de seguranca presentes.
- Limites basicos de abuso implementados.
- RLS deixa de ser totalmente permissivo sem perder dados.
- Login e app continuam funcionais.
```

### Prompt de QA

```text
Voce e um auditor senior de seguranca. Sua tarefa e validar SOMENTE a area de SEGURANCA apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Nao exibir segredos reais na resposta.

CHECKLIST
1. Segredos
- Confirme que `.env` nao ficou com valores reais versionados como fonte do repo final.
- Verifique a existencia de `.env.example` com placeholders seguros.
- Confirme que nenhum segredo apareceu em docs, scripts, logs ou comentarios.

2. RLS e banco
- Leia as migracoes relevantes.
- Verifique se a nova abordagem deixou de usar politica totalmente permissiva.
- Confirme que nao ha migracao destrutiva nem perda de dados.
- Se o ownership completo nao foi implementado, avalie se a justificativa tecnica esta clara e segura.

3. Proxy e headers
- Leia `nginx.conf`.
- Confirme headers de seguranca coerentes com o app.
- Verifique rate limiting sem impacto em `/_event` e fluxos necessarios.

4. Auth, CORS e payloads
- Verifique flags de cookie.
- Confirme CORS mais restrito.
- Verifique limite de tamanho para audio/base64.

5. Runtime
- Leia `Dockerfile`.
- Confirme se o container passou a executar com menos privilegio ou se ha justificativa documentada.

FORMATO DO RELATORIO
- Liste vulnerabilidades remanescentes primeiro.
- Aponte severidade, evidencia e risco exploravel.
- Finalize com `Aprovado`, `Aprovado com ressalvas` ou `Reprovado`.
```

---

## 5. Qualidade do codigo

### Prompt resolutivo

```text
Voce e um engenheiro senior de arquitetura e qualidade de codigo. Sua tarefa e corrigir SOMENTE a area de QUALIDADE DO CODIGO do projeto Biodiagnostico 3.0 de forma incremental, sem big-bang refactor e sem regressao funcional.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao reescrever `qc_state.py` inteiro de uma vez.
- Nao trocar interfaces publicas sem compatibilidade.

CONTEXTO DA AUDITORIA
- `biodiagnostico_app/biodiagnostico_app/states/qc_state.py` esta monolitico.
- Ha muitos `except Exception`.
- Nao ha configuracao de lint/format padrao.
- `requirements.txt` usa versoes abertas demais.
- Ha duplicacao entre services.
- Existem campos deprecated em `models.py`.
- Cobertura de testes e baixa fora da logica analitica.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/biodiagnostico_app/states/qc_state.py`
- `biodiagnostico_app/biodiagnostico_app/models.py`
- `biodiagnostico_app/biodiagnostico_app/services/`
- `biodiagnostico_app/requirements.txt`
- Testes existentes em `biodiagnostico_app/` e `tests/`

OBJETIVOS
1. Introduzir uma base minima de qualidade automatizada.
2. Fazer refactor incremental do estado monolitico, extraindo responsabilidade de forma segura.
3. Substituir `except Exception` generico onde houver tratamento melhor definido e manter log adequado.
4. Pinar dependencias com criterio.
5. Reduzir duplicacao em services.
6. Remover ou isolar campos deprecated sem quebrar o app.
7. Aumentar cobertura em pontos criticos tocados.

FORMA DE EXECUCAO
1. Crie a fundacao primeiro: `pyproject.toml` ou configuracao equivalente para Ruff/formatacao, sem impor centenas de mudancas oportunistas.
2. Refatore `qc_state.py` por extracao de funcoes, mixins, helpers ou modulos menores, mantendo a API atual sempre que possivel.
3. Priorize os blocos tocados pela auditoria, especialmente carregamento de dados, persistencia e validacoes.
4. Troque `except Exception` por excecoes mais especificas onde for possivel agora; nos demais casos, melhore contexto de log e retorno.
5. Pinar dependencias com versoes estaveis e coerentes com o projeto.
6. Em services, crie abstracao apenas se reduzir duplicacao real, sem overengineering.
7. Adicione testes para o que foi modificado.

RESTRICOES
- Nao fazer reformatacao massiva do repo sem necessidade.
- Nao quebrar imports existentes.
- Nao remover campos deprecated sem verificar impacto de leitura e serializacao.

ENTREGAVEIS
- Configuracao de qualidade.
- Refactor incremental com escopo controlado.
- Testes novos ou ampliados.
- Lista objetiva do que permaneceu para uma fase futura.

CRITERIOS DE ACEITE
- Projeto passa a ter base minima de lint/format.
- `qc_state.py` fica menos concentrado nas areas tocadas.
- Erros ficam mais bem tratados.
- Dependencias mais previsiveis.
- Mudancas testadas e sem regressao.
```

### Prompt de QA

```text
Voce e um reviewer senior de engenharia focado em qualidade de codigo. Sua tarefa e validar SOMENTE a area de QUALIDADE DO CODIGO apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Priorize riscos de manutencao e regressao, nao estilo superficial.

CHECKLIST
1. Fundacao de qualidade
- Verifique configuracao de lint/format.
- Confirme que a configuracao e executavel e coerente com a stack.

2. Refactor seguro
- Leia os diffs em `qc_state.py` e arquivos extraidos.
- Verifique se houve reducao real de responsabilidade concentrada.
- Confirme que nao houve quebra de API interna importante.

3. Tratamento de erros
- Busque `except Exception` nas areas alteradas.
- Valide se houve melhoria real em excecoes especificas e logs.

4. Dependencias e modelos
- Verifique `requirements.txt`.
- Confirme que pinagem faz sentido.
- Revise `models.py` e impacto de campos deprecated.

5. Testes
- Verifique se novos testes cobrem o comportamento alterado.
- Aponte lacunas relevantes.

FORMATO DO RELATORIO
- Achados primeiro, ordenados por severidade.
- Cite arquivos e impacto pratico.
- Se a implementacao estiver boa mas incompleta, classifique como `Aprovado com ressalvas`.
```

---

## 6. UX e responsividade

### Prompt resolutivo

```text
Voce e um especialista senior em UX, responsividade e frontend para produtos internos. Sua tarefa e corrigir SOMENTE a area de UX E RESPONSIVIDADE do Biodiagnostico 3.0 preservando o design system ja existente, que foi avaliado como um dos pontos fortes do projeto.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Preserve o visual e o design system de `styles.py` e `components/ui.py`.
- Nao introduza solucoes visuais genericas que empobrecam a interface.

CONTEXTO DA AUDITORIA
- Esta foi a melhor area do projeto.
- Pontos de atencao principais: navegacao mobile, skeleton loading no dashboard e PWA sem offline real.
- A auditoria cita `mobile_nav()` vazio, mas o codigo atual ja possui `mobile_nav_trigger()` em `navbar.py`; valide isso antes de mexer.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/biodiagnostico_app/components/navbar.py`
- `biodiagnostico_app/biodiagnostico_app/pages/dashboard.py`
- `biodiagnostico_app/biodiagnostico_app/pages/login.py`
- `biodiagnostico_app/biodiagnostico_app/components/ui.py`
- `biodiagnostico_app/biodiagnostico_app/styles.py`
- `biodiagnostico_app/assets/manifest.json`

OBJETIVOS
1. Confirmar e corrigir, se necessario, a navegacao mobile.
2. Melhorar estados de carregamento com skeletons onde fizer diferenca.
3. Eliminar pequenos problemas de responsividade e toque, se existirem.
4. Avaliar a lacuna entre PWA instalavel e offline real, implementando apenas o que for seguro e de baixo risco em producao.

FORMA DE EXECUCAO
1. Verifique primeiro se o menu mobile atual ja resolve a necessidade principal. Se sim, nao duplique comportamento; ajuste apenas detalhes de UX e acessibilidade.
2. Adicione skeletons ou placeholders coerentes no dashboard e pontos de espera perceptiveis.
3. Revise breakpoints, overflow, espacos, largura de componentes e tap targets.
4. Se optar por Service Worker, faca isso apenas se houver baixo risco de cache stale e com estrategia clara de invalidação. Se o risco for alto, documente e deixe para fase futura.
5. Preserve empty states, loading states e componentes reutilizaveis ja bons.

RESTRICOES
- Nao transformar UX em um grande refactor visual.
- Nao adicionar offline cache agressivo sem estrategia de invalidacao.
- Nao quebrar navegacao existente.

ENTREGAVEIS
- Melhorias de UX responsiva realmente perceptiveis.
- Ajustes de loading.
- Registro do que era problema real versus item ja resolvido.

CRITERIOS DE ACEITE
- Mobile continua funcional e melhor ajustado.
- Dashboard mostra feedback de carregamento mais maduro.
- Nenhum overflow ou regressao visual importante nas telas principais.
```

### Prompt de QA

```text
Voce e um QA de UX e responsividade. Sua tarefa e validar SOMENTE a area de UX E RESPONSIVIDADE apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Compare a implementacao com a auditoria, apontando itens que ja estavam corretos.

CHECKLIST
1. Navegacao mobile
- Verifique o comportamento real do menu mobile.
- Confirme se houve melhoria ou se a auditoria original apontava um falso positivo parcial.

2. Loading e empty states
- Revise `dashboard.py` e componentes relacionados.
- Verifique se skeletons ou placeholders foram implementados com consistencia visual.

3. Responsividade
- Inspecione as paginas principais para breakpoints, overflow horizontal, alinhamento e tocabilidade.

4. PWA/offline
- Se houver Service Worker, valide estrategia de cache e risco de conteudo stale.
- Se nao houver implementacao, avalie se a justificativa esta adequada.

FORMATO DO RELATORIO
- Achados por severidade.
- Evidencia com arquivo.
- Veredito final e riscos residuais.
```

---

## 7. Infraestrutura e deploy

### Prompt resolutivo

```text
Voce e um engenheiro senior de plataforma, CI/CD e containers. Sua tarefa e corrigir SOMENTE a area de INFRAESTRUTURA E DEPLOY do Biodiagnostico 3.0, com mudancas seguras para um sistema ja em producao no Railway.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao fazer alteracoes que exijam parada longa sem justificativa.
- Nao introduzir pipeline impossivel de manter.

CONTEXTO DA AUDITORIA
- Sem CI/CD.
- Sem monitoramento de erros.
- `Dockerfile` single-stage e pesado.
- `start.sh` sem supervisao adequada.
- Possivel conflito entre `biodiagnostico_app/railway.json` e `railway.toml`.
- Health check superficial.
- Logging inconsistente.
- Migracoes espalhadas.

ARQUIVOS PARA LER PRIMEIRO
- `biodiagnostico_app/Dockerfile`
- `biodiagnostico_app/start.sh`
- `biodiagnostico_app/nginx.conf`
- `biodiagnostico_app/railway.json`
- `railway.toml`
- Estrutura de `biodiagnostico_app/migrations/` e SQLs soltos

OBJETIVOS
1. Criar uma base minima de CI com lint e testes.
2. Melhorar o container com multi-stage quando viavel.
3. Tornar o bootstrap do container mais robusto.
4. Resolver conflito de configuracoes do Railway.
5. Melhorar health check.
6. Introduzir monitoramento de erros de forma segura e configuravel.
7. Padronizar minimamente logging e documentar estrategia de migracoes.

FORMA DE EXECUCAO
1. Implemente um workflow simples e sustentavel em `.github/workflows/`, sem exagero.
2. Refatore o `Dockerfile` para separar build e runtime se isso de fato reduzir imagem e superficie de ataque.
3. Revise `start.sh` para lidar melhor com processos, sinais e falhas. Use estrategia simples e robusta.
4. Escolha uma fonte de verdade para config do Railway e documente.
5. Melhore o health check para validar app de forma mais util que apenas HTML estatico, sem bater em endpoints caros.
6. Adicione monitoramento de erros por feature flag ou env var, sem exigir segredo hardcoded.
7. Defina um padrao minimo de logging e organize o entendimento das migracoes existentes.

RESTRICOES
- Nao criar infra enterprise desnecessaria.
- Nao quebrar deploy atual.
- Nao mover todas as migracoes de uma vez se isso gerar risco alto.

ENTREGAVEIS
- CI minima funcional.
- Container/deploy mais robustos.
- Configuracao do Railway esclarecida.
- Monitoramento e logging basicos.
- Observacoes sobre o que ficou para uma fase 2.

CRITERIOS DE ACEITE
- Pipeline valida lint/test ou equivalente.
- Build e runtime do container ficam mais limpos.
- Health check faz mais sentido.
- Deploy continua possivel sem risco desnecessario.
```

### Prompt de QA

```text
Voce e um QA tecnico de plataforma e deploy. Sua tarefa e validar SOMENTE a area de INFRAESTRUTURA E DEPLOY apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Priorize confiabilidade operacional.

CHECKLIST
1. CI/CD
- Verifique existencia e coerencia de workflow em `.github/workflows/`.
- Confirme que os comandos fazem sentido para o repo.

2. Docker e start
- Revise `Dockerfile` e `start.sh`.
- Confirme melhoria real de bootstrap, sinais, tamanho ou seguranca.
- Aponte riscos de processo zumbi, crash silencioso ou dependencia desnecessaria.

3. Railway e health check
- Compare `biodiagnostico_app/railway.json` com `railway.toml`.
- Confirme se o conflito foi resolvido ou documentado.
- Verifique health check escolhido.

4. Observabilidade
- Confirme se monitoramento e logging foram introduzidos de forma segura e opcional.

5. Migracoes
- Verifique se a documentacao/organizacao melhorou sem gerar mudanca arriscada.

FORMATO DO RELATORIO
- Achados primeiro, por severidade.
- Evidencia com arquivos.
- Veredito final e risco operacional residual.
```

---

## 8. Boas praticas gerais

### Prompt resolutivo

```text
Voce e um engenheiro senior de sustentabilidade de projeto e hygiene de repositorio. Sua tarefa e corrigir SOMENTE a area de BOAS PRATICAS GERAIS do Biodiagnostico 3.0, melhorando onboarding, governanca minima e organizacao do repo sem mexer em dados de producao.

REGRAS INEGOCIAVEIS
- O site ja esta em producao.
- Nao remover dados.
- Nao apagar arquivos aparentemente soltos sem antes verificar se sao usados.
- Mudancas devem melhorar clareza do repo e onboarding.

CONTEXTO DA AUDITORIA
- Falta `.env.example`.
- Falta licenca.
- Falta changelog/versionamento mais claro.
- Existem arquivos de debug/teste soltos na raiz.
- O README ja e bom e deve ser preservado.

ARQUIVOS PARA LER PRIMEIRO
- `README.md`
- `.gitignore`
- Arquivos soltos na raiz, especialmente scripts de debug/teste
- Qualquer documentacao relacionada a setup e deploy

OBJETIVOS
1. Criar `.env.example` alinhado com as envs reais necessarias, sem valores sensiveis.
2. Adicionar licenca apropriada, se a decisao couber ao escopo; se nao couber, deixar template pronto e documentar a dependencia de decisao do dono.
3. Organizar versionamento/changelog minimo.
4. Tirar scripts soltos da raiz ou ao menos agrupá-los com seguranca.
5. Preservar e, se necessario, ajustar README e docs existentes.

FORMA DE EXECUCAO
1. Levante as env vars reais usadas no app e gere `.env.example` consistente.
2. Se a licenca puder ser adicionada com seguranca, faca isso; caso contrario, deixe uma proposta clara e documentada sem assumir juridicamente algo indevido.
3. Crie `CHANGELOG.md` ou estrutura equivalente, aproveitando o que ja existe de `CHANGELOG_DESIGN.md` sem conflitar.
4. Revise scripts soltos como `aspirar.py`, `check_gemini3.py`, `debug_gemini.py`, `debug_gemini_analysis.py`, `verify_mapping.py` e semelhantes. Antes de mover, confirme que nao sao importados por nada. Se mover, atualize caminhos e documentacao.
5. Organize sem destruir historico nem quebrar comandos existentes.

RESTRICOES
- Nao apagar arquivos so porque parecem antigos.
- Nao criar documentacao falsa ou genérica.
- Nao duplicar changelogs sem necessidade.

ENTREGAVEIS
- `.env.example`.
- Melhoria de hygiene do repo.
- Estrutura minima de changelog/licenca.
- Documentacao clara do que foi decidido ou do que depende do dono do projeto.

CRITERIOS DE ACEITE
- Novo dev entende quais envs precisa.
- Repo fica mais organizado.
- Nao houve quebra por mover scripts.
- README e docs continuam coerentes.
```

### Prompt de QA

```text
Voce e um QA de governanca tecnica e hygiene de repositorio. Sua tarefa e validar SOMENTE a area de BOAS PRATICAS GERAIS apos a implementacao no Biodiagnostico 3.0.

REGRAS
- Nao alterar codigo.
- Nao remover dados.
- Verifique utilidade pratica, nao apenas existencia de arquivos.

CHECKLIST
1. `.env.example`
- Confirme que ele existe.
- Verifique se cobre as env vars relevantes sem expor segredos.

2. Licenca e changelog
- Verifique se ha licenca adequada ou decisao claramente documentada.
- Verifique se o changelog nao conflita com arquivos preexistentes e se e util.

3. Organizacao do repo
- Revise scripts antes soltos na raiz.
- Confirme que qualquer movimento de arquivo preservou funcionamento e docs.

4. README e docs
- Verifique se continuam consistentes com a estrutura final.

FORMATO DO RELATORIO
- Achados primeiro, com severidade e evidencia.
- Depois itens aprovados.
- Finalize com veredito e pendencias do tipo decisao do owner, se houver.
```

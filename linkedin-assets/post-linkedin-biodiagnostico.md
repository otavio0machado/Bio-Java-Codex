# Post LinkedIn - Biodiagnóstico

## Texto principal

Desde fevereiro, venho acompanhando de perto o dia a dia de um laboratório de análises clínicas da minha cidade natal.

Foi nesse contato com a operação real que encontrei um problema claro:

o controle de qualidade ainda dependia de muitos processos manuais, consultas dispersas e geração burocrática de relatórios.

Então desenvolvi e implantei uma solução própria para organizar o setor laboratorial responsável por:

- Controle de Qualidade;
- gestão de reagentes;
- manutenção de equipamentos;
- padronização de relatórios executivos;
- evidências enviadas à vigilância sanitária.

O sistema foi construído em Java/Spring Boot e React.

E, mais importante do que a stack, ele foi construído a partir da rotina real do laboratório.

Hoje o app já está em produção e tenho recebido feedbacks muito positivos, principalmente sobre facilidade de uso e desburocratização da geração de relatórios.

Algumas funções que desenvolvi:

- dashboard operacional com indicadores e alertas;
- registro de Controle de Qualidade por área;
- cálculo de CV, média, desvio padrão e status do CQ;
- aplicação de regras Westgard;
- gráficos de Levey-Jennings para análise de tendência e dispersão;
- cadastro de referências por exame, lote, validade e nível de controle;
- gestão de reagentes, estoque, validade e rastreabilidade;
- controle de manutenção de equipamentos;
- relatórios executivos padronizados;
- histórico e evidências para auditoria;
- recursos com IA para aumentar produtividade e reduzir retrabalho.

Esse projeto me posiciona muito bem como engenheiro porque ele não é só um CRUD.

É software aplicado a um domínio crítico.

No laboratório, um registro de CQ não é apenas um número lançado na tela.

Ele carrega contexto:

- exame;
- data;
- lote;
- nível de controle;
- equipamento;
- analista;
- referência;
- média;
- desvio padrão;
- CV;
- status;
- violações Westgard;
- gráficos de Levey-Jennings para acompanhar tendência e dispersão;
- evidência para auditoria.

Por isso, o desafio não era apenas criar telas.

Era transformar uma rotina sensível em um produto simples de usar, rastreável e operacionalmente confiável.

Também tomei cuidado para que os fluxos respeitassem os POPs internos do laboratório e facilitassem a organização das evidências normalmente exigidas em processos de fiscalização e vigilância sanitária.

Para mim, esse é o tipo de tecnologia que faz sentido:

software que entende o processo, reduz fricção e aumenta a confiança de quem opera.

Nas imagens abaixo, usei dados fictícios apenas para demonstração visual.

Mas o produto é real, está em uso e nasceu de uma necessidade real.

E aí, o que achou?

O que você considera indispensável em um sistema usado em rotinas críticas de saúde?

#Java #SpringBoot #React #HealthTech #ControleDeQualidade #SoftwareEngineering

## Ordem das imagens

1. `01-dashboard.png`
   - Dashboard operacional: taxa de aprovação, CQ do dia/mês, alertas ativos e registros recentes.
2. `02-registro-cq.png`
   - Registro de CQ: lançamento diário, CV%, status, necessidade de calibração, histórico por data e acesso aos gráficos de Levey-Jennings.
3. `03-referencias-cq.png`
   - Referências: alvo, desvio padrão, validade e base para o preenchimento controlado dos registros.
4. `04-relatorios.png`
   - Relatórios: catálogo de artefatos oficiais, assinatura e rastreabilidade documental.

## Comentario opcional

As imagens usam dados fictícios para demonstração visual. A prioridade da migração é preservar regra de negócio, segurança operacional e auditabilidade.

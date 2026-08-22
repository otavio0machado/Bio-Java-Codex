// ==============================================================================
// HEXXON SOFTWARE HOUSE - PLANO ESTRATÉGICO DE 6 MESES
// Documento Oficial de Fundação, Unbundling e Go-To-Market
// ==============================================================================

#set document(
  title: "Hexxon Software House - Plano Estratégico de 6 Meses",
  author: "Otavio Machado",
  keywords: ("Hexxon", "HealthTech", "SaaS", "Controle de Qualidade", "Laboratório", "Planejamento Estratégico")
)

// Definição de Cores Oficiais da Marca Hexxon
#let hexxon-purple-dark = rgb("#3B0764")   // Roxo Profundo
#let hexxon-purple = rgb("#581C87")        // Roxo Primário
#let hexxon-purple-light = rgb("#9333EA")  // Roxo Vibrante
#let hexxon-purple-subtle = rgb("#F3E8FF") // Roxo Fundo/Highlight

#let hexxon-green-dark = rgb("#14532D")    // Verde Musgo Profundo
#let hexxon-green = rgb("#2D5A27")         // Verde Musgo Oficial
#let hexxon-green-light = rgb("#4D7C0F")   // Verde Folha/Accent
#let hexxon-green-subtle = rgb("#ECFDF5")  // Verde Fundo/Highlight

#let text-dark = rgb("#0F172A")            // Slate 900
#let text-muted = rgb("#475569")           // Slate 600
#let bg-gray = rgb("#F8FAFC")              // Slate 50
#let border-gray = rgb("#E2E8F0")          // Slate 200

// Configuração Global de Página
#set page(
  paper: "a4",
  margin: (x: 2cm, top: 2.5cm, bottom: 2.5cm),
  header: context {
    let page_num = counter(page).get().first()
    if page_num > 1 {
      grid(
        columns: (1fr, auto),
        align(left)[
          #text(size: 8.5pt, weight: "bold", fill: hexxon-purple)[HEXXON SOFTWARE HOUSE]
          #text(size: 8.5pt, fill: text-muted)[ | Health-Tech & Lab Solutions]
        ],
        align(right)[
          #text(size: 8.5pt, fill: text-muted)[Plano Diretor 6 Meses — Confidencial]
        ]
      )
      v(1mm)
      line(length: 100%, stroke: 0.5pt + border-gray)
    }
  },
  footer: context {
    let page_num = counter(page).get().first()
    if page_num > 1 {
      line(length: 100%, stroke: 0.5pt + border-gray)
      v(2mm)
      grid(
        columns: (1fr, auto),
        align(left)[
          #text(size: 8pt, fill: text-muted)[Hexxon Tech © 2026 — Estratégia de Fundação e 1º Contrato]
        ],
        align(right)[
          #text(size: 8.5pt, weight: "bold", fill: hexxon-purple)[Página #page_num]
        ]
      )
    }
  }
)

#set text(
  font: ("Avenir", "Helvetica", "Arial"),
  size: 10pt,
  fill: text-dark,
  lang: "pt"
)

#set par(
  justify: true,
  leading: 0.75em,
  spacing: 1.2em
)

// Desativa justificação dentro de tabelas para evitar espaçamentos irregulares
#show table.cell: set par(justify: false)

// Funções de Estilização e Componentes Visuais
#let callout(title: "", body, border-color: hexxon-purple, bg-color: hexxon-purple-subtle, icon: "💡") = {
  rect(
    width: 100%,
    radius: 6pt,
    fill: bg-color,
    stroke: (left: 3.5pt + border-color, rest: 0.5pt + border-gray),
    inset: (x: 14pt, y: 12pt),
    outset: 0pt,
    [
      #if title != "" [
        #text(weight: "bold", size: 10.5pt, fill: border-color)[#icon #title]
        #v(4pt)
      ]
      #text(size: 9.5pt, fill: text-dark)[#body]
    ]
  )
}

#let badge(label, color: hexxon-purple, bg: hexxon-purple-subtle) = {
  box(
    radius: 3pt,
    fill: bg,
    inset: (x: 6pt, y: 2.5pt),
    baseline: 0%,
    text(size: 8pt, weight: "bold", fill: color)[#label]
  )
}

#let metric-card(title, value, subtext, color: hexxon-purple) = {
  rect(
    width: 100%,
    radius: 6pt,
    fill: white,
    stroke: 1pt + border-gray,
    inset: 12pt,
    [
      #text(size: 8.5pt, weight: "bold", fill: text-muted)[#upper(title)]
      #v(2pt)
      #text(size: 16pt, weight: "bold", fill: color)[#value]
      #v(1pt)
      #text(size: 8pt, fill: text-muted)[#subtext]
    ]
  )
}

// ==============================================================================
// CAPA DO DOCUMENTO
// ==============================================================================

#align(center)[
  #v(1cm)
  
  // Badge Superior
  #badge("DOCUMENTO ESTRATÉGICO EXECUTIVO", color: hexxon-purple, bg: hexxon-purple-subtle)
  
  #v(0.6cm)
  
  // Título Principal
  #text(size: 30pt, weight: "bold", fill: hexxon-purple-dark)[HEXXON] \
  #text(size: 14pt, weight: "medium", fill: hexxon-green)[SOFTWARE HOUSE EM SAÚDE & DIAGNÓSTICO]
  
  #v(0.3cm)
  
  #text(size: 11pt, style: "italic", fill: text-muted)[
    "Extinguindo a experiência jurássica dos softwares em saúde através de design de elite e precisão científica."
  ]
  
  #v(0.6cm)
  
  // Imagem do Mascote Oficial
  #rect(
    radius: 12pt,
    stroke: 2pt + hexxon-purple,
    fill: white,
    inset: 6pt,
    image("assets/hexxon_mascot_dino.jpg", width: 8.5cm)
  )
  
  #v(0.4cm)
  
  #text(size: 9pt, weight: "bold", fill: hexxon-green)[
    Mascote Oficial: Dr. Rexx — O Cientista do Futuro
  ]
  
  #v(0.8cm)
  
  // Bloco de Informações da Capa
  #rect(
    width: 100%,
    radius: 8pt,
    fill: bg-gray,
    stroke: 1pt + border-gray,
    inset: 12pt,
    [
      #grid(
        columns: (1fr, 1fr, 1fr),
        align: center,
        [
          #text(size: 8pt, weight: "bold", fill: text-muted)[HORIZONTE TEMPORAL] \
          #text(size: 10pt, weight: "bold", fill: hexxon-purple)[6 Meses (Ago–Dez 2026)]
        ],
        [
          #text(size: 8pt, weight: "bold", fill: text-muted)[META PRINCIPAL] \
          #text(size: 10pt, weight: "bold", fill: hexxon-green-dark)[1º Contrato Fechado]
        ],
        [
          #text(size: 8pt, weight: "bold", fill: text-muted)[FUNDADOR] \
          #text(size: 10pt, weight: "bold", fill: text-dark)[Otavio Machado]
        ]
      )
    ]
  )
]

#pagebreak()

// ==============================================================================
// SUMÁRIO EXECUTIVO & TESE DE NEGÓCIO
// ==============================================================================

= 1. Sumário Executivo & Tese de Fundação

A *Hexxon* nasce com uma missão clara e sem concessões: *revolucionar o ecossistema de softwares de saúde, laboratórios e clínicas*, substituindo sistemas legados feios, lentos, contra-intuitivos e burocráticos por produtos de altíssima eficiência operacional, design de nível mundial e segurança clínica inegociável.

#v(0.3cm)

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 12pt,
  metric-card("Meta de 6 Meses", "1º Contrato", "Cliente pagante até dez/2026", color: hexxon-purple),
  metric-card("Vantagem Injusta", "Lab Sandbox", "Laboratório do pai como piloto", color: hexxon-green-dark),
  metric-card("Diferencial Moat", "Design de Elite", "Frontend como motor de vendas", color: hexxon-purple-light)
)

#v(0.4cm)

== 1.1. O Diagnóstico do Mercado: "O Efeito Dinossauro"
O mercado de software laboratorial (LIS/ERP) no Brasil movimenta centenas de milhões de reais, mas sofre de uma estagnação tecnológica crônica:
- *95% dos sistemas atuais* (antigos líderes de mercado) possuem interfaces estagnadas no visual de Windows 98/2000, gerando alta fadiga visual nos biomédicos e operadores.
- Softwares monolíticos, caros, engessados e lentos para implementar.
- Módulos críticos — como *Controle de Qualidade (CQ), Gráficos de Levey-Jennings, Gestão de Equipamentos e Validade de Lotes* — são frequentemente negligenciados ou tratados em planilhas manuais de Excel paralelas, gerando risco severo de não-conformidade em auditorias (PNCQ / Controllab / PALC).

== 1.2. O Posicionamento Estratégico da Hexxon
A Hexxon se posiciona como uma *Software House Especializada em Saúde & Hub de Micro-SaaS Modulares*. Em vez de tentar vender um ERP gigante de R\$ 100.000 que leva 12 meses para implantar, a Hexxon opera através da estratégia de *Unbundling*:
1. *Entrada Cirúrgica*: Vendemos micro-produtos ultra especializados que resolvem a dor que o ERP não resolve (ex: Gestão de CQ com Westgard automatizado em tempo real).
2. *Setup Instantâneo*: Implementação em menos de 48 horas, sem atrito com o TI do cliente.
3. *Encantamento Visual Instantâneo*: Uma interface tão moderna, fluida e elegante que o tomador de decisão (proprietário/diretor técnico) e o operador se recusam a voltar para a planilha ou sistema legado.

#callout(title: "A Vantagem Desleal do Fundador (Unfair Advantage)", [
  - *Ambiente de Validação Real Imediato*: O laboratório do seu pai funciona como uma incubadora/sandbox viva para testes de usabilidade, validação de regras com biomédicos reais e geração de métricas de caso de sucesso.
  - *Rede de Relacionamento (Warm Outreach)*: Acesso direto a proprietários de laboratórios regionais, associações (SBAC, sindicatos de laboratórios) e fornecedores de diagnósticos através da autoridade do seu pai.
  - *Senso Estético & Domínio Frontend*: Capacidade de criar produtos visuais com estética premium, microinterações e velocidade que agências tradicionais e empresas legadas não conseguem replicar.
])

#pagebreak()

// ==============================================================================
// IDENTIDADE DE MARCA & BRANDING
// ==============================================================================

= 2. Identidade de Marca, Branding & Storytelling

A identidade da Hexxon foi concebida para romper intencionalmente com o padrão monótono do mercado de saúde (o azul-hospitalar genérico e branco asséptico). Criamos uma marca com personalidade magnética, autoridade científica e sofisticação tech.

#v(0.3cm)

== 2.1. Paleta de Cores Não-Convencional

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  rect(
    width: 100%,
    radius: 6pt,
    fill: hexxon-purple-subtle,
    stroke: 1pt + hexxon-purple,
    inset: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: hexxon-purple)[🟣 Roxo Hexxon (`#581C87` / `#9333EA`)]
      #v(4pt)
      - *Significado*: Sofisticação, tecnologia avançada, disrupção e inteligência analítica.
      - *Aplicação*: Acentos principais, botões de ação (CTA), estados ativos, gráficos de destaque e marca institucional.
      - *Contraste*: Destaca a Hexxon imediatamente de qualquer concorrente tradicional.
    ]
  ),
  rect(
    width: 100%,
    radius: 6pt,
    fill: hexxon-green-subtle,
    stroke: 1pt + hexxon-green,
    inset: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: hexxon-green-dark)[🟢 Verde Musgo (`#2D5A27` / `#4D7C0F`)]
      #v(4pt)
      - *Significado*: Saúde orgânica, precisão biológica, estabilidade e conformidade laboratorial.
      - *Aplicação*: Indicadores de conformidade (Quality Pass), badges de segurança, fundos secundários e relatórios clínicos.
      - *Harmonia*: Equilíbrio visual nobre quando combinado com o roxo escuro.
    ]
  )
)

#v(0.4cm)

== 2.2. O Mascote Oficial: "Dr. Rexx" — O Dinossauro Cientista
O mascote da Hexxon não é um simples elemento decorativo; ele é a *metáfora central do posicionamento de mercado da empresa*:

#callout(title: "O Storytelling do Mascote", icon: "🦖", border-color: hexxon-green, bg-color: hexxon-green-subtle, [
  *A Ironia Estratégica*: O mercado de softwares em saúde é dominado por "empresas dinossauros" — sistemas jurássicos, lentos e parados no tempo. 
  
  O *Dr. Rexx* subverte essa lógica: ele é um pequeno dinossauro genial, hipertecnológico, que veste um jaleco branco impecável e usa óculos inteligentes. Ele simboliza que a Hexxon domina tanto a ciência tradicional de bancada quanto as tecnologias mais avançadas de engenharia de software e inteligência artificial.
  
  *Utilização Prática*:
  - *No Produto*: Aparece em estados vazios (empty states), tutoriais interativos de onboarding e alertas de sucesso ("Parabéns, lote calibrado com sucesso!").
  - *No Marketing*: Protagonista de vídeos curtos no LinkedIn e Instagram com o gancho: *"Seu laboratório ainda usa software da época dos dinossauros?"*.
])

== 2.3. O "Frontend Moat" (O Design como Diferencial Competitivo)
Em B2B de saúde, os tomadores de decisão muitas vezes não entendem a arquitetura do backend (Java/Spring Boot), mas são *instantaneamente impactados pela interface*:
- *Velocidade perceptível*: Transições fluidas (60fps), sem recarregamento de página.
- *Gráficos Interativos*: Levey-Jennings com zoom dinâmico, linhas de desvio padrão (±1s, ±2s, ±3s) e detecção de regras Westgard destacadas por cores intuitivas.
- *Responsividade Real*: Acesso fluido tanto no computador da bancada técnica quanto no iPad ou smartphone do proprietário do laboratório.

#pagebreak()

// ==============================================================================
// MATRIZ DE PRODUTOS & UNBUNDLING
// ==============================================================================

= 3. Matriz de Produtos: O "Unbundling" do Biodiagnóstico

O projeto atual em desenvolvimento (`biodiagnostico-api` e `biodiagnostico-web`) contém uma riqueza impressionante de motores de negócio já construídos. Em vez de lançar tudo como um pacote único e indivisível, a Hexxon irá modularizá-lo em *4 frentes de produto altamente rentáveis*:

#v(0.3cm)

#table(
  columns: (1.1fr, 2.5fr, 1.1fr, 0.9fr),
  stroke: 0.5pt + border-gray,
  fill: (x, y) => if y == 0 { hexxon-purple-subtle } else if calc.even(y) { bg-gray } else { white },
  align: (col, row) => if row == 0 { center } else if col == 0 { left } else { left },
  
  [#text(weight: "bold", fill: hexxon-purple)[Produto]],
  [#text(weight: "bold", fill: hexxon-purple)[Escopo & Módulos Java/React]],
  [#text(weight: "bold", fill: hexxon-purple)[Modelo Comercial]],
  [#text(weight: "bold", fill: hexxon-purple)[Prioridade]],
  
  [
    *Hexxon QC*\
    #badge("Flagship SaaS", color: hexxon-purple, bg: hexxon-purple-subtle)
  ],
  [
    - Motor Westgard (`WestgardEngine.java`)\
    - Gráficos Levey-Jennings (`LeveyJenningsChart.tsx`)\
    - Detector de Deriva/Drift (`DriftDetector.java`)\
    - Importação de Lotes PNCQ / Controllab\
    - Relatórios PDF de Auditoria em 1 Clique
  ],
  [
    Assinatura Mensal\
    (R\$ 490 a R\$ 1.290 / mês)
  ],
  [
    #badge("MÊS 1-2", color: hexxon-green-dark, bg: hexxon-green-subtle)\
    *Carro-chefe*
  ],
  
  [
    *Hexxon Maintain*\
    #badge("Micro-SaaS Ops", color: hexxon-green-dark, bg: hexxon-green-subtle)
  ],
  [
    - Gestão de Equipamentos (`MaintenanceService.java`)\
    - Ordens de Serviço & Checklists de Bancada\
    - QR Code colado no analisador físico\
    - Controle de MTBF, MTTR e Calibração
  ],
  [
    Assinatura Mensal\
    (R\$ 350 a R\$ 750 / mês)
  ],
  [
    #badge("MÊS 3-4", color: hexxon-purple, bg: hexxon-purple-subtle)\
    *Cross-sell*
  ],
  
  [
    *Hexxon Reagents*\
    #badge("Estoque Crítico", color: text-muted, bg: border-gray)
  ],
  [
    - Gestão de Reagentes (`ReagentService.java`)\
    - Rastreabilidade de Lote, Frasco Aberto e Validade\
    - Previsão de Ruptura de Estoque por Testes
  ],
  [
    Módulo Adicional\
    (R\$ 290 a R\$ 490 / mês)
  ],
  [
    #badge("MÊS 5", color: text-muted, bg: border-gray)\
    *Expansão*
  ],
  
  [
    *Hexxon Studio*\
    #badge("Software House", color: hexxon-purple-dark, bg: hexxon-purple-subtle)
  ],
  [
    - Desenvolvimento Sob Demanda para Saúde\
    - Integrações HL7 / ASTM com analisadores\
    - Portais de Laudos & Aplicativos Personalizados\
    - Dashboards com IA (`AiService.java`)
  ],
  [
    Contrato Fechado\
    (R\$ 8.000 a R\$ 35.000 / projeto)
  ],
  [
    #badge("CONTÍNUO", color: hexxon-purple-dark, bg: hexxon-purple-subtle)\
    *High Ticket*
  ]
)

#v(0.4cm)

== 3.1. Por que o "Hexxon QC" é o Melhor Produto para Fechar o 1º Contrato?
1. *Dor Urgente e Regulatória*: Todo laboratório clínico é obrigado por lei (RDC da ANVISA e acreditação PALC/PNCQ) a registrar controle de qualidade diário.
2. *Mercado Mal Atendido*: A maioria dos laboratórios faz isso em planilhas manuais ou em módulos horríveis e engessados dentro do LIS principal.
3. *Fácil de Vender e Implantar*: Não exige a troca do ERP do laboratório. O Hexxon QC entra como uma camada complementar de alta sofisticação que o biomédico adora usar.
4. *Demonstração Visual Acachapante*: Em uma chamada de vídeo ou visita presencial de 15 minutos, a tela do Levey-Jennings interativo com regras Westgard piscando na hora vende o produto por si só.

#pagebreak()

// ==============================================================================
// PLANO TÁTICO DE 6 MESES (CRONOGRAMA WBS)
// ==============================================================================

= 4. Cronograma Tático de 6 Meses (Agosto a Dezembro 2026)

Este cronograma foi desenhado com disciplina militar de engenharia e vendas. Cada mês possui um objetivo central inegociável, entregáveis claros e critérios de pronto (*Definition of Done*).

#v(0.3cm)

== 4.1. Visão Geral dos 6 Meses

#table(
  columns: (1fr, 2.5fr, 1.5fr),
  stroke: 0.5pt + border-gray,
  fill: (x, y) => if y == 0 { hexxon-purple-subtle } else if calc.even(y) { bg-gray } else { white },
  
  [#text(weight: "bold", fill: hexxon-purple)[Mês]],
  [#text(weight: "bold", fill: hexxon-purple)[Foco Estratégico & Engenharia]],
  [#text(weight: "bold", fill: hexxon-purple)[Marco de Sucesso (Milestone)]],
  
  [*Mês 1 (Ago/Set)*],
  [Finalização do app atual + Homologação em Produção no laboratório do pai],
  [App rodando 100% liso em bancada real],
  
  [*Mês 2 (Set/Out)*],
  [Unbundling do Hexxon QC + Landing Page + Design System & Branding],
  [Micro-SaaS standalone empacotado],
  
  [*Mês 3 (Out)*],
  [Operação Piloto no Pai + Geração de Dados de Caso de Sucesso + Kit B2B],
  [Vídeo Demo + Deck de Vendas + Proposta],
  
  [*Mês 4 (Out/Nov)*],
  [Go-To-Market: Prospecção de 30-40 laboratórios via rede do pai],
  [5 Demonstrações Executivas agendadas],
  
  [*Mês 5 (Nov/Dez)*],
  [Condução de 3 PoCs (Pilotos Gratuitos de 30 dias com acompanhamento VIP)],
  [3 laboratórios usando ativamente],
  
  [*Mês 6 (Dez)*],
  [*Fechamento do 1º Contrato Pagante* + Onboarding + Fundação Formal Hexxon],
  [*CONTRATO ASSINADO & RECORRÊNCIA*]
)

#v(0.5cm)

== 4.2. Detalhamento Semana a Semana

=== 📅 MÊS 1: Conclusão do Biodiagnóstico & Validação Alpha no Pai
- *Semana 1-2 (Engenharia)*:
  - Finalizar migração de relatórios PDF v2 (`PdfReportService.java` / `ManutencaoKpiGenerator.java`).
  - Auditar engine de Westgard (`WestgardEngine.java`) com os dados reais de CQ do laboratório do pai.
  - Testes de ponta a ponta: Cadastro de lotes, registro de corridas analíticas e exportação de relatórios.
- *Semana 3-4 (Operação em Bancada)*:
  - Deploy local/cloud da versão estável no laboratório do pai.
  - Treinamento presencial dos biomédicos e técnicos da bancada.
  - Identificação de pequenas arestas de usabilidade e refinamento instantâneo.
  - *Critério de Saída*: O laboratório do pai utiliza o sistema diariamente sem falhas bloqueantes.

=== 📅 MÊS 2: Unbundling Técnico & Construção da Máquina Visual Hexxon
- *Semana 5-6 (Arquitetura & Multi-Tenancy)*:
  - Isolar o módulo de Controle de Qualidade no repositório `hexxon-qc` (ou branch modular com isolamento de tenant).
  - Configurar provisionamento rápido (Docker Compose / Railway / Neon DB) para novos clientes.
- *Semana 7-8 (Design, Branding & Landing Page)*:
  - Implementar o Design System Hexxon (Tailwind CSS, Paleta Roxo + Verde Musgo, Dr. Rexx).
  - Publicar a Landing Page institucional `hexxon.com.br` com demonstração interativa em vídeo e botão de "Solicitar Demonstração VIP".
  - *Critério de Saída*: Hexxon QC funcional como produto independente e página no ar com design impecável.

#pagebreak()

=== 📅 MÊS 3: Geração do Caso de Estudo Real & Kit Comercial B2B
- *Semana 9-10 (Métricas de Sucesso no Lab do Pai)*:
  - Coleta de dados reais após 30 dias de uso:
    - *Tempo gasto*: Redução de 70% no preenchimento de planilhas de CQ.
    - *Segurança*: 100% de alertas Westgard identificados antes da liberação de laudos.
    - *Auditoria*: Relatório mensal de auditoria gerado em 3 segundos.
- *Semana 11-12 (Kit de Vendas Irresistível)*:
  - Gravação de um *Product Tour em Vídeo de 3 minutos* (voz profissional, foco na beleza e simplicidade da tela).
  - Elaboração da Proposta Comercial Executiva (PDF padrão Hexxon) e Minuta Contratual de SaaS.
  - *Critério de Saída*: Deck de apresentação pronto e dados reais provando que o sistema funciona.

=== 📅 MÊS 4: Go-To-Market & Prospecção com o "Efeito Rede do Pai"
- *Semana 13-14 (Mapeamento & Alinhamento Estratégico com o Pai)*:
  - Reunião de alinhamento com o pai para listar 30 a 50 contatos de donos de laboratórios, diretores técnicos e colegas de sindicatos/associações.
  - Estruturação da mensagem de introdução quente (*Warm Referral*).
- *Semana 15-16 (Disparo de Abordagens Consultivas)*:
  - Envio de mensagens personalizadas com o link do vídeo demonstrativo.
  - Gancho de abordagem: *"Meu filho desenvolveu um software moderno de CQ que eliminou as planilhas do meu laboratório. Quero te mostrar em 10 minutos sem compromisso"*.
  - *Critério de Saída*: No mínimo 5 reuniões de demonstração online ou presenciais agendadas.

=== 📅 MÊS 5: Demonstrações, Provas de Conceito (PoCs) e Negociação
- *Semana 17-18 (Execução das Demonstrações)*:
  - Condução das apresentações focando no choque visual (a tela moderna do Hexxon vs a planilha/sistema antigo deles).
  - Oferta da *"PoC VIP Hexxon"*: *30 dias de uso gratuito assistido*, com importação de dados e treinamento sem custo para 3 laboratórios selecionados.
- *Semana 19-20 (Acompanhamento e Coleta de Feedback)*:
  - Acompanhamento semanal com os biomédicos desses 3 laboratórios.
  - Ajuste de pequenos pedidos locais de configuração.
  - *Critério de Saída*: Ao menos 2 laboratórios com a equipe técnica apaixonada pelo sistema e dependente dele na rotina.

=== 📅 MÊS 6: Fechamento do 1º Contrato Pagante & Formalização
- *Semana 21-22 (Fechamento Comercial & Assinatura)*:
  - Apresentação da proposta comercial formal no final dos 30 dias de teste.
  - Condição especial de "Cliente Fundador" (desconto no setup em troca de contrato anual com fidelidade).
  - *Assinatura do 1º contrato recorrente fechado (Meta atingida!)*.
- *Semana 23-24 (Formalização & Planejamento de Escala 2027)*:
  - Abertura de CNPJ da Hexxon (se ainda não formalizado) e emissão de notas fiscais.
  - Configuração do gateway de pagamento recorrente (Asaas / Stripe / Iugu).
  - Roadmap para lançamento do segundo produto (*Hexxon Maintain*) no 1º trimestre do ano seguinte.

#pagebreak()

// ==============================================================================
// ESTRATÉGIA COMERCIAL & PRECIFICAÇÃO
// ==============================================================================

= 5. Estratégia Comercial, Precificação & Playbook de Vendas

A estratégia comercial da Hexxon não depende de "marketing de esperança", mas de um processo consultivo de alta conversão baseado em autoridade médica, prova social e beleza visual.

#v(0.3cm)

== 5.1. Estrutura de Precificação (Pricing Tiers)

#table(
  columns: (1.5fr, 1.2fr, 1.2fr, 2.1fr),
  stroke: 0.5pt + border-gray,
  fill: (x, y) => if y == 0 { hexxon-purple-subtle } else if calc.even(y) { bg-gray } else { white },
  
  [#text(weight: "bold", fill: hexxon-purple)[Plano Hexxon QC]],
  [#text(weight: "bold", fill: hexxon-purple)[Mensalidade]],
  [#text(weight: "bold", fill: hexxon-purple)[Setup / Implantação]],
  [#text(weight: "bold", fill: hexxon-purple)[Recursos Inclusos]],
  
  [
    *Starter Lab*\
    #text(size: 8pt, fill: text-muted)[Laboratórios Pequenos / Postos]
  ],
  [
    *R\$ 490* / mês
  ],
  [
    R\$ 600
  ],
  [
    - Até 3 Analisadores/Bancadas\
    - Westgard Engine Completo\
    - Relatórios PDF mensais ilimitados\
    - Suporte via WhatsApp
  ],
  
  [
    *Professional Lab*\
    #badge("MAIS POPULAR", color: hexxon-purple, bg: hexxon-purple-subtle)\
    #text(size: 8pt, fill: text-muted)[Laboratórios Médios / Regionais]
  ],
  [
    *R\$ 890* / mês
  ],
  [
    R\$ 1.200
  ],
  [
    - Até 8 Analisadores/Bancadas\
    - Detecção Automática de Drift\
    - Módulo PNCQ / Controllab Integrado\
    - 1 Sessão de Treinamento ao Vivo
  ],
  
  [
    *Enterprise Network*\
    #text(size: 8pt, fill: text-muted)[Redes & Hospitais]
  ],
  [
    *R\$ 1.690+* / mês
  ],
  [
    R\$ 2.500
  ],
  [
    - Analisadores Ilimitados + Unidades\
    - Integração de Importação HL7/ASTM\
    - SLA de Suporte Prioritário 24/7\
    - Acesso a módulos Beta com IA
  ]
)

#v(0.4cm)

== 5.2. O Script de Abordagem para o Pai (Introdução Quente)

#callout(title: "Roteiro Sugerido de Indicação (WhatsApp / Telefone)", icon: "📞", border-color: hexxon-purple, bg-color: hexxon-purple-subtle, [
  *"Fala [Nome do Colega Dono do Laboratório], tudo bem?*
  
  *Cara, você sabe a dor de cabeça que sempre foi controlar as planilhas de Controle de Qualidade e Westgard aqui no laboratório para não ter problema em auditoria do PNCQ.*
  
  *Meu filho Otávio, que é engenheiro de software, desenvolveu um sistema exclusivo para a gente aqui. A equipe técnica simplesmente abandonou o Excel. O sistema avisa as regras na hora e gera os relatórios em um clique, com um visual impressionante.*
  
  *Ele está selecionando 3 laboratórios amigos aqui da região para liberar um teste completo de 30 dias sem custo nenhum e fazer o acompanhamento. Lembrei de você na hora. Posso pedir para ele te mandar um vídeo de 2 minutos mostrando como funciona?"*
])

#v(0.3cm)

== 5.3. Projeção Financeira e Metas (Mês 6 a Mês 18)

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 12pt,
  metric-card("Meta Mês 6 (Dez 2026)", "R$ 1.500/mês", "1º Cliente + Setup R$ 1.200", color: hexxon-purple),
  metric-card("Meta Mês 12 (Jun 2027)", "R$ 12.000/mês", "10 a 14 Laboratórios Ativos", color: hexxon-green-dark),
  metric-card("Meta Mês 18 (Dez 2027)", "R$ 35.000/mês", "Multi-produtos (QC + Maintain)", color: hexxon-purple-light)
)

#pagebreak()

// ==============================================================================
// ARQUITETURA & PADRÕES DE ENGENHARIA
// ==============================================================================

= 6. Arquitetura Tecnológica & Padrões de Engenharia

Para que a Hexxon sustente clientes reais de saúde, a infraestrutura deve ser moderna, segura (LGPD), auditável e escalável sem custo fixo proibitivo no início.

#v(0.3cm)

== 6.1. Stack Tecnológico Escolhido

#grid(
  columns: (1fr, 1fr),
  gutter: 14pt,
  rect(
    width: 100%,
    radius: 6pt,
    fill: white,
    stroke: 1pt + border-gray,
    inset: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: hexxon-purple)[☕ Backend (Java 21 & Spring Boot 3)]
      #v(4pt)
      - *Framework*: Spring Boot 3.3+ com Java 21 (Virtual Threads / Records).
      - *Segurança*: Spring Security + JWT com RBAC (Papéis: Admin, Biomédico, Auditor).
      - *Banco de Dados*: PostgreSQL com Migrations versionadas via Flyway.
      - *Geração de Laudos*: JasperReports / OpenPDF otimizado para renderização instantânea.
      - *Confiabilidade*: Motores de cálculo estocástico com precisão `BigDecimal`.
    ]
  ),
  rect(
    width: 100%,
    radius: 6pt,
    fill: white,
    stroke: 1pt + border-gray,
    inset: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: hexxon-green-dark)[⚛️ Frontend (React 19 & TypeScript)]
      #v(4pt)
      - *Build Tool*: Vite com TypeScript estrito.
      - *Estilização*: Tailwind CSS v3/v4 com tokens de design Hexxon.
      - *Gráficos*: Recharts & Apache ECharts para gráficos de Levey-Jennings em alta performance.
      - *Componentes*: Radix UI / Shadcn UI customizado com micro-animações (Framer Motion).
      - *Testes*: Vitest + Playwright para fluxos críticos de CQ.
    ]
  )
)

#v(0.4cm)

== 6.2. Estrutura de Isolamento de Clientes (Multi-Tenancy)
Para atender múltiplos laboratórios com segurança de dados garantida:
1. *Fase Inicial (Clientes 1 a 5)*: *Row-Level Multi-tenancy* com `tenant_id` obrigatório em todas as tabelas e filtro global no Hibernate (`@TenantFilter`). Rápido, custo de infraestrutura quase zero (única instância PostgreSQL).
2. *Fase de Escala (Clientes 10+)*: *Schema-per-tenant* ou instâncias segregadas para clientes Enterprise que exigem isolamento físico de banco de dados por compliance LGPD.

== 6.3. Infraestrutura & Custos de Operação Iniciais

#table(
  columns: (1.5fr, 2fr, 1.5fr),
  stroke: 0.5pt + border-gray,
  fill: (x, y) => if y == 0 { hexxon-purple-subtle } else if calc.even(y) { bg-gray } else { white },
  
  [#text(weight: "bold", fill: hexxon-purple)[Serviço]],
  [#text(weight: "bold", fill: hexxon-purple)[Tecnologia / Provedor]],
  [#text(weight: "bold", fill: hexxon-purple)[Custo Inicial Estimado]],
  
  [Hospedagem Backend API], [Railway / Render / Hetzner Cloud (Docker)], [US\$ 10 – 25 / mês],
  [Banco de Dados PostgreSQL], [Neon DB / Supabase / Postgres Gerenciado], [US\$ 0 – 20 / mês],
  [Hospedagem Frontend Web], [Vercel / Cloudflare Pages], [US\$ 0 / mês (Tier Gratuito)],
  [Domínio & E-mail Profissional], [hexxon.com.br (Registro.br + Google Workspace)], [R\$ 40 / ano + R\$ 35 / mês],
  
  [*CUSTO TOTAL DE OPERAÇÃO*], [*Infraestrutura profissional pronta para produção*], [*< R\$ 250 / mês*]
)

#pagebreak()

// ==============================================================================
// GESTÃO DE RISCOS & PLANO DE AÇÃO IMEDIATO
// ==============================================================================

= 7. Matriz de Riscos & Plano de Ação Imediato

Nenhum plano sobrevive ao campo de batalha sem uma análise honesta de riscos e contramedidas preparadas.

#v(0.3cm)

== 7.1. Matriz de Riscos e Mitigações

#table(
  columns: (1.5fr, 1.8fr, 2fr),
  stroke: 0.5pt + border-gray,
  fill: (x, y) => if y == 0 { hexxon-purple-subtle } else if calc.even(y) { bg-gray } else { white },
  
  [#text(weight: "bold", fill: hexxon-purple)[Risco Mapeado]],
  [#text(weight: "bold", fill: hexxon-purple)[Impacto / Probabilidade]],
  [#text(weight: "bold", fill: hexxon-purple)[Estratégia de Mitigação]],
  
  [
    *Resistência do Biomédico à Mudança*\
    (Apego à planilha antiga)
  ],
  [
    #badge("Alto", color: rgb("#DC2626"), bg: rgb("#FEE2E2")) / Média
  ],
  [
    Tornar a entrada de dados 3x mais rápida que o Excel. Criar atalhos de teclado e interface visualmente tão gratificante que o operador sinta prazer em usar.
  ],
  
  [
    *Ciclo de Venda B2B Lento*\
    (Donos de lab adiam decisão)
  ],
  [
    #badge("Médio", color: rgb("#D97706"), bg: rgb("#FEF3C7")) / Alta
  ],
  [
    Utilizar o modelo de *PoC Assistida de 30 dias*. O cliente já estará usando o sistema na rotina diária quando a proposta chegar, tornando doloroso cancelar.
  ],
  
  [
    *Falta de Foco / Escopo Infinito*\
    (Tentar construir tudo de uma vez)
  ],
  [
    #badge("Crítico", color: rgb("#DC2626"), bg: rgb("#FEE2E2")) / Alta
  ],
  [
    Trava inegociável: *Vender apenas o Hexxon QC no Mês 4 a 6*. Não prometer nem construir funcionalidades customizadas complexas antes do 1º contrato assinado.
  ]
)

#v(0.5cm)

== 7.2. O Checklist de Ação: Os Primeiros 7 Dias

#callout(title: "Passos Práticos para Começar Hoje", icon: "🚀", border-color: hexxon-green-dark, bg-color: hexxon-green-subtle, [
  1. *[Engenharia]*: Fechar as últimas linhas pendentes de relatório no `biodiagnostico-api` e rodar a bateria de testes unitários.
  2. *[Sandbox]*: Subir o sistema no computador ou servidor do laboratório do seu pai para iniciar a coleta real de dados de CQ nesta semana.
  3. *[Branding]*: Registrar o domínio oficial `hexxon.com.br` (ou `.tech` / `.med.br`) no Registro.br.
  4. *[Comercial]*: Ter uma conversa formal de 30 minutos com seu pai: apresentar o plano, definir o laboratório dele como *Case Study #01* e alinhar a lista de primeiros contatos.
  5. *[Design]*: Criar a pasta de assets da Hexxon com a paleta oficial (Roxo + Verde Musgo) e o Dr. Rexx pronto para os materiais de apresentação.
])

#v(0.8cm)

#align(center)[
  #line(length: 60%, stroke: 0.5pt + border-gray)
  #v(0.2cm)
  #text(size: 11pt, weight: "bold", fill: hexxon-purple)[HEXXON SOFTWARE HOUSE] \
  #text(size: 9pt, style: "italic", fill: text-muted)[Da Bancada Laboratorial para o Futuro do Diagnóstico Digital.]
]

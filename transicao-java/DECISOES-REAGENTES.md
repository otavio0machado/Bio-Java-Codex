# Decisoes de Reagentes

## REAG-ADR-001 — Contrato operacional da aba Reagentes

Data: 2026-04-26

Status: aceito para a fase atual

Fonte de verdade usada:

1. Implementacao ativa em Java/React:
   - `ReagentService`
   - `ReagentController`
   - `ReagentLotResponse`
   - `ReagentesTab`
2. Documentacao de migracao:
   - `transicao-java/prompts/06-services-reagentes-manutencao.md`
   - `transicao-java/prompts/14-pagina-proin-cq.md`
3. Auditoria historica:
   - `tudo para a transicao/auditorias/00-mapeamento-geral.md`

### Contexto

A aba Reagentes controla lote, validade, estoque, consumo, movimentacao e rastreabilidade operacional. Esses conceitos afetam seguranca logica do laboratorio e nao devem ser decididos apenas no frontend.

### Decisao

- O backend deve expor diagnosticos derivados no `ReagentLotResponse`.
- O frontend deve refletir esses diagnosticos e manter apenas validacoes ergonomicas antes do envio.
- Campos de rastreabilidade forte (`location`, `supplier`, `receivedDate`, `openedDate`) permanecem opcionais no contrato de entrada nesta fase, porque nao ha fonte canonica exigindo bloqueio de cadastro.
- Rastreabilidade incompleta deve aparecer como fila operacional de saneamento, nao como rejeicao silenciosa.
- Lote `inativo` nao aceita `ENTRADA`; essa politica deve sair do backend como `canReceiveEntry=false`, `allowedMovementTypes` e `movementWarning`.
- A regra efetiva segue em `ReagentService`, incluindo bloqueio server-side, auditoria e derivacao de status.
- `DELETE /api/reagents/{id}` nao deve apagar historico operacional: lotes sem movimentacao e sem uso em CQ podem ser removidos fisicamente; lotes com movimentacao ou uso em CQ devem ser preservados como `inativo` quando estoque estiver zerado.
- Lote com historico operacional e estoque positivo nao pode ser arquivado/removido; o estoque deve ser zerado por movimentacao rastreavel antes.

### Invariantes

- `vencido`: lote passou da validade e ainda possui estoque; representa risco operacional.
- `inativo`: lote terminal/historico; nao deve receber nova entrada.
- `quarentena`: estado manual preservado por derivacao automatica.
- `AJUSTE` exige motivo.
- `SAIDA` que zera estoque exige motivo.
- `SAIDA` acima do estoque deve ser bloqueada.
- Arquivamento de lote com historico preserva o registro como `inativo`.
- Arquivamento/remocao com estoque positivo e historico operacional deve ser bloqueado.

### Risco residual

- A obrigatoriedade formal de `location`, `supplier`, `receivedDate` e `openedDate` ainda depende de decisao operacional do laboratorio.
- A politica de exclusao de movimentacoes individuais permanece a existente: reverte estoque quando possivel e remove a movimentacao.

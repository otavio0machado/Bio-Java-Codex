# Prompt 04 — Motor de Regras de Westgard

Cole este prompt inteiro no Claude:

---

Crie o WestgardEngine.java completo para o Biodiagnóstico 4.0. Este é o coração do sistema de controle de qualidade. Pacote: `com.biodiagnostico.service`.

## Contexto:
O sistema avalia registros de controle de qualidade laboratorial usando as Regras de Westgard, que detectam erros aleatórios e sistemáticos em análises clínicas.

## Implementação atual em Python (referência):
```python
class WestgardService:
    @staticmethod
    def check_rules(current_record: QCRecord, history: List[QCRecord]) -> List[Dict]:
        violations = []
        val = current_record.value
        mean = current_record.target_value
        sd = current_record.target_sd

        if sd == 0:
            return [{"rule": "SD=0", "description": "Desvio Padrão igual a zero.", "severity": "warning"}]

        z_score = (val - mean) / sd

        # 1-2s: Um ponto além de ±2SD (alerta)
        if abs(z_score) > 2:
            violations.append({"rule": "1-2s", "description": "Alerta: Valor excede 2 SD.", "severity": "warning"})

            # 1-3s: Um ponto além de ±3SD (rejeição)
            if abs(z_score) > 3:
                violations.append({"rule": "1-3s", "description": "Erro Aleatório: Valor excede 3 SD.", "severity": "rejection"})

            # 2-2s: Dois consecutivos além de ±2SD mesmo lado
            if history:
                prev = history[0]
                if prev.target_sd > 0:
                    prev_z = (prev.value - prev.target_value) / prev.target_sd
                    if (z_score > 2 and prev_z > 2) or (z_score < -2 and prev_z < -2):
                        violations.append({"rule": "2-2s", "description": "Erro Sistemático: Dois valores consecutivos excedem 2 SD do mesmo lado.", "severity": "rejection"})

            # R-4s: Diferença entre dois consecutivos > 4SD
            if history:
                prev = history[0]
                if prev.target_sd > 0:
                    prev_z = (prev.value - prev.target_value) / prev.target_sd
                    if abs(z_score - prev_z) > 4:
                        violations.append({"rule": "R-4s", "description": "Erro Aleatório: Diferença entre pontos consecutivos excede 4 SD.", "severity": "rejection"})

        # 4-1s: Quatro consecutivos além de ±1SD mesmo lado
        if len(history) >= 3:
            # checar se os 4 pontos (atual + 3 do histórico) estão >1SD ou <-1SD do mesmo lado
            ...

        # 10x: Dez consecutivos do mesmo lado da média
        if len(history) >= 9:
            # checar se os 10 pontos estão todos acima ou abaixo da média
            ...

        return violations
```

## O que preciso em Java:

### WestgardEngine.java (@Service)

1. **Enum `Severity`**: WARNING, REJECTION
2. **Record `Violation`**: rule (String), description (String), severity (Severity)
3. **Método principal**: `List<Violation> evaluate(QcRecord current, List<QcRecord> history)`
4. **Método auxiliar**: `double calculateZScore(QcRecord record)` — retorna (value - targetValue) / targetSd
5. **Todas as 6 regras implementadas**:
   - `1-2s`: |z| > 2 → WARNING
   - `1-3s`: |z| > 3 → REJECTION
   - `2-2s`: dois consecutivos > 2SD mesmo lado → REJECTION
   - `R-4s`: diferença entre consecutivos > 4SD → REJECTION
   - `4-1s`: quatro consecutivos > 1SD mesmo lado → REJECTION
   - `10x`: dez consecutivos do mesmo lado da média → WARNING

6. **Caso especial**: Se targetSd == 0, retorna violation "SD=0" com warning

## Regras:
- Retorne `Collections.unmodifiableList(violations)` (imutável)
- Métodos privados para cada regra: `check22s()`, `checkR4s()`, `check41s()`, `check10x()`
- Todas as descrições em português como no sistema atual
- O history vem ordenado do mais recente para o mais antigo (history.get(0) = anterior ao atual)
- Trate null safety: history pode ser null ou vazio
- Gere o arquivo completo, testável, com Javadoc

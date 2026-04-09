# Prompt 16 — Integração com Google Gemini (IA)

Cole este prompt inteiro no Claude:

---

Crie a integração completa com Google Gemini para o Biodiagnóstico 4.0, tanto no backend (Java) quanto no frontend (React).

## Contexto:
O sistema atual usa Google Gemini 1.5 Flash para análise assistida de dados de controle de qualidade. O usuário pode pedir para a IA analisar tendências, identificar problemas e dar recomendações.

## Backend (Java):

### GeminiAiService.java
```java
@Service
public class GeminiAiService {

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.model}")
    private String model; // gemini-1.5-flash

    private final RestTemplate restTemplate;

    // Método principal: enviar prompt para Gemini e retornar resposta
    public String analyze(String userPrompt, String context) {
        // 1. Montar URL: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
        // 2. Montar body JSON:
        // {
        //   "contents": [{
        //     "parts": [{
        //       "text": "Você é um especialista em controle de qualidade laboratorial. {context}\n\nPergunta: {userPrompt}"
        //     }]
        //   }]
        // }
        // 3. POST request com timeout de 30 segundos
        // 4. Extrair texto da resposta: response.candidates[0].content.parts[0].text
        // 5. Tratar erros: timeout, rate limit, API key inválida
    }

    // Análise de dados QC: formata registros como contexto
    public String analyzeQcData(List<QcRecord> records) {
        StringBuilder context = new StringBuilder();
        context.append("Dados de Controle de Qualidade do Laboratório Biodiagnóstico:\n\n");
        for (QcRecord r : records) {
            context.append(String.format("Data: %s | Exame: %s | Nível: %s | Valor: %.2f | Alvo: %.2f | SD: %.2f | CV: %.2f%% | Status: %s\n",
                r.getDate(), r.getExamName(), r.getLevel(), r.getValue(),
                r.getTargetValue(), r.getTargetSd(), r.getCv(), r.getStatus()));
            if (r.getViolations() != null && !r.getViolations().isEmpty()) {
                for (var v : r.getViolations()) {
                    context.append("  → Violação: ").append(v.getRule()).append(" - ").append(v.getDescription()).append("\n");
                }
            }
        }
        return analyze(
            "Analise estes dados de controle de qualidade. Identifique tendências, problemas sistemáticos, e dê recomendações práticas para o laboratório.",
            context.toString()
        );
    }
}
```

### AiController.java
```java
@RestController
@RequestMapping("/api/ai")
public class AiController {

    POST /analyze → recebe { prompt: string, area?: string, examName?: string, days?: int }
    1. Se area/examName fornecidos: buscar registros e chamar analyzeQcData()
    2. Se apenas prompt: chamar analyze(prompt, "")
    3. Retornar texto da resposta do Gemini
}
```

### Dependência Maven:
Usar RestTemplate do Spring (já incluso). Não precisa de SDK adicional.

## Frontend (React):

### src/services/aiService.ts
```typescript
export const aiService = {
  analyze: (request: AiAnalysisRequest) =>
    api.post<{ response: string }>('/ai/analyze', request).then(r => r.data.response),
};
```

### src/hooks/useAiAnalysis.ts
```typescript
export function useAiAnalysis() {
  return useMutation({
    mutationFn: aiService.analyze,
  });
}
```

### Componente de IA na página de CQ:
Adicionar ao RegistroTab ou como tab separada "Assistente IA":
- Textarea para o usuário digitar pergunta
- Select: área e exame (opcionais, para contexto)
- Botão "Analisar com IA"
- Loading: "Analisando dados..." com spinner
- Resposta: renderizada em card com markdown básico
- Histórico de perguntas/respostas na sessão (estado local)

### Prompt System (contexto pré-definido):
O backend sempre envia este prefixo ao Gemini:
```
Você é um especialista em controle de qualidade laboratorial, com profundo conhecimento em:
- Regras de Westgard (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x)
- Gráficos de Levey-Jennings
- Coeficiente de Variação (CV%)
- Calibração de equipamentos
- Gestão de reagentes e lotes

Responda sempre em português do Brasil, de forma clara e prática.
Quando analisar dados, aponte:
1. Tendências observadas
2. Problemas identificados
3. Recomendações de ação
```

## Regras:
- Timeout de 30 segundos na chamada ao Gemini
- Se Gemini falhar: retornar mensagem amigável "Não foi possível analisar no momento. Tente novamente."
- Não enviar dados sensíveis do paciente (só dados de CQ)
- Rate limit: máximo 10 análises por minuto por usuário
- Gere TODOS os arquivos completos (backend + frontend)

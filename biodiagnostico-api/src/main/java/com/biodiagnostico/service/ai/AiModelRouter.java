package com.biodiagnostico.service.ai;

import com.biodiagnostico.config.AiProperties;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Resolve, para cada {@link AiTask}, o modelo concreto a usar — desacoplando a
 * regra de negocio do id do modelo.
 *
 * <p>Fluxo: tarefa -&gt; tier (via {@code ai.routing}, com defaults de codigo)
 * -&gt; id do modelo (via {@code ai.models}).
 *
 * <p>Escalonamento: {@link #escalationModelFor(AiTask)} devolve o modelo do tier
 * imediatamente acima ({@code basic -> medium -> advanced}); para o topo
 * ({@code advanced}) e para o tier {@code audio} nao ha tier acima, retornando
 * {@code null}. O {@code AiService} decide o que fazer quando nao ha
 * escalonamento (ex.: retry no mesmo modelo de audio).
 */
@Component
public class AiModelRouter {

    /** Ordem de escalonamento dos tiers de texto (do menor para o maior). */
    private static final String TIER_BASIC = "basic";
    private static final String TIER_MEDIUM = "medium";
    private static final String TIER_ADVANCED = "advanced";
    private static final String TIER_AUDIO = "audio";

    /** Tiers default por tarefa, usados quando {@code ai.routing} nao define. */
    private static final Map<AiTask, String> DEFAULT_TIERS = Map.of(
        AiTask.EXPLAIN_VIOLATION, TIER_MEDIUM,
        AiTask.INTERPRET_TREND, TIER_MEDIUM,
        AiTask.SUGGEST_OBSERVATION, TIER_BASIC,
        AiTask.CHAT, TIER_MEDIUM,
        AiTask.VOICE_FORM, TIER_AUDIO
    );

    private final AiProperties properties;

    public AiModelRouter(AiProperties properties) {
        this.properties = properties;
    }

    /**
     * Modelo primario para a tarefa.
     *
     * @throws com.biodiagnostico.exception.BusinessException se o tier resolvido
     *     for desconhecido ou se o modelo daquele tier nao estiver configurado
     */
    public String modelFor(AiTask task) {
        String tier = tierFor(task);
        return modelForTier(tier);
    }

    /**
     * Modelo do tier imediatamente acima do tier primario da tarefa, ou
     * {@code null} quando nao ha tier acima (topo {@code advanced} ou tier
     * {@code audio}).
     */
    public String escalationModelFor(AiTask task) {
        String tier = tierFor(task);
        String higher = higherTier(tier);
        return higher == null ? null : modelForTier(higher);
    }

    private String tierFor(AiTask task) {
        String configured = properties.getRouting().get(routingKey(task));
        if (configured != null && !configured.isBlank()) {
            return configured.trim().toLowerCase(Locale.ROOT);
        }
        return DEFAULT_TIERS.getOrDefault(task, TIER_MEDIUM);
    }

    /**
     * Converte a tarefa para a chave kebab-case usada em {@code ai.routing}
     * (ex.: {@code EXPLAIN_VIOLATION} -&gt; {@code explain-violation}).
     */
    private String routingKey(AiTask task) {
        return task.name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    private String higherTier(String tier) {
        return switch (tier) {
            case TIER_BASIC -> TIER_MEDIUM;
            case TIER_MEDIUM -> TIER_ADVANCED;
            default -> null;
        };
    }

    private String modelForTier(String tier) {
        AiProperties.Models models = properties.getModels();
        String model = switch (tier) {
            case TIER_ADVANCED -> models.getAdvanced();
            case TIER_MEDIUM -> models.getMedium();
            case TIER_BASIC -> models.getBasic();
            case TIER_AUDIO -> models.getAudio();
            default -> null;
        };
        if (model == null || model.isBlank()) {
            throw new com.biodiagnostico.exception.BusinessException(
                "Modelo de IA nao configurado para o tier: " + tier);
        }
        return model;
    }
}

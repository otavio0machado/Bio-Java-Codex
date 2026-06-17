package com.biodiagnostico.service.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.biodiagnostico.config.AiProperties;
import com.biodiagnostico.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Testa o {@link AiModelRouter}: mapeamento tarefa-&gt;tier-&gt;modelo e
 * escalonamento, a partir de {@link AiProperties}.
 */
class AiModelRouterTest {

    /** Properties com os defaults de codigo (modelos e routing default). */
    private AiProperties defaultProperties() {
        return new AiProperties();
    }

    private AiModelRouter routerWith(AiProperties props) {
        return new AiModelRouter(props);
    }

    @Test
    @DisplayName("modelFor mapeia cada tarefa ao modelo do tier default")
    void modelForDefaultRouting() {
        AiModelRouter router = routerWith(defaultProperties());
        assertThat(router.modelFor(AiTask.EXPLAIN_VIOLATION)).isEqualTo("gpt-5.4");   // medium
        assertThat(router.modelFor(AiTask.INTERPRET_TREND)).isEqualTo("gpt-5.4");     // medium
        assertThat(router.modelFor(AiTask.SUGGEST_OBSERVATION)).isEqualTo("gpt-5.4-mini"); // basic
        assertThat(router.modelFor(AiTask.CHAT)).isEqualTo("gpt-5.4");                // medium
        assertThat(router.modelFor(AiTask.VOICE_FORM)).isEqualTo("gpt-audio-1.5");    // audio
    }

    @Test
    @DisplayName("modelFor respeita override de routing vindo da configuração")
    void modelForRoutingOverride() {
        AiProperties props = defaultProperties();
        props.getRouting().put("suggest-observation", "advanced");
        AiModelRouter router = routerWith(props);
        assertThat(router.modelFor(AiTask.SUGGEST_OBSERVATION)).isEqualTo("gpt-5.5"); // advanced
    }

    @Test
    @DisplayName("modelFor respeita override do id do modelo de cada tier")
    void modelForModelIdOverride() {
        AiProperties props = defaultProperties();
        props.getModels().setMedium("modelo-medium-custom");
        AiModelRouter router = routerWith(props);
        assertThat(router.modelFor(AiTask.CHAT)).isEqualTo("modelo-medium-custom");
    }

    @Test
    @DisplayName("escalationModelFor sobe um tier para tarefas de texto (medium -> advanced)")
    void escalationFromMedium() {
        AiModelRouter router = routerWith(defaultProperties());
        assertThat(router.escalationModelFor(AiTask.EXPLAIN_VIOLATION)).isEqualTo("gpt-5.5"); // advanced
        assertThat(router.escalationModelFor(AiTask.CHAT)).isEqualTo("gpt-5.5");
    }

    @Test
    @DisplayName("escalationModelFor sobe um tier de basic para medium")
    void escalationFromBasic() {
        AiModelRouter router = routerWith(defaultProperties());
        assertThat(router.escalationModelFor(AiTask.SUGGEST_OBSERVATION)).isEqualTo("gpt-5.4"); // medium
    }

    @Test
    @DisplayName("escalationModelFor retorna null no topo (advanced) — sem tier acima")
    void escalationFromAdvancedIsNull() {
        AiProperties props = defaultProperties();
        props.getRouting().put("chat", "advanced");
        AiModelRouter router = routerWith(props);
        assertThat(router.escalationModelFor(AiTask.CHAT)).isNull();
    }

    @Test
    @DisplayName("escalationModelFor retorna null para o tier audio — sem tier acima")
    void escalationForAudioIsNull() {
        AiModelRouter router = routerWith(defaultProperties());
        assertThat(router.escalationModelFor(AiTask.VOICE_FORM)).isNull();
    }

    @Test
    @DisplayName("modelFor lança BusinessException quando o modelo do tier não está configurado")
    void modelForMissingModelThrows() {
        AiProperties props = defaultProperties();
        props.getModels().setMedium("");
        AiModelRouter router = routerWith(props);
        assertThatThrownBy(() -> router.modelFor(AiTask.CHAT))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("medium");
    }

    @Test
    @DisplayName("tier desconhecido na configuração propaga BusinessException")
    void unknownTierThrows() {
        AiProperties props = defaultProperties();
        props.getRouting().put("chat", "ultra");
        AiModelRouter router = routerWith(props);
        assertThatThrownBy(() -> router.modelFor(AiTask.CHAT))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("ultra");
    }
}

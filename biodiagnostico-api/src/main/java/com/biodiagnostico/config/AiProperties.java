package com.biodiagnostico.config;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuracao do subsistema de IA (prefixo {@code ai}).
 *
 * <p>Centraliza credenciais do provedor (OpenAI), o catalogo de modelos por
 * tier ({@code advanced/medium/basic/audio}), o roteamento tarefa-&gt;tier e o
 * limite de tamanho de audio. Todos os valores tem default e sao
 * sobrescritiveis por variavel de ambiente no {@code application.yml}.
 *
 * <p>A chave de API NAO e validada no startup (pode estar ausente em ambientes
 * sem IA); a ausencia e tratada como {@link com.biodiagnostico.exception.BusinessException}
 * clara no momento da chamada (analogo ao antigo {@code ensureApiKeyConfigured}).
 */
@Component
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    private OpenAi openai = new OpenAi();
    private Models models = new Models();

    /**
     * Roteamento tarefa-&gt;tier. As chaves usam o formato kebab-case da tarefa
     * (ex.: {@code explain-violation}); os valores sao nomes de tier
     * ({@code advanced/medium/basic/audio}). Resolvido por {@link com.biodiagnostico.service.ai.AiModelRouter}.
     */
    private Map<String, String> routing = new LinkedHashMap<>();

    private Voice voice = new Voice();

    public OpenAi getOpenai() {
        return openai;
    }

    public void setOpenai(OpenAi openai) {
        this.openai = openai;
    }

    public Models getModels() {
        return models;
    }

    public void setModels(Models models) {
        this.models = models;
    }

    public Map<String, String> getRouting() {
        return routing;
    }

    public void setRouting(Map<String, String> routing) {
        this.routing = routing;
    }

    public Voice getVoice() {
        return voice;
    }

    public void setVoice(Voice voice) {
        this.voice = voice;
    }

    public static class OpenAi {

        /** Chave de API da OpenAI. Vazia quando IA nao esta configurada. */
        private String apiKey = "";

        /** Base URL da API (sem barra final). Default: API publica da OpenAI. */
        private String baseUrl = "https://api.openai.com/v1";

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }
    }

    /**
     * Catalogo de modelos por tier. {@code advanced} &gt; {@code medium} &gt;
     * {@code basic} define a ordem de escalonamento para tarefas de texto;
     * {@code audio} e o tier dedicado para multimodal de voz.
     */
    public static class Models {

        private String advanced = "gpt-5.5";
        private String medium = "gpt-5.4";
        private String basic = "gpt-5.4-mini";
        private String audio = "gpt-audio-1.5";

        public String getAdvanced() {
            return advanced;
        }

        public void setAdvanced(String advanced) {
            this.advanced = advanced;
        }

        public String getMedium() {
            return medium;
        }

        public void setMedium(String medium) {
            this.medium = medium;
        }

        public String getBasic() {
            return basic;
        }

        public void setBasic(String basic) {
            this.basic = basic;
        }

        public String getAudio() {
            return audio;
        }

        public void setAudio(String audio) {
            this.audio = audio;
        }
    }

    public static class Voice {

        /** Limite de bytes do audio decodificado. Default: 2 MiB. */
        private int maxAudioBytes = 2_097_152;

        public int getMaxAudioBytes() {
            return maxAudioBytes;
        }

        public void setMaxAudioBytes(int maxAudioBytes) {
            this.maxAudioBytes = maxAudioBytes;
        }
    }
}

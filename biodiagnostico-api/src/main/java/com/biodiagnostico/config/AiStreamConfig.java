package com.biodiagnostico.config;

import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Onda 4 / Fase A (parte 2) — Executor dedicado das respostas de IA por
 * <strong>streaming</strong> (Server-Sent Events).
 *
 * <p><strong>Por que NAO usar a thread do servlet:</strong> o
 * {@code AiController} chama o provedor de IA (HTTP, potencialmente lento)
 * dentro do trabalho do {@code SseEmitter}. Rodar isso na thread do container
 * (Tomcat) bloquearia o pool de atendimento de requisicoes. Submetemos o
 * trabalho a este pool dedicado e devolvemos a thread do servlet imediatamente.
 *
 * <p>O pool e pequeno e limitado de proposito: o numero de chamadas concorrentes
 * de IA ja e contido pelo rate-limit por usuario (10/min). A politica de
 * saturacao {@link ThreadPoolExecutor.CallerRunsPolicy} degrada com seguranca
 * (executa na thread chamadora) em vez de descartar silenciosamente uma
 * requisicao de stream.
 */
@Configuration
public class AiStreamConfig {

    /** Nome do bean executor; referenciado pelo {@code AiController}. */
    public static final String AI_STREAM_EXECUTOR = "aiStreamExecutor";

    @Bean(name = AI_STREAM_EXECUTOR)
    public ThreadPoolTaskExecutor aiStreamExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("ai-stream-");
        // Degradacao segura sob saturacao: roda na thread chamadora em vez de descartar.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // Aguarda tarefas em andamento no shutdown para nao cortar um stream no meio.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}

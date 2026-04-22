package com.biodiagnostico.service.reports.v2.generator.ai;

import com.biodiagnostico.service.GeminiAiService;
import com.biodiagnostico.service.reports.v2.catalog.ReportCode;
import com.biodiagnostico.service.reports.v2.generator.GenerationContext;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Implementacao padrao de {@link ReportAiCommentator}. Submete a chamada ao
 * {@link GeminiAiService} num executor dedicado com timeout de 15s. Qualquer
 * falha (excecao, timeout, mensagem amigavel do Gemini) resulta em
 * {@link #FALLBACK_COMMENTARY} para que o relatorio sempre possa ser emitido.
 *
 * <p>O prefixo "Nao foi possivel analisar" (emitido pelo {@link GeminiAiService}
 * quando ele proprio falha internamente) e detectado e tratado como fallback.
 */
@Component
public class DefaultReportAiCommentator implements ReportAiCommentator {

    private static final Logger LOG = LoggerFactory.getLogger(DefaultReportAiCommentator.class);

    private static final String GEMINI_FRIENDLY_PREFIX = "Nao foi possivel analisar";
    private static final String GEMINI_FRIENDLY_PREFIX_ACCENT = "Não foi possível analisar";

    /** Timeout padrao (15s). Overload interno permite timeout menor em testes. */
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(15);

    private final GeminiAiService geminiAiService;
    private final ReportAiPrompts prompts;
    private final ExecutorService executor;
    private final Duration timeout;

    @Autowired
    public DefaultReportAiCommentator(GeminiAiService geminiAiService, ReportAiPrompts prompts) {
        this(geminiAiService, prompts, buildDefaultExecutor(), DEFAULT_TIMEOUT);
    }

    /** Construtor para testes — permite injetar executor e timeout menor. */
    public DefaultReportAiCommentator(
        GeminiAiService geminiAiService,
        ReportAiPrompts prompts,
        ExecutorService executor,
        Duration timeout
    ) {
        this.geminiAiService = geminiAiService;
        this.prompts = prompts;
        this.executor = executor;
        this.timeout = timeout == null ? DEFAULT_TIMEOUT : timeout;
    }

    @Override
    public String commentary(ReportCode code, String structuredContext, GenerationContext ctx) {
        String prompt = prompts.promptFor(code);
        String context = structuredContext == null ? "" : structuredContext;
        CompletableFuture<String> future = CompletableFuture.supplyAsync(
            () -> geminiAiService.analyze(prompt, context), executor);
        try {
            String result = future.orTimeout(timeout.toMillis(), TimeUnit.MILLISECONDS).join();
            if (result == null || result.isBlank()) {
                LOG.warn("Gemini retornou vazio para code={}; usando fallback", code);
                return FALLBACK_COMMENTARY;
            }
            String trimmed = result.trim();
            if (trimmed.startsWith(GEMINI_FRIENDLY_PREFIX) || trimmed.startsWith(GEMINI_FRIENDLY_PREFIX_ACCENT)) {
                LOG.warn("Gemini sinalizou falha interna para code={}; usando fallback", code);
                return FALLBACK_COMMENTARY;
            }
            return trimmed;
        } catch (CompletionException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof TimeoutException) {
                LOG.warn("Timeout (>{}ms) ao gerar comentario IA para code={}; usando fallback", timeout.toMillis(), code);
            } else {
                LOG.warn("Falha ao gerar comentario IA para code={}; usando fallback: {}", code,
                    cause == null ? ex.getMessage() : cause.getMessage());
            }
            return FALLBACK_COMMENTARY;
        } catch (RuntimeException ex) {
            LOG.warn("Falha inesperada ao gerar comentario IA para code={}; usando fallback", code, ex);
            return FALLBACK_COMMENTARY;
        }
    }

    @PreDestroy
    public void shutdown() {
        if (executor != null && !executor.isShutdown()) {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(2, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }
    }

    private static ExecutorService buildDefaultExecutor() {
        AtomicInteger counter = new AtomicInteger();
        ThreadFactory factory = r -> {
            Thread t = new Thread(r, "report-ai-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
        return Executors.newFixedThreadPool(2, factory);
    }
}

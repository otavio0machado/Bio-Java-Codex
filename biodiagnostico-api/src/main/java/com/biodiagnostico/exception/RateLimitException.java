package com.biodiagnostico.exception;

/**
 * Sinaliza que o limite de chamadas da IA por janela de tempo foi excedido.
 *
 * <p><strong>Por que NAO estende {@link BusinessException}:</strong> varios
 * metodos assistivos da IA (ex.: D11 {@code describeDrift}, D12
 * {@code prioritize}, B5 {@code resolveExamMismatches}) capturam
 * {@code BusinessException} (e {@code RuntimeException}) para DEGRADAR
 * graciosamente. Se o rate-limit fosse uma {@code BusinessException}, seria
 * engolido por esses {@code catch} e nunca chegaria ao cliente como 429. Por
 * isso esta excecao estende {@link RuntimeException} diretamente e esses
 * metodos a deixam PROPAGAR explicitamente.
 *
 * <p>O {@code retryAfterSeconds} alimenta o header HTTP {@code Retry-After} no
 * {@code GlobalExceptionHandler}.
 */
public class RateLimitException extends RuntimeException {

    private final long retryAfterSeconds;

    public RateLimitException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}

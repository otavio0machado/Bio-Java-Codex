package com.biodiagnostico.util;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.dto.reports.v2.ReportExecutionResponse;
import com.biodiagnostico.entity.ReportRun;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ReportV2MapperTest {

    private static final String BASE = "http://localhost:5173";
    private static final String SHA256 = "a".repeat(64);
    private static final String TOKEN = "tok0en0value0000000000000000000000";

    private ReportRun.ReportRunBuilder baseRun() {
        return ReportRun.builder()
            .id(UUID.randomUUID())
            .reportCode("CQ_OPERATIONAL_V2")
            .format("PDF")
            .status("READY")
            .sha256(SHA256);
    }

    @Test
    @DisplayName("verifyUrl usa shareToken (link estavel) quando presente")
    void verifyUrlUsesShareTokenWhenPresent() {
        ReportRun run = baseRun().shareToken(TOKEN).build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, BASE);

        assertThat(res.verifyUrl()).isEqualTo(BASE + "/r/verify/" + TOKEN);
        assertThat(res.verifyUrl()).startsWith(BASE + "/r/verify/");
        // O link estavel NAO deve mais expor o sha256 quando ha token.
        assertThat(res.verifyUrl()).doesNotContain(SHA256);
    }

    @Test
    @DisplayName("verifyUrl cai no sha256 (fallback) para runs legados sem shareToken")
    void verifyUrlFallsBackToSha256WhenNoToken() {
        ReportRun run = baseRun().shareToken(null).build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, BASE);

        assertThat(res.verifyUrl()).isEqualTo(BASE + "/r/verify/" + SHA256);
        assertThat(res.verifyUrl()).startsWith(BASE + "/r/verify/");
    }

    @Test
    @DisplayName("verifyUrl trata token vazio como ausente (fallback sha256)")
    void verifyUrlBlankTokenFallsBack() {
        ReportRun run = baseRun().shareToken("   ").build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, BASE);

        assertThat(res.verifyUrl()).isEqualTo(BASE + "/r/verify/" + SHA256);
    }

    @Test
    @DisplayName("verifyUrl e nulo quando nao ha token nem sha256")
    void verifyUrlNullWhenNoTokenNoSha() {
        ReportRun run = baseRun().sha256(null).shareToken(null).build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, BASE);

        assertThat(res.verifyUrl()).isNull();
    }

    @Test
    @DisplayName("verifyUrl e nulo quando publicBaseUrl ausente, mesmo com token")
    void verifyUrlNullWhenNoBaseUrl() {
        ReportRun run = baseRun().shareToken(TOKEN).build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, null);

        assertThat(res.verifyUrl()).isNull();
    }

    @Test
    @DisplayName("verifyUrl normaliza barra final da base com token")
    void verifyUrlTrimsTrailingSlash() {
        ReportRun run = baseRun().shareToken(TOKEN).build();

        ReportExecutionResponse res = ReportV2Mapper.toResponse(run, BASE + "/");

        assertThat(res.verifyUrl()).isEqualTo(BASE + "/r/verify/" + TOKEN);
    }
}

package com.biodiagnostico.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.biodiagnostico.config.SecurityConfig;
import com.biodiagnostico.exception.GlobalExceptionHandler;
import com.biodiagnostico.security.AccessTokenBlacklistService;
import com.biodiagnostico.security.JwtAuthFilter;
import com.biodiagnostico.service.PdfReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ReportController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, ReportControllerTest.NoOpJwtFilterConfig.class})
class ReportControllerTest {

    private static final String TEST_JWT_SECRET = "testsecretkeythatisfarlongerthanthirtytwobytesforjwt";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StubPdfReportService pdfReportService;

    @Test
    @DisplayName("deve retornar PDF de CQ")
    void shouldReturnQcPdf() throws Exception {
        pdfReportService.qcPdf = "qc".getBytes();

        mockMvc.perform(get("/api/reports/qc-pdf")
                .param("area", "bioquimica")
                .param("periodType", "current-month")
                .with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(content().bytes("qc".getBytes()));
    }

    @Test
    @DisplayName("deve retornar PDF de reagentes")
    void shouldReturnReagentsPdf() throws Exception {
        pdfReportService.reagentsPdf = "reag".getBytes();

        mockMvc.perform(get("/api/reports/reagents-pdf").with(user("ana").roles("FUNCIONARIO")))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(content().bytes("reag".getBytes()));
    }

    @Test
    @DisplayName("deve exigir autenticação para relatórios")
    void shouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/reports/qc-pdf"))
            .andExpect(status().isUnauthorized());
    }

    @TestConfiguration
    static class NoOpJwtFilterConfig {
        @Bean
        StubPdfReportService stubPdfReportService() {
            return new StubPdfReportService();
        }

        @Bean
        io.micrometer.core.instrument.MeterRegistry meterRegistry() {
            return new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        }

        @Bean
        com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider() {
            return new com.biodiagnostico.security.JwtTokenProvider(TEST_JWT_SECRET, "test-issuer", 900_000, 604_800_000);
        }

        @Bean
        AccessTokenBlacklistService accessTokenBlacklistService() {
            return new AccessTokenBlacklistService();
        }

        @Bean
        JwtAuthFilter jwtAuthFilter(
            com.biodiagnostico.security.JwtTokenProvider jwtTokenProvider,
            AccessTokenBlacklistService accessTokenBlacklistService
        ) {
            return new JwtAuthFilter(jwtTokenProvider, accessTokenBlacklistService);
        }
    }

    static class StubPdfReportService extends PdfReportService {
        private byte[] qcPdf = new byte[0];
        private byte[] reagentsPdf = new byte[0];

        StubPdfReportService() {
            super(null, null, null, null, null, null, null, null);
        }

        @Override
        public byte[] generateQcPdf(String area, String periodType, Integer month, Integer year) {
            return qcPdf;
        }

        @Override
        public com.biodiagnostico.dto.response.GeneratedReport generateQcReport(String area, String periodType, Integer month, Integer year) {
            return new com.biodiagnostico.dto.response.GeneratedReport(qcPdf, "BIO-TEST-000001", "hash", "test");
        }

        @Override
        public byte[] generateReagentsPdf() {
            return reagentsPdf;
        }

        @Override
        public com.biodiagnostico.dto.response.GeneratedReport generateReagentsReport() {
            return new com.biodiagnostico.dto.response.GeneratedReport(reagentsPdf, "BIO-TEST-000002", "hash", "test");
        }
    }
}

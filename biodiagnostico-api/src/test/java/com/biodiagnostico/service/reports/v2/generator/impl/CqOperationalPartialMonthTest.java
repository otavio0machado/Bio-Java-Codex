package com.biodiagnostico.service.reports.v2.generator.impl;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Cobre o predicado de "mes corrente parcial" (Item A da auditoria): so deve
 * sinalizar quando o periodo e current-month, no mes/ano de hoje, e hoje ainda
 * nao chegou ao fim do mes. Sem isso, o comparativo confronta um mes PARCIAL
 * contra um mes anterior COMPLETO sem ressalva.
 */
class CqOperationalPartialMonthTest {

    private CqOperationalV2Generator.ResolvedFilters currentMonth(LocalDate anchor) {
        YearMonth ym = YearMonth.from(anchor);
        CqOperationalV2Generator.ResolvedFilters rf = new CqOperationalV2Generator.ResolvedFilters();
        rf.periodType = "current-month";
        rf.start = ym.atDay(1);
        rf.end = ym.atEndOfMonth();
        rf.periodLabel = "fixture";
        return rf;
    }

    @Test
    @DisplayName("mes corrente no meio do mes => parcial (true)")
    void midMonthIsPartial() {
        LocalDate today = LocalDate.of(2026, 6, 12);
        assertThat(currentMonth(today).isPartialCurrentMonth(today)).isTrue();
    }

    @Test
    @DisplayName("ultimo dia do mes => nao parcial (today nao e antes do fim)")
    void lastDayNotPartial() {
        LocalDate today = LocalDate.of(2026, 6, 30);
        assertThat(currentMonth(today).isPartialCurrentMonth(today)).isFalse();
    }

    @Test
    @DisplayName("mes/ano diferente de hoje => nao parcial")
    void differentMonthNotPartial() {
        CqOperationalV2Generator.ResolvedFilters rf = currentMonth(LocalDate.of(2026, 5, 15));
        // hoje em junho, periodo em maio
        assertThat(rf.isPartialCurrentMonth(LocalDate.of(2026, 6, 1))).isFalse();
    }

    @Test
    @DisplayName("periodType != current-month => nunca parcial")
    void nonCurrentMonthNeverPartial() {
        LocalDate today = LocalDate.of(2026, 6, 12);
        CqOperationalV2Generator.ResolvedFilters rf = currentMonth(today);
        rf.periodType = "specific-month";
        assertThat(rf.isPartialCurrentMonth(today)).isFalse();
    }

    @Test
    @DisplayName("ressalva textual cita o dia DD/MM e nao tem acento")
    void noticeMentionsDayWithoutAccent() {
        String notice = CqOperationalV2Generator.partialCurrentMonthNotice(LocalDate.of(2026, 6, 12));
        assertThat(notice).contains("12/06");
        assertThat(notice).contains("Comparativo parcial");
        assertThat(notice).contains("subestimada");
        // padrao do arquivo: strings de codigo sem acento
        assertThat(notice).isEqualTo(java.text.Normalizer
            .normalize(notice, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}", ""));
    }
}

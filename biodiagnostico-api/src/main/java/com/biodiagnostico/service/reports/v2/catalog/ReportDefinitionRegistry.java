package com.biodiagnostico.service.reports.v2.catalog;

import com.biodiagnostico.service.reports.v2.ReportCodeNotFoundException;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Catalogo estatico dos {@link ReportDefinition}s conhecidos. Em F1 apenas
 * {@link ReportCode#CQ_OPERATIONAL_V2} esta presente; novos codigos entram
 * aqui conforme slices sao ligados.
 *
 * Alem de resolver definitions por codigo, centraliza a logica de autorizacao
 * por role — a UI usa {@link #forUserRoles(Set)} para montar o menu de
 * relatorios disponiveis e o backend usa {@link #canAccess(ReportCode, Set)}
 * como guarda antes de delegar ao generator.
 */
@Component
public class ReportDefinitionRegistry {

    public static final ReportDefinition CQ_OPERATIONAL_V2_DEFINITION = buildCqOperationalV2Definition();

    private final Map<ReportCode, ReportDefinition> definitions;

    public ReportDefinitionRegistry() {
        Map<ReportCode, ReportDefinition> map = new EnumMap<>(ReportCode.class);
        map.put(ReportCode.CQ_OPERATIONAL_V2, CQ_OPERATIONAL_V2_DEFINITION);
        this.definitions = Collections.unmodifiableMap(map);
    }

    public ReportDefinition resolve(ReportCode code) {
        ReportDefinition def = definitions.get(code);
        if (def == null) {
            throw new ReportCodeNotFoundException("Codigo de relatorio desconhecido: " + code);
        }
        return def;
    }

    public ReportDefinition resolveOrNull(ReportCode code) {
        return definitions.get(code);
    }

    public Collection<ReportDefinition> all() {
        return definitions.values();
    }

    public List<ReportDefinition> forUserRoles(Set<String> roles) {
        Set<String> normalizedRoles = roles == null ? Set.of() : roles;
        return definitions.values().stream()
            .filter(def -> def.roleAccess().stream().anyMatch(normalizedRoles::contains))
            .collect(Collectors.toUnmodifiableList());
    }

    public boolean canAccess(ReportCode code, Set<String> roles) {
        ReportDefinition def = resolveOrNull(code);
        if (def == null || roles == null) return false;
        return def.roleAccess().stream().anyMatch(roles::contains);
    }

    private static ReportDefinition buildCqOperationalV2Definition() {
        List<ReportFilterField> fields = List.of(
            new ReportFilterField(
                "area",
                ReportFilterFieldType.STRING_ENUM,
                true,
                List.of("bioquimica", "hematologia", "imunologia", "parasitologia", "microbiologia", "uroanalise"),
                "Area",
                "Area do laboratorio a filtrar (obrigatorio)"
            ),
            new ReportFilterField(
                "periodType",
                ReportFilterFieldType.STRING_ENUM,
                true,
                List.of("current-month", "specific-month", "year", "date-range"),
                "Tipo de periodo",
                "Define como o intervalo de datas e calculado"
            ),
            new ReportFilterField(
                "month",
                ReportFilterFieldType.INTEGER,
                false,
                null,
                "Mes",
                "Obrigatorio quando periodType=specific-month (1-12)"
            ),
            new ReportFilterField(
                "year",
                ReportFilterFieldType.INTEGER,
                false,
                null,
                "Ano",
                "Obrigatorio em specific-month e year (2000-2100)"
            ),
            new ReportFilterField(
                "dateFrom",
                ReportFilterFieldType.DATE,
                false,
                null,
                "Data inicial",
                "Obrigatorio quando periodType=date-range (ISO yyyy-MM-dd)"
            ),
            new ReportFilterField(
                "dateTo",
                ReportFilterFieldType.DATE,
                false,
                null,
                "Data final",
                "Obrigatorio quando periodType=date-range (ISO yyyy-MM-dd)"
            ),
            new ReportFilterField(
                "examIds",
                ReportFilterFieldType.UUID_LIST,
                false,
                null,
                "Exames",
                "Opcional — filtra apenas pelos exames informados"
            )
        );

        return new ReportDefinition(
            ReportCode.CQ_OPERATIONAL_V2,
            "Relatorio Operacional de CQ",
            "Controle de qualidade com estatisticas, Westgard e registros do periodo",
            ReportCategory.CONTROLE_QUALIDADE,
            Set.of(ReportFormat.PDF),
            new ReportFilterSpec(fields),
            Set.of("ADMIN", "VIGILANCIA_SANITARIA", "FUNCIONARIO"),
            false,
            true,
            // 5 anos (RDC ANVISA 786/2023 + ISO 15189:2022 exigem retencao minima de
            // 5 anos do laudo de CQ). Controla apenas a expiracao do PDF baixavel;
            // o registro em report_audit_log e report_signature_log e permanente.
            1825,
            "RDC ANVISA 786/2023 (Controle Interno da Qualidade em laboratorio clinico)"
        );
    }
}

package com.biodiagnostico.service;

import com.biodiagnostico.dto.response.PermissionCatalogResponse;
import com.biodiagnostico.dto.response.PermissionMetadataResponse;
import com.biodiagnostico.entity.Permission;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class PermissionCatalog {

    public record Definition(
        Permission permission,
        String label,
        String description,
        String module,
        String moduleLabel,
        String actionType,
        int moduleOrder,
        int itemOrder,
        Set<Permission> implies
    ) {
        public PermissionMetadataResponse toResponse() {
            return new PermissionMetadataResponse(
                permission.name(),
                label,
                description,
                module,
                moduleLabel,
                actionType,
                itemOrder,
                implies.stream().map(Enum::name).sorted().toList()
            );
        }
    }

    private static final Map<Permission, Definition> DEFINITIONS = new EnumMap<>(Permission.class);
    private static final Map<String, String> MODULE_DESCRIPTIONS = new LinkedHashMap<>();
    private static final Map<String, Integer> MODULE_ORDERS = new LinkedHashMap<>();

    static {
        registerModule("DASHBOARD", "Dashboard Geral", "Indicadores, KPIs e resumo operacional do laboratório", 1);
        registerModule("QC", "Controle de Qualidade (PROIN)", "Bioquímica, Hematologia, Coagulação, Imunologia, Uroanálise e áreas analíticas", 2);
        registerModule("REAGENTS", "Reagentes e Estoque", "Catálogo de reagentes, controle de lotes, validades e movimentações", 3);
        registerModule("MAINTENANCE", "Manutenção de Equipamentos", "Ordens de serviço, calibrações e manutenções preventivas/corretivas", 4);
        registerModule("TEMPERATURE", "Controle de Temperatura", "Pontos de monitoramento, registros diários, fotos e relatórios de temperatura", 5);
        registerModule("REPORTS", "Central de Relatórios", "Catálogo, emissão oficial, assinatura digital e exportações em PDF/Excel", 6);

        // Dashboard
        define(Permission.DASHBOARD_VIEW, "Visualizar Dashboard", "Visualizar indicadores, gráficos gerais e alertas do sistema",
            "DASHBOARD", "VIEW", 1, Set.of());

        // CQ
        define(Permission.QC_VIEW, "Visualizar CQ", "Acessar histórico de medições, gráficos de Levey-Jennings e dados de todas as áreas de CQ",
            "QC", "VIEW", 1, Set.of(Permission.DASHBOARD_VIEW));
        define(Permission.QC_WRITE, "Registrar CQ Bioquímica", "Lançar e editar medições bioquímicas, exames, referências e pós-calibrações",
            "QC", "WRITE", 2, Set.of(Permission.QC_VIEW, Permission.DASHBOARD_VIEW));
        define(Permission.QC_AREAS_WRITE, "Registrar CQ Áreas Especializadas", "Lançar medições em Hematologia, Coagulação, Imunologia, Uroanálise, Parasitologia e Microbiologia",
            "QC", "WRITE", 3, Set.of(Permission.QC_VIEW, Permission.DASHBOARD_VIEW));
        define(Permission.QC_IMPORT, "Importar Dados CQ", "Importar arquivos de controle interno e lotes externos de CQ",
            "QC", "IMPORT", 4, Set.of(Permission.QC_VIEW, Permission.DASHBOARD_VIEW));
        define(Permission.QC_EXPORT, "Exportar Dados CQ", "Exportar tabelas e dados analíticos de CQ em formatos interoperáveis",
            "QC", "EXPORT", 5, Set.of(Permission.QC_VIEW, Permission.DASHBOARD_VIEW));

        // Reagentes
        define(Permission.REAGENTS_VIEW, "Visualizar Reagentes", "Consultar catálogo de reagentes, estoque de lotes e validades",
            "REAGENTS", "VIEW", 1, Set.of(Permission.DASHBOARD_VIEW));
        define(Permission.REAGENTS_WRITE, "Gerenciar Reagentes e Estoque", "Cadastrar reagentes, cadastrar lotes, abrir frascos e registrar movimentações de estoque",
            "REAGENTS", "WRITE", 2, Set.of(Permission.REAGENTS_VIEW, Permission.DASHBOARD_VIEW));
        define(Permission.REAGENTS_DELETE, "Excluir Lotes de Reagentes", "Ação de alto impacto: excluir lotes e registros de estoque cadastrados",
            "REAGENTS", "DELETE", 3, Set.of(Permission.REAGENTS_WRITE, Permission.REAGENTS_VIEW, Permission.DASHBOARD_VIEW));

        // Manutenção
        define(Permission.MAINTENANCE_VIEW, "Visualizar Manutenções", "Consultar histórico de manutenções e status dos equipamentos do laboratório",
            "MAINTENANCE", "VIEW", 1, Set.of(Permission.DASHBOARD_VIEW));
        define(Permission.MAINTENANCE_WRITE, "Registrar Manutenção", "Criar e editar ordens de manutenção preventiva e corretiva de equipamentos",
            "MAINTENANCE", "WRITE", 2, Set.of(Permission.MAINTENANCE_VIEW, Permission.DASHBOARD_VIEW));

        // Temperatura
        define(Permission.TEMPERATURE_VIEW, "Visualizar Temperatura", "Consultar histórico de temperaturas, gráficos e pontos de monitoramento",
            "TEMPERATURE", "VIEW", 1, Set.of(Permission.DASHBOARD_VIEW));
        define(Permission.TEMPERATURE_WRITE, "Registrar Temperatura", "Lançar temperaturas diárias, fotos de termômetros e cadastrar pontos de monitoramento",
            "TEMPERATURE", "WRITE", 2, Set.of(Permission.TEMPERATURE_VIEW, Permission.DASHBOARD_VIEW));

        // Relatórios
        define(Permission.REPORTS_VIEW, "Visualizar Relatórios", "Consultar a central de relatórios, modelos disponíveis e histórico de execuções",
            "REPORTS", "VIEW", 1, Set.of(Permission.DASHBOARD_VIEW));
        define(Permission.REPORTS_GENERATE, "Gerar Relatórios", "Executar e emitir relatórios oficiais analíticos e operacionais do laboratório",
            "REPORTS", "EXECUTE", 2, Set.of(Permission.REPORTS_VIEW, Permission.DASHBOARD_VIEW));
        define(Permission.REPORTS_DOWNLOAD, "Baixar Relatórios", "Fazer download de arquivos gerados em formato PDF e planilhas Excel",
            "REPORTS", "DOWNLOAD", 3, Set.of(Permission.REPORTS_VIEW, Permission.DASHBOARD_VIEW));
    }

    private PermissionCatalog() {
    }

    private static void registerModule(String code, String label, String description, int order) {
        MODULE_DESCRIPTIONS.put(code, description);
        MODULE_ORDERS.put(code, order);
    }

    private static void define(
        Permission permission,
        String label,
        String description,
        String module,
        String actionType,
        int itemOrder,
        Set<Permission> implies
    ) {
        int moduleOrder = MODULE_ORDERS.getOrDefault(module, 99);
        String moduleLabel = getModuleLabel(module);
        DEFINITIONS.put(permission, new Definition(
            permission,
            label,
            description,
            module,
            moduleLabel,
            actionType,
            moduleOrder,
            itemOrder,
            implies
        ));
    }

    public static String getModuleLabel(String module) {
        return switch (module) {
            case "DASHBOARD" -> "Dashboard Geral";
            case "QC" -> "Controle de Qualidade (PROIN)";
            case "REAGENTS" -> "Reagentes e Estoque";
            case "MAINTENANCE" -> "Manutenção de Equipamentos";
            case "TEMPERATURE" -> "Controle de Temperatura";
            case "REPORTS" -> "Central de Relatórios";
            default -> module;
        };
    }

    public static Definition getDefinition(Permission permission) {
        return DEFINITIONS.get(permission);
    }

    public static Set<Permission> getAllPermissions() {
        return Collections.unmodifiableSet(DEFINITIONS.keySet());
    }

    /**
     * Normaliza e expande um conjunto de permissões atribuídas, incluindo todas as permissões implícitas (WRITE => VIEW).
     */
    public static Set<Permission> expandImpliedPermissions(Set<Permission> initial) {
        if (initial == null || initial.isEmpty()) {
            return Collections.emptySet();
        }
        Set<Permission> expanded = EnumSet.copyOf(initial);
        boolean changed = true;
        while (changed) {
            int before = expanded.size();
            Set<Permission> toAdd = new HashSet<>();
            for (Permission p : expanded) {
                Definition def = DEFINITIONS.get(p);
                if (def != null && def.implies() != null) {
                    toAdd.addAll(def.implies());
                }
            }
            expanded.addAll(toAdd);
            changed = expanded.size() > before;
        }
        return expanded;
    }

    public static PermissionCatalogResponse getCatalogResponse() {
        List<PermissionMetadataResponse> allList = new ArrayList<>();
        Map<String, List<PermissionMetadataResponse>> byModule = new LinkedHashMap<>();

        // Ordena por ordem de módulo e depois por ordem do item
        List<Definition> sortedDefs = DEFINITIONS.values().stream()
            .sorted(Comparator.comparingInt(Definition::moduleOrder).thenComparingInt(Definition::itemOrder))
            .toList();

        for (Definition def : sortedDefs) {
            PermissionMetadataResponse meta = def.toResponse();
            allList.add(meta);
            byModule.computeIfAbsent(def.module(), k -> new ArrayList<>()).add(meta);
        }

        List<PermissionCatalogResponse.ModuleGroup> groups = new ArrayList<>();
        for (Map.Entry<String, List<PermissionMetadataResponse>> entry : byModule.entrySet()) {
            String mod = entry.getKey();
            groups.add(new PermissionCatalogResponse.ModuleGroup(
                mod,
                getModuleLabel(mod),
                MODULE_DESCRIPTIONS.getOrDefault(mod, ""),
                MODULE_ORDERS.getOrDefault(mod, 99),
                entry.getValue()
            ));
        }

        groups.sort(Comparator.comparingInt(PermissionCatalogResponse.ModuleGroup::displayOrder));

        return new PermissionCatalogResponse(groups, allList);
    }
}

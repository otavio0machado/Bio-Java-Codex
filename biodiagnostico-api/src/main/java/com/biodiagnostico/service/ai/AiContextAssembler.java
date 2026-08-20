package com.biodiagnostico.service.ai;

import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.repository.QcExamRepository;
import com.biodiagnostico.repository.QcRecordRepository;
import com.biodiagnostico.service.DriftDetector;
import com.biodiagnostico.service.DriftDetector.DriftCandidate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Onda 4 / Fase A — Monta o CONTEXTO factual dos recursos de IA dentro de uma
 * transacao {@code readOnly}, materializando a colecao LAZY
 * {@link QcRecord#getViolations()} ANTES de qualquer chamada HTTP ao provedor.
 *
 * <p><strong>Por que existe:</strong> ate aqui o contexto era percorrido FORA de
 * transacao (em {@code AiService.buildQcContext} / {@code DriftDetector}), o que
 * so funcionava por {@code open-in-view=true}. Com OSIV desligado isso lancava
 * {@code LazyInitializationException} e derrubava TODAS as funcoes de IA em
 * producao. Este componente fecha o acesso lazy dentro da propria transacao e
 * devolve {@code String}/objetos prontos; o {@code AiService} so entao chama o
 * {@link AiProvider} (HTTP) — JA FORA da transacao.
 *
 * <p><strong>Regra de ouro:</strong> NENHUM metodo aqui chama o provedor de IA.
 * A transacao serve exclusivamente para carregar as entidades como MANAGED e
 * tocar a colecao lazy; nada e gravado ({@code readOnly=true} impede flush
 * acidental).
 *
 * <p><strong>Equivalencia de comportamento (mecanico, nao recalcula dominio):</strong>
 * <ul>
 *   <li>As queries, a ordem e os campos lidos sao IDENTICOS aos anteriores. A
 *       ordem das violacoes vem de {@code @OrderBy("createdAt DESC")} na colecao
 *       (resolvida no banco, independe de OSIV); leem-se apenas {@code rule},
 *       {@code description} e {@code severity} — colunas simples da mesma tabela.</li>
 *   <li>NAO ha {@code JOIN FETCH} que altere resultado nem mudanca de ordenacao.</li>
 *   <li>O campo lazy {@code reference} NAO e tocado nesta fase (nao era lido por
 *       {@code buildQcContext}); sera materializado apenas quando a segmentacao
 *       por lote chegar (Fase B).</li>
 * </ul>
 */
@Component
public class AiContextAssembler {

    private static final String QC_CONTEXT_HEADER =
        "Dados de Controle de Qualidade do Laboratório Biodiagnóstico:\n\n";

    private final QcRecordRepository qcRecordRepository;
    private final QcExamRepository qcExamRepository;
    private final DriftDetector driftDetector;

    public AiContextAssembler(
        QcRecordRepository qcRecordRepository,
        QcExamRepository qcExamRepository,
        DriftDetector driftDetector
    ) {
        this.qcRecordRepository = qcRecordRepository;
        this.qcExamRepository = qcExamRepository;
        this.driftDetector = driftDetector;
    }

    /**
     * Contexto do endpoint {@code /analyze} com area: carrega os registros da
     * area (e, opcionalmente, do exame) dentro da janela informada, materializa
     * as violacoes e devolve a String pronta. Replica EXATAMENTE o filtro
     * anterior do controlador: {@code findAllByOrderByDateDesc()} + filtro por
     * area (case-insensitive), por examName (case-insensitive, opcional) e por
     * {@code date >= hoje - days}.
     *
     * @param area     area de CQ (nunca vazia neste caminho; case-insensitive)
     * @param examName exame opcional (case-insensitive); vazio/nulo = todos
     * @param days     janela em dias (inclusive)
     * @return contexto de CQ formatado (com violacoes materializadas)
     */
    @Transactional(readOnly = true)
    public String assembleAnalysisContext(String area, String examName, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<QcRecord> records = qcRecordRepository.findAllByOrderByDateDesc().stream()
            .filter(record -> area != null && area.equalsIgnoreCase(record.getArea()))
            .filter(record -> examName == null || examName.isBlank()
                || examName.equalsIgnoreCase(record.getExamName()))
            .filter(record -> !record.getDate().isBefore(startDate))
            .toList();
        return buildQcContext(records);
    }

    /**
     * A1/A3 — Contexto de registro EM DESTAQUE + historico do mesmo
     * exame+nivel+area. Re-carrega o registro e o historico DENTRO da transacao
     * (entidades MANAGED) para materializar as violacoes com seguranca. Replica o
     * historico do controlador: {@code findByExamNameAndLevelAndAreaOrderByDateDesc}
     * limitado a {@code historySize}, excluindo o proprio registro.
     *
     * <p>O registro em destaque vem PRIMEIRO; o historico segue na mesma ordem da
     * query (data desc). Se {@code recordId} nao existir mais (corrida com
     * exclusao), o contexto traz apenas o historico — o controlador ja tratou o
     * 404 antes de chamar este metodo.
     *
     * @param recordId    id do registro em destaque
     * @param examName    exame do registro (chave do historico)
     * @param level       nivel do registro (chave do historico)
     * @param area        area do registro (chave do historico)
     * @param historySize tamanho maximo do historico
     * @return contexto de CQ formatado (registro + historico, violacoes materializadas)
     */
    @Transactional(readOnly = true)
    public String assembleRecordWithHistoryContext(
        java.util.UUID recordId, String examName, String level, String area, int historySize
    ) {
        List<QcRecord> contextRecords = new ArrayList<>();
        QcRecord record = recordId == null ? null
            : qcRecordRepository.findById(recordId).orElse(null);
        if (record != null) {
            contextRecords.add(record);
        }

        Pageable pageable = PageRequest.of(0, historySize);
        qcRecordRepository
            .findByExamNameAndLevelAndAreaOrderByDateDesc(examName, level, area, pageable)
            .stream()
            .filter(item -> item != null
                && (record == null || item.getId() == null || !item.getId().equals(record.getId())))
            .forEach(contextRecords::add);

        return buildQcContext(contextRecords);
    }

    /**
     * A2 — Contexto da serie Levey-Jennings (mesma query
     * {@code findLeveyJenningsData} do controlador), com janela aplicada em
     * memoria e violacoes materializadas. Carregar a serie aqui dentro garante
     * que cada ponto e MANAGED quando suas violacoes sao tocadas em
     * {@link #buildQcContext(List)}.
     *
     * @return contexto pronto, ou {@code null} quando a serie e vazia no periodo
     *     (sinaliza ao chamador o curto-circuito "sem dados", sem chamar a IA)
     */
    @Transactional(readOnly = true)
    public String assembleTrendContext(
        String examName, String level, String area, int days, int maxPoints
    ) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        Pageable pageable = PageRequest.of(0, maxPoints);
        List<QcRecord> series = qcRecordRepository
            .findLeveyJenningsData(examName, level, area, pageable)
            .stream()
            .filter(record -> record.getDate() != null && !record.getDate().isBefore(startDate))
            .toList();
        if (series.isEmpty()) {
            return null;
        }
        return buildQcContext(series);
    }

    /**
     * D11 — Coleta DETERMINISTICA dos candidatos a drift, materializando as
     * violacoes de TODOS os pontos de cada serie ANTES de delegar ao
     * {@link DriftDetector} (cujo {@code hasRecentRejection} percorre
     * {@code record.getViolations()} de cada ponto — um unico ponto nao
     * materializado reabriria o {@code LazyInitializationException}).
     *
     * <p>Logica EXTRAIDA, sem alteracao, do antigo {@code AiController#collectDriftCandidates}:
     * mesma selecao de exames ativos (por area, ou todos), mesma janela
     * ({@code days}), mesmo limite de pontos por serie ({@code maxPoints}),
     * agrupamento por nivel preservando a ordem (mais recente primeiro) e mesmo
     * teto de alertas ({@code maxAlerts}). Sera reusado pelo job agendado da Fase B.
     *
     * @param area      area de CQ (nulo/vazio = todas)
     * @param days      janela em dias
     * @param maxPoints maximo de pontos por serie
     * @param maxAlerts teto de candidatos retornados
     * @return candidatos a drift ja detectados (a IA, fora daqui, apenas descreve)
     */
    @Transactional(readOnly = true)
    public List<DriftCandidate> collectDriftCandidates(
        String area, int days, int maxPoints, int maxAlerts
    ) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        boolean allAreas = area == null || area.isBlank();

        List<QcExam> exams = allAreas
            ? qcExamRepository.findByIsActiveTrue()
            : qcExamRepository.findByAreaAndIsActiveTrue(area.toLowerCase(Locale.ROOT));

        List<DriftCandidate> candidates = new ArrayList<>();
        for (QcExam exam : exams) {
            String examName = exam.getName();
            String examArea = exam.getArea();
            if (examName == null || examName.isBlank()) {
                continue;
            }

            // Serie recente do exame na area, mais recente primeiro; janela em memoria.
            List<QcRecord> records = qcRecordRepository
                .findByExamNameAndAreaOrderByDateDesc(examName, examArea).stream()
                .filter(record -> record.getDate() != null && !record.getDate().isBefore(startDate))
                .limit(maxPoints)
                .toList();
            if (records.isEmpty()) {
                continue;
            }

            // Salvaguarda (c): materializa as violacoes de TODOS os pontos da
            // serie DENTRO desta transacao, antes de passar ao DriftDetector.
            materializeViolations(records);

            // Agrupa por nivel preservando a ordem (mais recente primeiro) dentro de cada nivel.
            Map<String, List<QcRecord>> byLevel = new LinkedHashMap<>();
            for (QcRecord record : records) {
                String level = record.getLevel() == null ? "" : record.getLevel();
                byLevel.computeIfAbsent(level, ignored -> new ArrayList<>()).add(record);
            }

            for (Map.Entry<String, List<QcRecord>> entry : byLevel.entrySet()) {
                driftDetector.detect(examName, entry.getKey(), examArea, entry.getValue())
                    .ifPresent(candidates::add);
                if (candidates.size() >= maxAlerts) {
                    return candidates;
                }
            }
        }
        return candidates;
    }

    /**
     * Formata o contexto de CQ a partir de registros MANAGED, materializando a
     * colecao lazy {@code violations} de cada um. Identico ao formato historico de
     * {@code AiService.buildQcContext} (header, linha por registro, "  -&gt; Violação:
     * rule - description"); apenas passou a rodar DENTRO da transacao do assembler.
     *
     * <p>Salvaguarda (a): a colecao de cada registro e materializada
     * explicitamente (via {@link #materializeViolations(List)}) antes da
     * formatacao.
     */
    private String buildQcContext(List<QcRecord> records) {
        materializeViolations(records);

        StringBuilder context = new StringBuilder(QC_CONTEXT_HEADER);
        for (QcRecord record : records) {
            context.append(String.format(
                "Data: %s | Exame: %s | Nível: %s | Valor: %.2f | Alvo: %.2f | SD: %.2f | CV: %.2f%% | Status: %s%n",
                record.getDate(),
                record.getExamName(),
                record.getLevel(),
                record.getValue(),
                record.getTargetValue(),
                record.getTargetSd(),
                record.getCv(),
                record.getStatus()
            ));
            if (record.getViolations() != null) {
                record.getViolations().forEach(violation -> context
                    .append("  -> Violação: ")
                    .append(violation.getRule())
                    .append(" - ")
                    .append(violation.getDescription())
                    .append('\n'));
            }
        }
        return context.toString();
    }

    /**
     * Salvaguarda (a)/(c): forca a inicializacao da colecao lazy
     * {@code violations} de cada registro DENTRO da transacao corrente, tocando o
     * tamanho. Nao reordena, nao filtra e nao altera nenhum campo — apenas garante
     * que a colecao esteja carregada antes que o consumidor (formatador ou
     * {@code DriftDetector}) a percorra fora da transacao.
     */
    private void materializeViolations(List<QcRecord> records) {
        if (records == null) {
            return;
        }
        for (QcRecord record : records) {
            if (record != null && record.getViolations() != null) {
                // Toca a colecao para disparar o SELECT da relacao lazy.
                record.getViolations().size();
            }
        }
    }
}

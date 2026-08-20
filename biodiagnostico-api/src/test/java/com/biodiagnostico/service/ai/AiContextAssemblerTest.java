package com.biodiagnostico.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcRecord;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.entity.WestgardViolation;
import com.biodiagnostico.service.DriftDetector;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Onda 4 / Fase A — regressão de blindagem OSIV do {@link AiContextAssembler}.
 *
 * <p>O assembler é o componente que materializa a coleção LAZY
 * {@code QcRecord.violations} DENTRO de uma transação {@code readOnly} (recarregando
 * por id) e devolve o contexto já formatado como String, ANTES de qualquer chamada
 * HTTP à IA. Antes da Onda 4, esse acesso lazy acontecia fora de transação e, com
 * {@code open-in-view=false}, lançava {@code LazyInitializationException} derrubando
 * TODA a IA em produção.
 *
 * <p>Cada caso persiste um registro COM violação, faz {@code entityManager.clear()}
 * (limpando o persistence context — a entidade original fica detached, como num
 * request cuja sessão já se fechou) e então invoca o assembler apenas com o id. O
 * assembler precisa recarregar e materializar as violações por conta própria; se a
 * materialização falhasse, o contexto não traria a linha de violação. A propriedade
 * {@code open-in-view=false} documenta a intenção do cenário de produção.
 */
@DataJpaTest
@ActiveProfiles("local")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.jpa.open-in-view=false")
@Import({AiContextAssembler.class, DriftDetector.class})
class AiContextAssemblerTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private AiContextAssembler assembler;

    @Test
    @DisplayName("OSIV — assembleRecordWithHistoryContext (A1/A3) materializa a violação no contexto")
    void assemblesRecordContextWithViolations() {
        QcRecord saved = persistRecordWithViolation("1-3s");
        entityManager.clear();

        String context = assembler.assembleRecordWithHistoryContext(
            saved.getId(), "Glicose", "Normal", "bioquimica", 15);

        assertThat(context)
            .contains("Glicose")
            .contains("Status: REPROVADO")
            .contains("Violação: 1-3s");
    }

    @Test
    @DisplayName("OSIV — assembleAnalysisContext (/analyze com área) materializa a violação no contexto")
    void assemblesAnalysisContextWithViolations() {
        persistRecordWithViolation("2-2s");
        entityManager.clear();

        String context = assembler.assembleAnalysisContext("bioquimica", "Glicose", 30);

        assertThat(context)
            .contains("Glicose")
            .contains("Violação: 2-2s");
    }

    /** Persiste exame + referência + registro REPROVADO com uma violação (cascade ALL). */
    private QcRecord persistRecordWithViolation(String rule) {
        QcExam exam = entityManager.persistAndFlush(QcExam.builder()
            .name("Glicose").area("bioquimica").isActive(Boolean.TRUE).build());
        QcReferenceValue reference = entityManager.persistAndFlush(QcReferenceValue.builder()
            .exam(exam).name("Ref atual").level("Normal").lotNumber("L1")
            .targetValue(100D).targetSd(5D).cvMaxThreshold(10D).isActive(Boolean.TRUE).build());
        QcRecord record = QcRecord.builder()
            .reference(reference)
            .examName("Glicose")
            .area("bioquimica")
            .level("Normal")
            .lotNumber("L1")
            .date(LocalDate.now())
            .value(118D)
            .targetValue(100D)
            .targetSd(5D)
            .cv(2D)
            .cvLimit(10D)
            .zScore(3.6D)
            .status("REPROVADO")
            .needsCalibration(Boolean.FALSE)
            .build();
        record.getViolations().add(WestgardViolation.builder()
            .qcRecord(record).rule(rule).description("Violação " + rule).severity("REJECT").build());
        return entityManager.persistAndFlush(record);
    }
}

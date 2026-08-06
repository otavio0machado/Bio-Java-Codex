package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.QcReferenceRequest;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.entity.QcReferenceValue;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.QcExamRepository;
import com.biodiagnostico.repository.QcReferenceValueRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QcReferenceServiceTest {

    private QcReferenceService qcReferenceService;

    @Mock
    private QcReferenceValueRepository qcReferenceValueRepository;

    @Mock
    private QcExamRepository qcExamRepository;

    @BeforeEach
    void setUp() {
        qcReferenceService = new QcReferenceService(qcReferenceValueRepository, qcExamRepository);
    }

    @Test
    @DisplayName("deve priorizar referência de lote exato quando existir")
    void shouldResolveExactLotReferenceWhenLotMatches() {
        QcReferenceValue exactLot = reference("LOT-01", LocalDate.of(2026, 4, 1), null);
        QcReferenceValue generic = reference(null, LocalDate.of(2026, 3, 1), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(generic, exactLot));

        QcReferenceValue resolved = qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            "Normal",
            LocalDate.of(2026, 4, 3),
            "LOT-01",
            null
        );

        assertThat(resolved.getId()).isEqualTo(exactLot.getId());
    }

    @Test
    @DisplayName("deve rejeitar fallback para outro lote em coagulação")
    void shouldRejectCoagulationFallbackWhenExactLotDoesNotMatch() {
        QcReferenceValue otherLot = coagulationReference("COAG-OTHER");
        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "INR",
            "coagulacao",
            "Normal"
        )).thenReturn(List.of(otherLot));

        assertThatThrownBy(() -> qcReferenceService.resolveApplicableReference(
            "INR", "coagulacao", "Normal", LocalDate.of(2026, 4, 3), "COAG-NEW", null
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("lote de coagulação informado");
    }

    @Test
    @DisplayName("deve usar referência genérica quando lote não for informado e houver uma única válida")
    void shouldResolveGenericReferenceWhenLotIsAbsent() {
        QcReferenceValue generic = reference(null, LocalDate.of(2026, 4, 1), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(generic));

        QcReferenceValue resolved = qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            "Normal",
            LocalDate.of(2026, 4, 3),
            null,
            null
        );

        assertThat(resolved.getId()).isEqualTo(generic.getId());
    }

    @Test
    @DisplayName("deve assumir nível Normal quando o request não informar nível")
    void shouldDefaultMissingLevelToNormal() {
        QcReferenceValue generic = reference(null, LocalDate.of(2026, 4, 1), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(generic));

        QcReferenceValue resolved = qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            null,
            LocalDate.of(2026, 4, 3),
            null,
            null
        );

        assertThat(resolved.getId()).isEqualTo(generic.getId());
    }

    @Test
    @DisplayName("deve bloquear conflito entre múltiplas referências do mesmo lote")
    void shouldRejectWhenMoreThanOneLotSpecificReferenceMatches() {
        QcReferenceValue first = reference("LOT-01", LocalDate.of(2026, 4, 1), null);
        QcReferenceValue second = reference("LOT-01", LocalDate.of(2026, 3, 15), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(first, second));

        assertThatThrownBy(() -> qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            "Normal",
            LocalDate.of(2026, 4, 3),
            "LOT-01",
            null
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("mais de uma referência ativa");
    }

    @Test
    @DisplayName("deve usar referência única mesmo quando ela possui lote legado e o lote não foi informado")
    void shouldResolveSingleLotSpecificReferenceWhenLotIsMissing() {
        QcReferenceValue lotSpecific = reference("LOT-01", LocalDate.of(2026, 4, 1), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(lotSpecific));

        QcReferenceValue resolved = qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            "Normal",
            LocalDate.of(2026, 4, 3),
            null,
            null
        );

        assertThat(resolved.getId()).isEqualTo(lotSpecific.getId());
    }

    @Test
    @DisplayName("deve bloquear quando houver mais de uma referência vigente sem seleção operacional")
    void shouldRejectWhenMoreThanOneReferenceIsApplicableWithoutOperationalSelection() {
        QcReferenceValue first = reference("LOT-01", LocalDate.of(2026, 4, 1), null);
        QcReferenceValue second = reference(null, LocalDate.of(2026, 3, 15), null);

        when(qcReferenceValueRepository.findByExam_NameIgnoreCaseAndExam_AreaIgnoreCaseAndLevelIgnoreCaseAndIsActiveTrue(
            "Glicose",
            "bioquimica",
            "Normal"
        )).thenReturn(List.of(first, second));

        assertThatThrownBy(() -> qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            null,
            LocalDate.of(2026, 4, 3),
            null,
            null
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("mais de uma referência ativa");
    }

    @Test
    @DisplayName("deve bloquear referência explícita fora da vigência")
    void shouldRejectExplicitReferenceOutsideValidity() {
        UUID referenceId = UUID.randomUUID();
        QcReferenceValue expiredReference = reference("LOT-01", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1));
        expiredReference.setId(referenceId);

        when(qcReferenceValueRepository.findById(referenceId)).thenReturn(Optional.of(expiredReference));

        assertThatThrownBy(() -> qcReferenceService.resolveApplicableReference(
            "Glicose",
            "bioquimica",
            "Normal",
            LocalDate.of(2026, 4, 3),
            "LOT-01",
            referenceId
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não está vigente");
    }

    @Test
    @DisplayName("deve validar faixa de validade ao criar referência")
    void shouldRejectReferenceWithInvalidValidityRange() {
        UUID examId = UUID.randomUUID();
        QcReferenceRequest request = new QcReferenceRequest(
            examId,
            "Controle Glicose N1",
            "Normal",
            "LOT-01",
            "Fabricante",
            100D,
            5D,
            10D,
            LocalDate.of(2026, 4, 10),
            LocalDate.of(2026, 4, 1),
            "Referência inválida"
        );
        when(qcExamRepository.findById(examId)).thenReturn(Optional.of(
            QcExam.builder().id(examId).name("Glicose").area("bioquimica").unit("mg/dL").build()
        ));

        assertThatThrownBy(() -> qcReferenceService.createReference(request))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("validade final");
    }

    @Test
    @DisplayName("deve rejeitar referência para exame proibido de coagulação")
    void shouldRejectReferenceForForbiddenCoagulationExam() {
        UUID examId = UUID.randomUUID();
        when(qcExamRepository.findById(examId)).thenReturn(Optional.of(
            QcExam.builder().id(examId).name("Fibrinogênio").area("coagulacao").unit("mg/dL").build()
        ));

        assertThatThrownBy(() -> qcReferenceService.createReference(
            referenceRequest(examId, "COAG-01")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Atividade (%)");
    }

    @Test
    @DisplayName("deve exigir lote ao criar referência de coagulação")
    void shouldRequireLotWhenCreatingCoagulationReference() {
        UUID examId = UUID.randomUUID();
        when(qcExamRepository.findById(examId)).thenReturn(Optional.of(
            QcExam.builder().id(examId).name("INR").area("coagulacao").unit(null).build()
        ));

        assertThatThrownBy(() -> qcReferenceService.createReference(
            referenceRequest(examId, "  ")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("lote é obrigatório");
    }

    @Test
    @DisplayName("deve exigir lote ao atualizar referência de coagulação")
    void shouldRequireLotWhenUpdatingCoagulationReference() {
        UUID referenceId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        when(qcReferenceValueRepository.findById(referenceId)).thenReturn(Optional.of(reference(
            "COAG-OLD", LocalDate.of(2026, 4, 1), null
        )));
        when(qcExamRepository.findById(examId)).thenReturn(Optional.of(
            QcExam.builder().id(examId).name("TTPA").area("coagulacao").unit("s").build()
        ));

        assertThatThrownBy(() -> qcReferenceService.updateReference(
            referenceId, referenceRequest(examId, null)
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("lote é obrigatório");
    }

    @Test
    @DisplayName("deve filtrar referências exclusivamente pela área solicitada")
    void shouldFilterReferencesByArea() {
        QcReferenceValue coagulation = reference(null, LocalDate.of(2026, 4, 1), null);
        coagulation.getExam().setName("INR");
        coagulation.getExam().setArea("coagulacao");
        when(qcReferenceValueRepository.findByFilters(null, "coagulacao", true))
            .thenReturn(List.of(coagulation));

        List<QcReferenceValue> result = qcReferenceService.getReferences(null, true, " coagulacao ");

        assertThat(result).containsExactly(coagulation);
        assertThat(result.getFirst().getExam().getArea()).isEqualTo("coagulacao");
    }

    @Test
    @DisplayName("deve rejeitar referência explícita pertencente a outra área")
    void shouldRejectExplicitReferenceFromAnotherArea() {
        UUID referenceId = UUID.randomUUID();
        QcReferenceValue biochemistryReference = reference(null, LocalDate.of(2026, 4, 1), null);
        biochemistryReference.setId(referenceId);
        biochemistryReference.getExam().setName("INR");
        when(qcReferenceValueRepository.findById(referenceId)).thenReturn(Optional.of(biochemistryReference));

        assertThatThrownBy(() -> qcReferenceService.resolveApplicableReference(
            "INR", "coagulacao", "Normal", LocalDate.of(2026, 4, 3), null, referenceId
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não pertence à área");
    }

    private QcReferenceValue reference(String lotNumber, LocalDate validFrom, LocalDate validUntil) {
        return QcReferenceValue.builder()
            .id(UUID.randomUUID())
            .exam(QcExam.builder().id(UUID.randomUUID()).name("Glicose").area("bioquimica").isActive(Boolean.TRUE).build())
            .name("Controle Glicose N1")
            .level("Normal")
            .lotNumber(lotNumber)
            .targetValue(100D)
            .targetSd(5D)
            .cvMaxThreshold(10D)
            .validFrom(validFrom)
            .validUntil(validUntil)
            .isActive(Boolean.TRUE)
            .build();
    }

    private QcReferenceValue coagulationReference(String lotNumber) {
        return QcReferenceValue.builder()
            .id(UUID.randomUUID())
            .exam(QcExam.builder()
                .id(UUID.randomUUID())
                .name("INR")
                .area("coagulacao")
                .isActive(Boolean.TRUE)
                .build())
            .name("Controle INR N1")
            .level("Normal")
            .lotNumber(lotNumber)
            .targetValue(1D)
            .targetSd(0.1D)
            .cvMaxThreshold(10D)
            .isActive(Boolean.TRUE)
            .build();
    }

    private QcReferenceRequest referenceRequest(UUID examId, String lotNumber) {
        return new QcReferenceRequest(
            examId,
            "Controle Coagulação N1",
            "Normal",
            lotNumber,
            "Fabricante",
            1D,
            0.1D,
            10D,
            LocalDate.of(2026, 4, 1),
            null,
            null
        );
    }
}

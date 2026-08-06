package com.biodiagnostico.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.biodiagnostico.dto.request.QcExamRequest;
import com.biodiagnostico.entity.QcExam;
import com.biodiagnostico.exception.BusinessException;
import com.biodiagnostico.repository.QcExamRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QcExamServiceTest {

    @Mock
    private QcExamRepository repository;

    private QcExamService service;

    @BeforeEach
    void setUp() {
        service = new QcExamService(repository);
        org.mockito.Mockito.lenient().when(repository.save(any(QcExam.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("deve normalizar INR de coagulação sem unidade")
    void shouldNormalizeCoagulationInrWithoutUnit() {
        QcExam saved = service.createExam(new QcExamRequest(" inr ", " Coagulacao ", "  "));

        assertThat(saved.getName()).isEqualTo("INR");
        assertThat(saved.getArea()).isEqualTo("coagulacao");
        assertThat(saved.getUnit()).isNull();
    }

    @Test
    @DisplayName("deve preservar cadastro de exames de outras áreas")
    void shouldNotAffectOtherAreas() {
        QcExam saved = service.createExam(new QcExamRequest("Glicose", "bioquimica", "mg/dL"));

        assertThat(saved.getName()).isEqualTo("Glicose");
        assertThat(saved.getArea()).isEqualTo("bioquimica");
        assertThat(saved.getUnit()).isEqualTo("mg/dL");
    }

    @Test
    @DisplayName("deve rejeitar exame fora da allowlist de coagulação")
    void shouldRejectUnsupportedCoagulationExam() {
        assertThatThrownBy(() -> service.createExam(
            new QcExamRequest("Fibrinogênio", "coagulacao", "mg/dL")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Atividade (%)")
            .hasMessageContaining("INR")
            .hasMessageContaining("TTPA");
    }

    @Test
    @DisplayName("deve exigir unidades canônicas dos exames de coagulação")
    void shouldRequireCanonicalCoagulationUnits() {
        assertThatThrownBy(() -> service.createExam(
            new QcExamRequest("TTPA", "coagulacao", "seg")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("unidade s");
    }

    @Test
    @DisplayName("deve rejeitar duplicata semântica de exame de coagulação")
    void shouldRejectSemanticDuplicate() {
        when(repository.existsByAreaIgnoreCaseAndNameIgnoreCase("coagulacao", "INR"))
            .thenReturn(true);

        assertThatThrownBy(() -> service.createExam(
            new QcExamRequest("inr", "COAGULACAO", null)
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("identidade canônica");
    }

    @Test
    @DisplayName("não deve permitir renomear exame canônico de coagulação")
    void shouldRejectCanonicalExamRename() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(coagulationExam(id, "INR", null)));

        assertThatThrownBy(() -> service.updateExam(
            id, new QcExamRequest("TTPA", "coagulacao", "s")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não podem ser movidos ou renomeados");
    }

    @Test
    @DisplayName("não deve permitir mover exame canônico para outra área")
    void shouldRejectCanonicalExamMove() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(coagulationExam(id, "TTPA", "s")));

        assertThatThrownBy(() -> service.updateExam(
            id, new QcExamRequest("TTPA", "bioquimica", "s")
        ))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não podem ser movidos ou renomeados");
    }

    @Test
    @DisplayName("não deve permitir excluir exame canônico de coagulação")
    void shouldRejectCanonicalExamDeletion() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.of(coagulationExam(id, "Atividade (%)", "%")));

        assertThatThrownBy(() -> service.deleteExam(id))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("não podem ser excluídos");
    }

    private QcExam coagulationExam(UUID id, String name, String unit) {
        return QcExam.builder()
            .id(id)
            .name(name)
            .area("coagulacao")
            .unit(unit)
            .isActive(Boolean.TRUE)
            .build();
    }
}
